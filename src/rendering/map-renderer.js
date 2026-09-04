/** 缩略图、全览图与方向提示。 */
import { DIRECTIONS, MAZE_SIZE } from "../config.js";
import { inBounds, indexFor, parseRoomKey, roomKey } from "../core/coordinates.js";
import { clamp } from "../core/math.js";

export class MapRenderer {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.minimapCtx = this.dom.minimapCanvas.getContext("2d");
    this.fullMapCtx = this.dom.fullMapCanvas.getContext("2d");
    this.endMapCtx = this.dom.endMapCanvas.getContext("2d");
    this.fullMapTransform = null;
  }

  presentEndSummary() {
    this.dom.endOverlay.hidden = false;
    requestAnimationFrame(() => {
      this.game.renderer.resizeCanvas(this.dom.endMapCanvas, this.endMapCtx);
      const rect = this.dom.endMapCanvas.getBoundingClientRect();
      this.drawMap(this.endMapCtx, rect.width, rect.height, true, false);
    });
  }

  renderMinimap() {
    if (!this.game.state) return;
    const rect = this.dom.minimapCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.drawMap(this.minimapCtx, rect.width, rect.height, false, true);
  }

  openMap(revealAll) {
    if (!this.game.state) return;
    this.dom.mapOverlay.hidden = false;
    requestAnimationFrame(() => {
      this.game.renderer.resizeCanvas(this.dom.fullMapCanvas, this.fullMapCtx);
      const rect = this.dom.fullMapCanvas.getBoundingClientRect();
      this.fullMapTransform = this.drawMap(this.fullMapCtx, rect.width, rect.height, revealAll, false);
    });
  }

  getExitHintDirection(exit) {
    const dx = exit.x - this.game.state.player.x;
    const dy = exit.y - this.game.state.player.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return { key: dx >= 0 ? "east" : "west", ux: dx >= 0 ? 1 : -1, uy: 0 };
    }
    return { key: dy >= 0 ? "south" : "north", ux: 0, uy: dy >= 0 ? 1 : -1 };
  }

  drawMap(ctx, width, height, revealAll, compact) {
    if (!this.game.state || width <= 0 || height <= 0) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#040609";
    ctx.fillRect(0, 0, width, height);
    const padding = compact ? 6 : 14;
    const explored = new Set(this.game.state.explored);
    let viewMinX = 0;
    let viewMaxX = MAZE_SIZE - 1;
    let viewMinY = 0;
    let viewMaxY = MAZE_SIZE - 1;

    if (!revealAll && explored.size) {
      viewMinX = MAZE_SIZE - 1;
      viewMaxX = 0;
      viewMinY = MAZE_SIZE - 1;
      viewMaxY = 0;
      explored.forEach((key) => {
        const room = parseRoomKey(key);
        viewMinX = Math.min(viewMinX, room.x);
        viewMaxX = Math.max(viewMaxX, room.x);
        viewMinY = Math.min(viewMinY, room.y);
        viewMaxY = Math.max(viewMaxY, room.y);
      });
      const expandRange = (min, max) => {
        const minimumSpan = Math.min(compact ? 18 : 26, MAZE_SIZE - 1);
        const edgePadding = compact ? 2 : 3;
        let rangeMin = min - edgePadding;
        let rangeMax = max + edgePadding;
        if (rangeMax - rangeMin < minimumSpan) {
          const center = (rangeMin + rangeMax) / 2;
          rangeMin = center - minimumSpan / 2;
          rangeMax = center + minimumSpan / 2;
        }
        if (rangeMin < 0) {
          rangeMax -= rangeMin;
          rangeMin = 0;
        }
        if (rangeMax > MAZE_SIZE - 1) {
          rangeMin -= rangeMax - (MAZE_SIZE - 1);
          rangeMax = MAZE_SIZE - 1;
        }
        return [Math.max(0, rangeMin), Math.min(MAZE_SIZE - 1, rangeMax)];
      };
      [viewMinX, viewMaxX] = expandRange(viewMinX, viewMaxX);
      [viewMinY, viewMaxY] = expandRange(viewMinY, viewMaxY);
    }

    const viewSpanX = Math.max(1, viewMaxX - viewMinX);
    const viewSpanY = Math.max(1, viewMaxY - viewMinY);
    const scale = (Math.min(width, height) - padding * 2) / Math.max(viewSpanX, viewSpanY);
    const offsetX = (width - scale * viewSpanX) / 2 - viewMinX * scale;
    const offsetY = (height - scale * viewSpanY) / 2 - viewMinY * scale;
    const canDraw = (x, y) => revealAll || explored.has(roomKey(x, y));
    const outerWallWidth = compact ? clamp(scale * 0.45, 1, 2.1) : clamp(scale * 0.58, 2.4, 4.5);
    const innerPathWidth = compact ? clamp(scale * 0.34, 0.72, 1.75) : clamp(scale * 0.42, 1.8, 3.5);

    ctx.save();
    ctx.lineCap = "square";
    ctx.lineJoin = "round";
    const strokeConnections = (strokeStyle, lineWidth) => {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      for (let y = Math.floor(viewMinY); y <= Math.ceil(viewMaxY); y += 1) {
        for (let x = Math.floor(viewMinX); x <= Math.ceil(viewMaxX); x += 1) {
          if (!canDraw(x, y)) continue;
          const mask = this.game.state.maze.bits[indexFor(x, y)];
          const sx = offsetX + x * scale;
          const sy = offsetY + y * scale;
          for (const direction of [DIRECTIONS.right, DIRECTIONS.down]) {
            const nx = x + direction.dx;
            const ny = y + direction.dy;
            if ((mask & direction.bit) === 0 || !inBounds(nx, ny) || !canDraw(nx, ny)) continue;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(offsetX + nx * scale, offsetY + ny * scale);
            ctx.stroke();
          }
        }
      }
    };

    // 缩略图以灰蓝探索网络为主，暗红只保留成很窄的墙影，避免整幅图变成红色网格。
    strokeConnections(revealAll ? "rgba(71, 38, 43, 0.74)" : "rgba(87, 49, 55, 0.78)", outerWallWidth);
    strokeConnections(revealAll ? "#2a3b46" : "#3a505d", innerPathWidth);

    for (let y = Math.floor(viewMinY); y <= Math.ceil(viewMaxY); y += 1) {
      for (let x = Math.floor(viewMinX); x <= Math.ceil(viewMaxX); x += 1) {
        if (!canDraw(x, y)) continue;
        const sx = offsetX + x * scale;
        const sy = offsetY + y * scale;
        const outerSize = compact ? clamp(scale * 0.46, 0.95, 2.1) : clamp(scale * 0.58, 2.3, 4.4);
        const innerSize = compact ? clamp(scale * 0.34, 0.7, 1.72) : clamp(scale * 0.42, 1.75, 3.4);
        ctx.fillStyle = revealAll ? "#47262b" : "#573137";
        ctx.fillRect(sx - outerSize / 2, sy - outerSize / 2, outerSize, outerSize);
        ctx.fillStyle = revealAll ? "#2a3b46" : "#3a505d";
        ctx.fillRect(sx - innerSize / 2, sy - innerSize / 2, innerSize, innerSize);
      }
    }

    if (this.game.state.path.length > 1) {
      ctx.lineWidth = compact ? clamp(scale * 0.3, 0.65, 1.6) : clamp(scale * 0.42, 1.8, 2.8);
      ctx.strokeStyle = "rgba(226, 179, 81, 0.86)";
      ctx.beginPath();
      let started = false;
      this.game.state.path.forEach((point) => {
        const px = offsetX + point.x * scale;
        const py = offsetY + point.y * scale;
        if (!canDraw(point.x, point.y)) {
          started = false;
          return;
        }
        if (!started || point.teleport) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();

      for (let i = 1; i < this.game.state.path.length; i += 1) {
        const point = this.game.state.path[i];
        const previous = this.game.state.path[i - 1];
        if (!point.teleport || !canDraw(point.x, point.y) || !canDraw(previous.x, previous.y)) continue;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(97,217,242,0.75)";
        ctx.beginPath();
        ctx.moveTo(offsetX + previous.x * scale, offsetY + previous.y * scale);
        ctx.lineTo(offsetX + point.x * scale, offsetY + point.y * scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    const compactHints = compact
      ? this.game.state.maze.exits.map((exit) => this.getExitHintDirection(exit))
      : [];
    const hintTotals = {};
    const hintUsed = {};
    compactHints.forEach((hint) => {
      hintTotals[hint.key] = (hintTotals[hint.key] || 0) + 1;
    });

    this.game.state.maze.exits.forEach((exit, exitIndex) => {
      const discovered = explored.has(roomKey(exit.x, exit.y));
      if (!compact && !revealAll && !discovered && this.game.state.exitHintTurns <= 0) return;
      const arrowSize = compact ? clamp(scale * 2.2, 3.5, 5) : clamp(scale * 1.1, 5.5, 7.2);
      const rawX = offsetX + exit.x * scale;
      const rawY = offsetY + exit.y * scale;
      let px = rawX;
      let py = rawY;
      let ux;
      let uy;
      if (compact) {
        const hint = compactHints[exitIndex];
        const slot = hintUsed[hint.key] || 0;
        const total = hintTotals[hint.key];
        const shift = (slot - (total - 1) / 2) * arrowSize * 2.1;
        hintUsed[hint.key] = slot + 1;
        ux = hint.ux;
        uy = hint.uy;
        if (hint.key === "north" || hint.key === "south") {
          px = width / 2 + shift;
          py = hint.key === "north" ? padding + arrowSize : height - padding - arrowSize;
        } else {
          px = hint.key === "west" ? padding + arrowSize : width - padding - arrowSize;
          py = height / 2 + shift;
        }
      } else {
        ux = exit.x - this.game.state.player.x;
        uy = exit.y - this.game.state.player.y;
        const length = Math.hypot(ux, uy) || 1;
        ux /= length;
        uy /= length;
      }
      const perpendicularX = -uy;
      const perpendicularY = ux;
      const baseX = px - ux * arrowSize * 0.48;
      const baseY = py - uy * arrowSize * 0.48;
      ctx.globalAlpha = discovered || revealAll || this.game.state.exitHintTurns > 0 ? 1 : 0.76;
      ctx.fillStyle = "#ffc85c";
      ctx.shadowColor = "#b28bff";
      ctx.shadowBlur = compact ? 5 : 9;
      ctx.beginPath();
      ctx.moveTo(px + ux * arrowSize, py + uy * arrowSize);
      ctx.lineTo(baseX + perpendicularX * arrowSize * 0.55, baseY + perpendicularY * arrowSize * 0.55);
      ctx.lineTo(baseX - perpendicularX * arrowSize * 0.55, baseY - perpendicularY * arrowSize * 0.55);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#61d9f2";
    ctx.shadowBlur = compact ? 5 : 9;
    ctx.beginPath();
    ctx.arc(
      offsetX + this.game.state.player.x * scale,
      offsetY + this.game.state.player.y * scale,
      compact ? clamp(scale * 0.72, 1.6, 2.6) : clamp(scale * 0.64, 3.2, 4.2),
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
    return { scale, offsetX, offsetY, viewMinX, viewMaxX, viewMinY, viewMaxY };
  }
}

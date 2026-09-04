/** 主地图、墙体、迷雾与图集渲染。 */
import { DIRECTIONS, MAZE_SIZE, ROOM_FLOOR_SIZE, ROOM_SPAN, VISION_ZOOM_SCALE, WALL_RENDER_ALPHA, WALL_RENDER_MARGIN_ROOMS } from "../config.js";
import { inBounds, indexFor, parseRoomKey, roomKey } from "../core/coordinates.js";
import { clamp } from "../core/math.js";
import { hashString } from "../core/random.js";
import { SPRITE_ATLAS } from "../data/atlas.js";
import { ENEMY_DEFS, EVENT_DEFS, ITEM_DEFS } from "../data/catalog.js";
import { AssetStore } from "../ui/assets.js";
import { measureSafeAreaTop } from "../ui/safe-area.js";

export class MazeRenderer {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.assets = new AssetStore(SPRITE_ATLAS.url, () => this.render());
    this.ctx = this.dom.gameCanvas.getContext("2d");
    this.renderQueued = false;
  }

  resize() {
    this.updateSafeAreaInsets();
    this.resizeCanvas(this.dom.gameCanvas, this.ctx);
    this.resizeCanvas(this.dom.minimapCanvas, this.game.maps.minimapCtx);
    this.render();
    requestAnimationFrame(() => {
      this.resizeCanvas(this.dom.gameCanvas, this.ctx);
      this.resizeCanvas(this.dom.minimapCanvas, this.game.maps.minimapCtx);
      this.render();
    });
  }

  updateSafeAreaInsets() {
    const root = document.documentElement;
    if (!root || !root.style || typeof root.style.setProperty !== "function") return;
    root.style.setProperty("--app-safe-area-top", `${measureSafeAreaTop()}px`);
  }

  resizeCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderGameCanvas();
      this.game.maps.renderMinimap();
    });
  }

  getMainViewMetrics(width, height) {
    const defaultTileSize = clamp(Math.min(width / 18, height / 17), 17, 31);
    const playerWorld = this.roomWorldCenter(this.game.state.player.x, this.game.state.player.y);
    const enhanced = this.game.state.visionTurns > 0;
    const tileSize = enhanced ? defaultTileSize * VISION_ZOOM_SCALE : defaultTileSize;

    return {
      tileSize,
      enhanced,
      camera: {
        x: width / 2 - playerWorld.x * tileSize,
        y: height / 2 - playerWorld.y * tileSize
      }
    };
  }

  getViewportRoomBounds(width, height, tileSize, camera) {
    const minWorldX = -camera.x / tileSize;
    const maxWorldX = (width - camera.x) / tileSize;
    const minWorldY = -camera.y / tileSize;
    const maxWorldY = (height - camera.y) / tileSize;
    return {
      minX: Math.max(0, Math.floor(minWorldX / ROOM_SPAN) - WALL_RENDER_MARGIN_ROOMS),
      maxX: Math.min(MAZE_SIZE - 1, Math.ceil(maxWorldX / ROOM_SPAN) + WALL_RENDER_MARGIN_ROOMS),
      minY: Math.max(0, Math.floor(minWorldY / ROOM_SPAN) - WALL_RENDER_MARGIN_ROOMS),
      maxY: Math.min(MAZE_SIZE - 1, Math.ceil(maxWorldY / ROOM_SPAN) + WALL_RENDER_MARGIN_ROOMS)
    };
  }

  drawMazeWalls(ctx, bounds, tileSize) {
    const segments = this.collectMazeWallSegments(bounds);
    if (!segments.length) return;
    const strokeSegments = () => {
      ctx.beginPath();
      segments.forEach((segment) => {
        ctx.moveTo(segment.x1 * tileSize, segment.y1 * tileSize);
        ctx.lineTo(segment.x2 * tileSize, segment.y2 * tileSize);
      });
      ctx.stroke();
    };
    ctx.save();
    ctx.globalAlpha = WALL_RENDER_ALPHA;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = "#5b2228";
    ctx.lineWidth = Math.max(1.8, tileSize * 0.34);
    ctx.shadowColor = "rgba(181, 54, 62, 0.34)";
    ctx.shadowBlur = Math.max(2, tileSize * 0.16);
    strokeSegments();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#bd555c";
    ctx.lineWidth = Math.max(0.8, tileSize * 0.09);
    strokeSegments();
    ctx.restore();
  }

  isBaseMazeFloorCell(worldX, worldY) {
    const worldLimit = MAZE_SIZE * ROOM_SPAN;
    if (worldX < 0 || worldY < 0 || worldX >= worldLimit || worldY >= worldLimit) return false;
    const modX = worldX % ROOM_SPAN;
    const modY = worldY % ROOM_SPAN;
    const roomX = Math.floor(worldX / ROOM_SPAN);
    const roomY = Math.floor(worldY / ROOM_SPAN);
    if (modX >= 1 && modX <= ROOM_FLOOR_SIZE && modY >= 1 && modY <= ROOM_FLOOR_SIZE) {
      return inBounds(roomX, roomY);
    }
    if (modX === 0 && modY >= 1 && modY <= ROOM_FLOOR_SIZE) {
      const leftRoomX = roomX - 1;
      return inBounds(leftRoomX, roomY)
        && inBounds(roomX, roomY)
        && (this.game.state.maze.bits[indexFor(leftRoomX, roomY)] & DIRECTIONS.right.bit) !== 0;
    }
    if (modY === 0 && modX >= 1 && modX <= ROOM_FLOOR_SIZE) {
      const upperRoomY = roomY - 1;
      return inBounds(roomX, upperRoomY)
        && inBounds(roomX, roomY)
        && (this.game.state.maze.bits[indexFor(roomX, upperRoomY)] & DIRECTIONS.down.bit) !== 0;
    }
    return false;
  }

  isRemovableWallPillar(worldX, worldY) {
    if (worldX % ROOM_SPAN !== 0 || worldY % ROOM_SPAN !== 0) return false;
    return this.isBaseMazeFloorCell(worldX - 1, worldY)
      && this.isBaseMazeFloorCell(worldX + 1, worldY)
      && this.isBaseMazeFloorCell(worldX, worldY - 1)
      && this.isBaseMazeFloorCell(worldX, worldY + 1);
  }

  isMazeFloorCell(worldX, worldY) {
    return this.isBaseMazeFloorCell(worldX, worldY) || this.isRemovableWallPillar(worldX, worldY);
  }

  collectMazeWallSegments(bounds) {
    const segments = [];
    const worldLimit = MAZE_SIZE * ROOM_SPAN - 1;
    const minWorldX = Math.max(0, bounds.minX * ROOM_SPAN);
    const maxWorldX = Math.min(worldLimit, (bounds.maxX + 1) * ROOM_SPAN);
    const minWorldY = Math.max(0, bounds.minY * ROOM_SPAN);
    const maxWorldY = Math.min(worldLimit, (bounds.maxY + 1) * ROOM_SPAN);
    const add = (x1, y1, x2, y2) => segments.push({ x1, y1, x2, y2 });
    for (let worldY = minWorldY; worldY <= maxWorldY; worldY += 1) {
      for (let worldX = minWorldX; worldX <= maxWorldX; worldX += 1) {
        if (!this.isMazeFloorCell(worldX, worldY)) continue;
        if (!this.isMazeFloorCell(worldX, worldY - 1)) add(worldX, worldY, worldX + 1, worldY);
        if (!this.isMazeFloorCell(worldX + 1, worldY)) add(worldX + 1, worldY, worldX + 1, worldY + 1);
        if (!this.isMazeFloorCell(worldX, worldY + 1)) add(worldX + 1, worldY + 1, worldX, worldY + 1);
        if (!this.isMazeFloorCell(worldX - 1, worldY)) add(worldX, worldY + 1, worldX, worldY);
      }
    }
    return segments;
  }

  renderGameCanvas() {
    const canvas = this.dom.gameCanvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!this.ctx || width <= 0 || height <= 0) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
    background.addColorStop(0, "#111922");
    background.addColorStop(0.55, "#080c12");
    background.addColorStop(1, "#030508");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    this.drawWallTexture(ctx, width, height);
    if (!this.game.state) return;

    const view = this.getMainViewMetrics(width, height);
    const { tileSize, camera, enhanced } = view;
    const explored = new Set(this.game.state.explored);
    const wallBounds = this.getViewportRoomBounds(width, height, tileSize, camera);

    ctx.save();
    ctx.translate(camera.x, camera.y);

    for (let y = wallBounds.minY; y <= wallBounds.maxY; y += 1) {
      for (let x = wallBounds.minX; x <= wallBounds.maxX; x += 1) {
        const key = roomKey(x, y);
        const visible = enhanced || this.game.vision.visibleRooms.has(key);
        const drawable = visible || (!enhanced && explored.has(key));
        if (!drawable) continue;
        this.drawRoom(ctx, x, y, tileSize, visible ? 1 : 0.16);
        const mask = this.game.state.maze.bits[indexFor(x, y)];
        if ((mask & DIRECTIONS.right.bit) !== 0 && x + 1 < MAZE_SIZE) {
          const nextKey = roomKey(x + 1, y);
          const nextVisible = enhanced || this.game.vision.visibleRooms.has(nextKey);
          const nextDrawable = nextVisible || (!enhanced && explored.has(nextKey));
          const alpha = nextDrawable ? (visible || nextVisible ? 1 : 0.16) : visible ? 0.3 : 0;
          if (alpha > 0) this.drawCorridor(ctx, x, y, "right", tileSize, alpha);
        }
        if ((mask & DIRECTIONS.down.bit) !== 0 && y + 1 < MAZE_SIZE) {
          const nextKey = roomKey(x, y + 1);
          const nextVisible = enhanced || this.game.vision.visibleRooms.has(nextKey);
          const nextDrawable = nextVisible || (!enhanced && explored.has(nextKey));
          const alpha = nextDrawable ? (visible || nextVisible ? 1 : 0.16) : visible ? 0.3 : 0;
          if (alpha > 0) this.drawCorridor(ctx, x, y, "down", tileSize, alpha);
        }
      }
    }
    this.drawOpenIntersections(ctx, wallBounds, tileSize, enhanced, explored);

    // 合并房间与通道后只绘制可行走区域的统一外边界，避免共享墙重复叠亮。
    // 完整墙线仍预先存在，未知区域继续只由屏幕空间迷雾遮挡。
    this.drawMazeWalls(ctx, wallBounds, tileSize);

    for (const [key, entity] of Object.entries(this.game.state.maze.entities)) {
      const { x, y } = parseRoomKey(key);
      if (x < wallBounds.minX || x > wallBounds.maxX || y < wallBounds.minY || y > wallBounds.maxY) continue;
      const visible = enhanced || this.game.vision.visibleRooms.has(key);
      if (!visible) continue;
      const visibleDistance = this.game.vision.visibleRooms.get(key);
      if (entity.kind === "enemy" && entity.type === "ghost" && (visibleDistance === undefined ? Infinity : visibleDistance) > 1) continue;
      this.drawEntity(ctx, entity, x, y, tileSize, 1);
    }

    this.game.state.maze.exits.forEach((exit) => {
      const key = roomKey(exit.x, exit.y);
      if (exit.x < wallBounds.minX || exit.x > wallBounds.maxX || exit.y < wallBounds.minY || exit.y > wallBounds.maxY) return;
      if (!enhanced && !explored.has(key) && this.game.state.exitHintTurns <= 0) return;
      this.drawSprite(ctx, "exit", exit.x, exit.y, tileSize, enhanced || explored.has(key) ? 1 : 0.45);
    });

    this.drawAutoPath(ctx, tileSize);
    this.drawSprite(ctx, "player", this.game.state.player.x, this.game.state.player.y, tileSize, 1, true);
    if (!enhanced) this.drawWorldFogCells(ctx, wallBounds, tileSize, false, explored);
    ctx.restore();

    if (!enhanced) this.drawFogOverlay(ctx, width, height, false);
  }

  drawAutoPath(ctx, tileSize) {
    if (!this.game.movement.autoPathTarget || !this.game.movement.autoPath.length) return;
    const points = [{ x: this.game.state.player.x, y: this.game.state.player.y }].concat(this.game.movement.autoPath);
    ctx.save();
    ctx.setLineDash([Math.max(2, tileSize * 0.22), Math.max(2, tileSize * 0.2)]);
    ctx.strokeStyle = "rgba(255, 200, 92, 0.72)";
    ctx.lineWidth = Math.max(1.2, tileSize * 0.08);
    ctx.beginPath();
    points.forEach((point, index) => {
      const world = this.roomWorldCenter(point.x, point.y);
      if (index === 0) ctx.moveTo(world.x * tileSize, world.y * tileSize);
      else ctx.lineTo(world.x * tileSize, world.y * tileSize);
    });
    ctx.stroke();
    const targetWorld = this.roomWorldCenter(this.game.movement.autoPathTarget.x, this.game.movement.autoPathTarget.y);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#ffc85c";
    ctx.lineWidth = Math.max(1.4, tileSize * 0.1);
    ctx.beginPath();
    ctx.arc(targetWorld.x * tileSize, targetWorld.y * tileSize, tileSize * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawWorldFogCells(ctx, bounds, tileSize, enhanced, explored) {
    if (enhanced) return;
    const cellSize = ROOM_SPAN * tileSize;
    ctx.save();
    ctx.fillStyle = "#010306";
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const key = roomKey(x, y);
        if (this.game.vision.visibleRooms.has(key)) continue;
        const remembered = !enhanced && explored.has(key);
        const baseAlpha = remembered ? 0.5 : enhanced ? 0.88 : 0.82;
        const variation = (hashString(`fog-${key}`) % 5) * 0.01;
        ctx.globalAlpha = Math.min(0.94, baseAlpha + variation);
        ctx.fillRect(
          x * cellSize - 0.5,
          y * cellSize - 0.5,
          cellSize + 1,
          cellSize + 1
        );
      }
    }
    ctx.restore();
  }

  drawFogOverlay(ctx, width, height, enhanced) {
    if (enhanced) return;
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    const innerRadius = shortestSide * (enhanced ? 0.43 : 0.17);
    const outerRadius = enhanced ? longestSide * 0.68 : shortestSide * 0.47;
    const fog = ctx.createRadialGradient(
      width / 2,
      height / 2,
      innerRadius,
      width / 2,
      height / 2,
      outerRadius
    );
    fog.addColorStop(0, "rgba(1, 3, 6, 0.015)");
    fog.addColorStop(0.42, enhanced ? "rgba(2, 5, 8, 0.06)" : "rgba(2, 5, 8, 0.22)");
    fog.addColorStop(0.72, enhanced ? "rgba(2, 4, 7, 0.34)" : "rgba(2, 4, 7, 0.74)");
    fog.addColorStop(1, enhanced ? "rgba(1, 2, 4, 0.9)" : "rgba(1, 2, 4, 0.955)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);

    const haze = ctx.createLinearGradient(0, 0, 0, height);
    haze.addColorStop(0, enhanced ? "rgba(80, 101, 112, 0.16)" : "rgba(80, 101, 112, 0.26)");
    haze.addColorStop(0.24, "rgba(32, 47, 56, 0)");
    haze.addColorStop(0.72, "rgba(32, 47, 56, 0)");
    haze.addColorStop(1, enhanced ? "rgba(70, 87, 96, 0.12)" : "rgba(70, 87, 96, 0.22)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);
  }

  drawWallTexture(ctx, width, height) {
    ctx.save();
    // 背景只保留不规则石屑，不再绘制屏幕坐标砖缝，避免与世界坐标墙体产生错位感。
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#566370";
    for (let y = 17; y < height; y += 43) {
      for (let x = 13; x < width; x += 47) {
        if (hashString(`texture-${x}-${y}`) % 4 !== 0) continue;
        const size = 1 + (hashString(`texture-size-${x}-${y}`) % 3);
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.restore();
  }

  roomWorldCenter(x, y) {
    return { x: x * ROOM_SPAN + 2.5, y: y * ROOM_SPAN + 2.5 };
  }

  drawRoom(ctx, x, y, tileSize, alpha) {
    const startX = (x * ROOM_SPAN + 1) * tileSize;
    const startY = (y * ROOM_SPAN + 1) * tileSize;
    const size = ROOM_FLOOR_SIZE * tileSize;
    this.drawFloorBlock(ctx, startX, startY, size, size, tileSize, alpha, x, y);
  }

  drawCorridor(ctx, x, y, direction, tileSize, alpha) {
    if (direction === "right") {
      const startX = (x * ROOM_SPAN + 4) * tileSize;
      const startY = (y * ROOM_SPAN + 1) * tileSize;
      this.drawFloorBlock(ctx, startX, startY, tileSize, ROOM_FLOOR_SIZE * tileSize, tileSize, alpha, x + 17, y);
    } else {
      const startX = (x * ROOM_SPAN + 1) * tileSize;
      const startY = (y * ROOM_SPAN + 4) * tileSize;
      this.drawFloorBlock(ctx, startX, startY, ROOM_FLOOR_SIZE * tileSize, tileSize, tileSize, alpha, x, y + 17);
    }
  }

  drawOpenIntersections(ctx, bounds, tileSize, enhanced, explored) {
    const minPivotX = Math.max(1, bounds.minX);
    const maxPivotX = Math.min(MAZE_SIZE - 1, bounds.maxX + 1);
    const minPivotY = Math.max(1, bounds.minY);
    const maxPivotY = Math.min(MAZE_SIZE - 1, bounds.maxY + 1);
    for (let pivotY = minPivotY; pivotY <= maxPivotY; pivotY += 1) {
      for (let pivotX = minPivotX; pivotX <= maxPivotX; pivotX += 1) {
        const worldX = pivotX * ROOM_SPAN;
        const worldY = pivotY * ROOM_SPAN;
        if (!this.isRemovableWallPillar(worldX, worldY)) continue;
        const adjacentRooms = [
          roomKey(pivotX - 1, pivotY - 1), roomKey(pivotX, pivotY - 1),
          roomKey(pivotX - 1, pivotY), roomKey(pivotX, pivotY)
        ];
        const visible = enhanced || adjacentRooms.some((key) => this.game.vision.visibleRooms.has(key));
        const remembered = adjacentRooms.some((key) => explored.has(key));
        if (!visible && !remembered) continue;
        this.drawFloorBlock(
          ctx,
          worldX * tileSize,
          worldY * tileSize,
          tileSize,
          tileSize,
          tileSize,
          visible ? 1 : 0.16,
          pivotX + 101,
          pivotY + 101
        );
      }
    }
  }

  drawFloorBlock(ctx, x, y, width, height, tileSize, alpha, seedX, seedY) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, "#263744");
    gradient.addColorStop(1, "#14212b");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "rgba(178, 194, 204, 0.22)";
    ctx.lineWidth = Math.max(0.6, tileSize * 0.035);
    for (let gx = x; gx <= x + width + 0.1; gx += tileSize) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + height);
      ctx.stroke();
    }
    for (let gy = y; gy <= y + height + 0.1; gy += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + width, gy);
      ctx.stroke();
    }
    const noise = hashString(`${seedX},${seedY}`) % 5;
    if (noise === 0 && width >= tileSize * 2 && height >= tileSize * 2) {
      ctx.fillStyle = "rgba(80, 116, 82, 0.12)";
      ctx.fillRect(x + tileSize * 0.25, y + tileSize * 1.7, tileSize * 0.6, tileSize * 0.18);
    }
    ctx.restore();
  }

  drawEntity(ctx, entity, x, y, tileSize, alpha) {
    if (entity.kind === "pickup") {
      this.drawSprite(ctx, ITEM_DEFS[entity.itemType].asset, x, y, tileSize, alpha);
      return;
    }
    if (entity.kind === "event") {
      this.drawSprite(ctx, EVENT_DEFS[entity.type].asset, x, y, tileSize, alpha);
      return;
    }
    if (entity.kind === "enemy") {
      const asset = entity.type === "mimic" && !entity.revealed ? "chest" : ENEMY_DEFS[entity.type].asset;
      this.drawSprite(ctx, asset, x, y, tileSize, alpha);
      if (alpha >= 0.9 && !(entity.type === "mimic" && !entity.revealed)) {
        const world = this.roomWorldCenter(x, y);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(4, 5, 8, 0.84)";
        ctx.fillRect(world.x * tileSize - tileSize * 0.72, world.y * tileSize - tileSize * 1.4, tileSize * 1.44, tileSize * 0.52);
        ctx.fillStyle = "#ff6262";
        ctx.font = `700 ${Math.max(9, tileSize * 0.38)}px ui-sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${entity.hp} HP`, world.x * tileSize, world.y * tileSize - tileSize * 1.14);
        ctx.restore();
      }
    }
  }

  drawSprite(ctx, assetKey, roomX, roomY, tileSize, alpha, player = false) {
    const image = this.assets.get();
    const frame = SPRITE_ATLAS.frames[assetKey] || SPRITE_ATLAS.frames["event-map"];
    const world = this.roomWorldCenter(roomX, roomY);
    const centerX = world.x * tileSize;
    const centerY = world.y * tileSize;
    const size = tileSize * (player ? 2.25 : 2.05);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (player) {
      const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size * 0.72);
      glow.addColorStop(0, "rgba(97, 217, 242, 0.34)");
      glow.addColorStop(1, "rgba(97, 217, 242, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, size * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    if (image) {
      const sourceWidth = image.naturalWidth / SPRITE_ATLAS.columns;
      const sourceHeight = image.naturalHeight / SPRITE_ATLAS.rows;
      ctx.drawImage(
        image,
        frame[0] * sourceWidth,
        frame[1] * sourceHeight,
        sourceWidth,
        sourceHeight,
        centerX - size / 2,
        centerY - size / 2,
        size,
        size
      );
    } else {
      ctx.fillStyle = player ? "#61d9f2" : "#d8ae5b";
      ctx.beginPath();
      ctx.arc(centerX, centerY, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

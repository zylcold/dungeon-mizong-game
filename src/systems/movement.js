/** 移动、自动寻路与逐步效果结算。 */
import { AUTO_PATH_DELAY, DIRECTIONS, DIRECTION_LIST, POISON_DAMAGE_PER_STEP, ROOM_SPAN } from "../config.js";
import { inBounds, indexFor, roomKey } from "../core/coordinates.js";
import { getConnectedNeighbors } from "../core/maze.js";

export class MovementSystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.autoPath = [];
    this.autoPathTarget = null;
    this.autoPathTimer = null;
  }

  moveFromVector(dx, dy, threshold) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    this.cancelAutoPath();
    if (Math.abs(dx) > Math.abs(dy)) {
      this.attemptMove(dx > 0 ? "right" : "left");
    } else {
      this.attemptMove(dy > 0 ? "down" : "up");
    }
  }

  handleCanvasTap(clientX, clientY) {
    if (!this.game.state || !this.game.state.active) return;
    const rect = this.dom.gameCanvas.getBoundingClientRect();
    const view = this.game.renderer.getMainViewMetrics(rect.width, rect.height);
    const worldX = (clientX - rect.left - view.camera.x) / view.tileSize;
    const worldY = (clientY - rect.top - view.camera.y) / view.tileSize;
    const target = {
      x: Math.round((worldX - 2.5) / ROOM_SPAN),
      y: Math.round((worldY - 2.5) / ROOM_SPAN)
    };
    this.startAutoPath(target);
  }

  handleFullMapTap(event) {
    if (!this.game.maps.fullMapTransform || !this.game.state || !this.game.state.active) return;
    const rect = this.dom.fullMapCanvas.getBoundingClientRect();
    const pointX = event.clientX - rect.left;
    const pointY = event.clientY - rect.top;
    const target = {
      x: Math.round((pointX - this.game.maps.fullMapTransform.offsetX) / this.game.maps.fullMapTransform.scale),
      y: Math.round((pointY - this.game.maps.fullMapTransform.offsetY) / this.game.maps.fullMapTransform.scale)
    };
    if (!inBounds(target.x, target.y) || !this.game.state.explored.includes(roomKey(target.x, target.y))) {
      this.game.ui.showToast("只能选择已经探索的格子");
      return;
    }
    this.dom.mapOverlay.hidden = true;
    this.startAutoPath(target);
  }

  findExploredPath(target) {
    if (!inBounds(target.x, target.y)) return [];
    const explored = new Set(this.game.state.explored);
    const targetKey = roomKey(target.x, target.y);
    if (!explored.has(targetKey)) return [];
    const start = { x: this.game.state.player.x, y: this.game.state.player.y };
    const queue = [start];
    const parents = new Map([[roomKey(start.x, start.y), null]]);
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      if (current.x === target.x && current.y === target.y) break;
      for (const next of getConnectedNeighbors(this.game.state.maze.bits, current.x, current.y)) {
        const nextKey = roomKey(next.x, next.y);
        if (!explored.has(nextKey) || parents.has(nextKey)) continue;
        parents.set(nextKey, current);
        queue.push({ x: next.x, y: next.y });
      }
    }
    if (!parents.has(targetKey)) return [];
    const path = [];
    let current = target;
    while (current) {
      path.push(current);
      current = parents.get(roomKey(current.x, current.y));
    }
    return path.reverse();
  }

  startAutoPath(target) {
    this.cancelAutoPath();
    if (!this.game.state || !this.game.state.active || this.game.pending || !inBounds(target.x, target.y)) return false;
    const targetKey = roomKey(target.x, target.y);
    if (!this.game.state.explored.includes(targetKey)) {
      this.game.ui.showStatus("只能自动前往已经探索的区域");
      return false;
    }
    const path = this.findExploredPath(target);
    if (!path.length) {
      this.game.ui.showStatus("已探索区域之间暂时没有通路");
      return false;
    }
    if (path.length === 1) {
      this.game.ui.showStatus("你已经在这里");
      return true;
    }
    this.autoPath = path.slice(1);
    this.autoPathTarget = { x: target.x, y: target.y };
    this.game.ui.showStatus(`自动寻路 · ${this.autoPath.length} 步`);
    this.game.renderer.render();
    this.scheduleAutoPathStep();
    return true;
  }

  scheduleAutoPathStep() {
    clearTimeout(this.autoPathTimer);
    this.autoPathTimer = setTimeout(() => this.runAutoPathStep(), AUTO_PATH_DELAY);
  }

  runAutoPathStep() {
    this.autoPathTimer = null;
    if (!this.autoPath.length || !this.game.state || !this.game.state.active || this.game.pending
      || !this.dom.storyOverlay.hidden || !this.dom.endOverlay.hidden || !this.dom.mapOverlay.hidden) {
      this.cancelAutoPath(Boolean(this.autoPath.length));
      return false;
    }
    const next = this.autoPath.shift();
    const dx = next.x - this.game.state.player.x;
    const dy = next.y - this.game.state.player.y;
    const direction = DIRECTION_LIST.find(([, value]) => value.dx === dx && value.dy === dy);
    if (!direction || !this.attemptMove(direction[0], { auto: true })) {
      this.cancelAutoPath(true);
      return false;
    }
    if (this.game.pending || !this.dom.storyOverlay.hidden || !this.game.state.active) {
      this.cancelAutoPath(true);
      return false;
    }
    if (this.autoPath.length) {
      this.scheduleAutoPathStep();
    } else {
      this.autoPathTarget = null;
      this.game.ui.showStatus("已到达目标位置");
      this.game.renderer.render();
    }
    return true;
  }

  cancelAutoPath(showMessage = false) {
    const wasRunning = this.autoPath.length > 0;
    clearTimeout(this.autoPathTimer);
    this.autoPathTimer = null;
    this.autoPath = [];
    this.autoPathTarget = null;
    if (showMessage && wasRunning) this.game.ui.showStatus("自动寻路已停止");
  }

  attemptMove(directionName, options = {}) {
    if (!options.auto) this.cancelAutoPath();
    if (!this.game.state || !this.game.state.active || this.game.pending || !this.dom.startOverlay.hidden || !this.dom.storyOverlay.hidden || !this.dom.endOverlay.hidden || !this.dom.mapOverlay.hidden) return false;
    const direction = DIRECTIONS[directionName];
    if (!direction) return false;
    const currentMask = this.game.state.maze.bits[indexFor(this.game.state.player.x, this.game.state.player.y)];
    if ((currentMask & direction.bit) === 0) {
      this.game.ui.showStatus("前方是墙壁");
      return false;
    }
    const target = {
      x: this.game.state.player.x + direction.dx,
      y: this.game.state.player.y + direction.dy
    };
    const key = roomKey(target.x, target.y);
    const entity = this.game.state.maze.entities[key];
    if (entity && entity.kind === "enemy") {
      if (entity.type === "mimic") entity.revealed = true;
      this.game.combat.openEnemyEncounter(entity, target, key, false);
      this.game.renderer.render();
      return false;
    }
    return this.commitMove(target);
  }

  commitMove(target, options = {}) {
    if (!this.game.state || !this.game.state.active) return false;
    const previousKey = roomKey(this.game.state.player.x, this.game.state.player.y);
    const targetKey = roomKey(target.x, target.y);
    this.game.state.player = { x: target.x, y: target.y };
    this.game.state.totalSteps += 1;
    this.game.state.path.push({ x: target.x, y: target.y, teleport: Boolean(options.teleport) });
    if (targetKey !== previousKey) this.game.state.dismissedKey = null;
    this.tickEffects();
    if (!this.game.state.active) return false;
    this.game.vision.updateVisibility();
    if (!options.skipTrigger) this.game.events.triggerCurrentRoom();
    this.game.story.maybeAddAmbientLog();
    this.game.ui.updateUI();
    this.game.save();
    this.game.renderer.render();
    return true;
  }

  tickEffects() {
    const state = this.game.state;
    if (state.visionTurns > 0) {
      state.visionTurns -= 1;
      if (state.visionTurns === 0) {
        this.game.ui.addLog("vision", "◉", `视野效果结束，地图恢复原始比例，迷雾重新笼罩四周`);
      }
    }
    if (state.fogTurns > 0) {
      state.fogTurns -= 1;
      if (state.fogTurns === 0) this.game.ui.addLog("vision", "☀", "你走出了浓雾区域");
    }
    if (state.exitHintTurns > 0) state.exitHintTurns -= 1;
    if (state.poisonTurns > 0) {
      state.poisonTurns -= 1;
      state.hp = Math.max(0, state.hp - POISON_DAMAGE_PER_STEP);
      this.game.ui.addLog("damage", "◆", `毒素发作，损失 ${POISON_DAMAGE_PER_STEP} 点生命${state.poisonTurns ? `（剩余 ${state.poisonTurns} 步）` : ""}`);
      if (state.hp <= 0) this.game.endGame("毒素耗尽了你的生命");
    }
  }
}

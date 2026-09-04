/** 可见房间计算与永久探索记录。 */
import { DEFAULT_VISION_RADIUS, FOG_VISION_RADIUS } from "../config.js";
import { roomKey } from "../core/coordinates.js";
import { getConnectedNeighbors } from "../core/maze.js";

export class VisionSystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.visibleRooms = new Map();
  }

  getVisionRadius() {
    return this.getVisionConfig().radius;
  }

  getVisionRoomLimit() {
    return this.getVisionConfig().limit;
  }

  getVisionConfig() {
    if (!this.game.state) return { radius: DEFAULT_VISION_RADIUS, limit: Infinity, enhanced: false };
    if (this.game.state.visionTurns > 0) return { radius: Infinity, limit: Infinity, enhanced: true };
    if (this.game.state.fogTurns > 0) return { radius: FOG_VISION_RADIUS, limit: Infinity, enhanced: false };
    return { radius: DEFAULT_VISION_RADIUS, limit: Infinity, enhanced: false };
  }

  collectVisibleRooms(radius, limit = Infinity) {
    const start = this.game.state.player;
    const queue = [{ x: start.x, y: start.y, distance: 0 }];
    const visible = new Map([[roomKey(start.x, start.y), 0]]);
    let cursor = 0;
    while (cursor < queue.length && visible.size < limit) {
      const current = queue[cursor++];
      if (current.distance >= radius) continue;
      for (const next of getConnectedNeighbors(this.game.state.maze.bits, current.x, current.y)) {
        const key = roomKey(next.x, next.y);
        if (visible.has(key)) continue;
        const distance = current.distance + 1;
        visible.set(key, distance);
        queue.push({ x: next.x, y: next.y, distance });
        if (visible.size >= limit) break;
      }
    }
    return visible;
  }

  updateVisibility() {
    if (!this.game.state) return;
    const config = this.getVisionConfig();
    // 视野道具关闭主画面迷雾，但只把玩家身边两格写入永久探索记录。
    // 这样无需每一步遍历整张大型地图，也不会把临时视野写入缩略图。
    const visible = config.enhanced
      ? this.collectVisibleRooms(DEFAULT_VISION_RADIUS)
      : this.collectVisibleRooms(config.radius, config.limit);
    this.visibleRooms = visible;
    const explored = new Set(this.game.state.explored);
    visible.forEach((_, key) => explored.add(key));
    this.game.state.explored = [...explored];
    this.game.state.stats.rooms = Math.max(this.game.state.stats.rooms, explored.size);
  }
}

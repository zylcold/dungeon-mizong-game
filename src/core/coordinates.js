/** 逻辑房间坐标与数组索引。 */
import { MAZE_SIZE } from "../config.js";

export function roomKey(x, y) {
  return `${x},${y}`;
}

export function parseRoomKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function indexFor(x, y) {
  return y * MAZE_SIZE + x;
}

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAZE_SIZE && y < MAZE_SIZE;
}

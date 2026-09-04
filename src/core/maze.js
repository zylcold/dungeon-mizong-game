/** 迷宫生成、拓扑查询与最短路径；不依赖界面。 */
import { DIRECTIONS, DIRECTION_LIST, ENEMY_DENSITY_MAX, ENEMY_DENSITY_MIN, EXIT_SAFE_PATH_ROOMS, EXIT_SAFE_RADIUS, MAZE_SIZE } from "../config.js";
import { inBounds, indexFor, roomKey } from "./coordinates.js";
import { mulberry32, shuffled, weightedPick } from "./random.js";
import { ENEMY_DEFS } from "../data/catalog.js";

export function connectRooms(bits, x, y, direction) {
  const definition = DIRECTIONS[direction];
  const nx = x + definition.dx;
  const ny = y + definition.dy;
  if (!inBounds(nx, ny)) return false;
  bits[indexFor(x, y)] |= definition.bit;
  bits[indexFor(nx, ny)] |= definition.opposite;
  return true;
}

export function getConnectedNeighbors(bits, x, y) {
  const mask = bits[indexFor(x, y)];
  const neighbors = [];
  for (const [name, direction] of DIRECTION_LIST) {
    if ((mask & direction.bit) !== 0) {
      neighbors.push({ name, x: x + direction.dx, y: y + direction.dy });
    }
  }
  return neighbors;
}

export function shortestPath(bits, start, target) {
  const queue = [start];
  const parents = new Map([[roomKey(start.x, start.y), null]]);
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (current.x === target.x && current.y === target.y) break;
    for (const next of getConnectedNeighbors(bits, current.x, current.y)) {
      const key = roomKey(next.x, next.y);
      if (parents.has(key)) continue;
      parents.set(key, current);
      queue.push(next);
    }
  }
  const targetKey = roomKey(target.x, target.y);
  if (!parents.has(targetKey)) return [];
  const path = [];
  let current = target;
  while (current) {
    path.push(current);
    current = parents.get(roomKey(current.x, current.y));
  }
  return path.reverse();
}

export function chooseEnemyType(rng) {
  const choices = [
    { value: "rat", weight: 7 },
    { value: "skeleton", weight: 7 },
    { value: "slime", weight: 5 },
    { value: "ghost", weight: 4 },
    { value: "mimic", weight: 3 }
  ];
  return weightedPick(choices, rng);
}

export function createEnemy(type, rng) {
  const definition = ENEMY_DEFS[type];
  const base = definition.minHp + Math.floor(rng() * (definition.maxHp - definition.minHp + 1));
  return {
    kind: "enemy",
    type,
    hp: base,
    revealed: type !== "mimic"
  };
}

export function generateMaze(seed) {
  const rng = mulberry32(seed);
  const bits = new Array(MAZE_SIZE * MAZE_SIZE).fill(0);
  const center = Math.floor(MAZE_SIZE / 2);
  const visited = new Set([roomKey(center, center)]);
  const active = [{ x: center, y: center }];
  const newestBias = 0.42 + rng() * 0.4;

  // Growing Tree：每张地图随机混合深度优先与随机前沿，减少固定长走廊形态。
  while (active.length) {
    const activeIndex = rng() < newestBias ? active.length - 1 : Math.floor(rng() * active.length);
    const current = active[activeIndex];
    const candidates = shuffled(DIRECTION_LIST, rng)
      .map(([name, direction]) => ({
        name,
        x: current.x + direction.dx,
        y: current.y + direction.dy
      }))
      .filter((candidate) => inBounds(candidate.x, candidate.y) && !visited.has(roomKey(candidate.x, candidate.y)));

    if (!candidates.length) {
      active.splice(activeIndex, 1);
      continue;
    }

    const next = candidates[0];
    connectRooms(bits, current.x, current.y, next.name);
    visited.add(roomKey(next.x, next.y));
    active.push({ x: next.x, y: next.y });
  }

  // 打开大量额外墙段形成环路；优先消除死胡同，不再保证唯一路线。
  const closedWalls = [];
  for (let y = 0; y < MAZE_SIZE; y += 1) {
    for (let x = 0; x < MAZE_SIZE; x += 1) {
      for (const name of ["right", "down"]) {
        const direction = DIRECTIONS[name];
        const nx = x + direction.dx;
        const ny = y + direction.dy;
        if (!inBounds(nx, ny) || (bits[indexFor(x, y)] & direction.bit) !== 0) continue;
        const deadEnd = getConnectedNeighbors(bits, x, y).length === 1
          || getConnectedNeighbors(bits, nx, ny).length === 1;
        closedWalls.push({ x, y, name, deadEnd });
      }
    }
  }
  const orderedWalls = [
    ...shuffled(closedWalls.filter((wall) => wall.deadEnd), rng),
    ...shuffled(closedWalls.filter((wall) => !wall.deadEnd), rng)
  ];
  const loopRate = 0.18 + rng() * 0.1;
  const loopTarget = Math.min(orderedWalls.length, Math.floor(MAZE_SIZE * MAZE_SIZE * loopRate));
  for (let i = 0; i < loopTarget; i += 1) {
    const wall = orderedWalls[i];
    connectRooms(bits, wall.x, wall.y, wall.name);
  }

  const perimeter = [];
  for (let i = 0; i < MAZE_SIZE; i += 1) {
    perimeter.push({ x: i, y: 0 }, { x: i, y: MAZE_SIZE - 1 });
    if (i > 0 && i < MAZE_SIZE - 1) {
      perimeter.push({ x: 0, y: i }, { x: MAZE_SIZE - 1, y: i });
    }
  }

  const exitCount = 1 + Math.floor(rng() * 3);
  const exits = [];
  for (const candidate of shuffled(perimeter, rng)) {
    const farEnoughFromCenter = Math.abs(candidate.x - center) + Math.abs(candidate.y - center) >= Math.floor(MAZE_SIZE * 0.72);
    const separated = exits.every((exit) => Math.abs(exit.x - candidate.x) + Math.abs(exit.y - candidate.y) >= Math.floor(MAZE_SIZE * 0.62));
    if (farEnoughFromCenter && separated) exits.push(candidate);
    if (exits.length === exitCount) break;
  }
  if (!exits.length) exits.push({ x: 0, y: 0 });

  const exitSafeRooms = new Set();
  exits.forEach((exit) => {
    for (let dy = -EXIT_SAFE_RADIUS; dy <= EXIT_SAFE_RADIUS; dy += 1) {
      for (let dx = -EXIT_SAFE_RADIUS; dx <= EXIT_SAFE_RADIUS; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > EXIT_SAFE_RADIUS) continue;
        const x = exit.x + dx;
        const y = exit.y + dy;
        if (inBounds(x, y)) exitSafeRooms.add(roomKey(x, y));
      }
    }
    const approachPath = shortestPath(bits, { x: center, y: center }, exit);
    approachPath.slice(-EXIT_SAFE_PATH_ROOMS).forEach((room) => {
      exitSafeRooms.add(roomKey(room.x, room.y));
    });
  });

  // 出口及最后一段接近路线保持为空，避免越过出口后仍出现怪物或宝箱。
  const occupied = new Set(exitSafeRooms);
  const entities = {};

  const available = shuffled(
    Array.from({ length: MAZE_SIZE * MAZE_SIZE }, (_, index) => ({
      x: index % MAZE_SIZE,
      y: Math.floor(index / MAZE_SIZE)
    })).filter((room) => {
      const distance = Math.abs(room.x - center) + Math.abs(room.y - center);
      return distance > 2 && !occupied.has(roomKey(room.x, room.y));
    }),
    rng
  );

  let cursor = 0;
  const takeRoom = () => available[cursor++];
  const enemyDensity = ENEMY_DENSITY_MIN + rng() * (ENEMY_DENSITY_MAX - ENEMY_DENSITY_MIN);
  const enemyCount = Math.floor(MAZE_SIZE * MAZE_SIZE * enemyDensity);
  for (let i = 0; i < enemyCount; i += 1) {
    const room = takeRoom();
    if (!room) break;
    const type = chooseEnemyType(rng);
    entities[roomKey(room.x, room.y)] = createEnemy(type, rng);
  }

  const eventWeights = [
    { value: "chest", weight: 7 },
    { value: "fountain", weight: 5 },
    { value: "trap", weight: 6 },
    { value: "map", weight: 4 },
    { value: "shrine", weight: 4 },
    { value: "corpse", weight: 5 },
    { value: "fog", weight: 4 },
    { value: "portal", weight: 3 },
    { value: "door", weight: 3 },
    { value: "roots", weight: 4 },
    { value: "echo", weight: 4 },
    { value: "cache", weight: 4 }
  ];
  const eventCount = Math.floor(MAZE_SIZE * MAZE_SIZE * 0.035);
  for (let i = 0; i < eventCount; i += 1) {
    const room = takeRoom();
    if (!room) break;
    entities[roomKey(room.x, room.y)] = {
      kind: "event",
      type: weightedPick(eventWeights, rng)
    };
  }

  const itemCount = Math.floor(MAZE_SIZE * MAZE_SIZE * 0.012);
  for (let i = 0; i < itemCount; i += 1) {
    const room = takeRoom();
    if (!room) break;
    const itemType = weightedPick([
      { value: "potion", weight: 4 },
      { value: "vision", weight: 3 },
      { value: "execute", weight: 2 },
      { value: "teleport", weight: 2 }
    ], rng);
    entities[roomKey(room.x, room.y)] = { kind: "pickup", itemType };
  }

  return {
    seed,
    bits,
    exits,
    entities,
    roomCount: MAZE_SIZE * MAZE_SIZE,
    loopCount: loopTarget
  };
}

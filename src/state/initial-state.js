/** 创建可持久化的游戏初始状态。 */
import { MAZE_SIZE, NORMAL_STORY_MIN_GAP_STEPS, SAVE_VERSION, STORY_TRIGGER_VERSION } from "../config.js";
import { generateMaze } from "../core/maze.js";
import { mulberry32, randomSeed } from "../core/random.js";

export function createInitialState() {
  const seed = randomSeed();
  const center = Math.floor(MAZE_SIZE / 2);
  const maze = generateMaze(seed);
  return {
    version: SAVE_VERSION,
    active: true,
    totalSteps: 0,
    hp: 100,
    maxHp: 100,
    inventory: { potion: 1, vision: 0, execute: 0, teleport: 0 },
    visionTurns: 0,
    fogTurns: 0,
    poisonTurns: 0,
    exitHintTurns: 0,
    player: { x: center, y: center },
    explored: [],
    path: [{ x: center, y: center, teleport: false }],
    maze,
    logs: [],
    dismissedKey: null,
    discoveredExits: [],
    storyScenes: [],
    loreSeen: [],
    storyTriggerVersion: STORY_TRIGGER_VERSION,
    lastStoryStep: -NORMAL_STORY_MIN_GAP_STEPS,
    lastNormalStoryStep: -NORMAL_STORY_MIN_GAP_STEPS,
    currentStory: null,
    nextAmbientStep: 7 + Math.floor(mulberry32(seed ^ 0xa5a5a5a5)() * 7),
    stats: {
      enemies: 0,
      chests: 0,
      items: 0,
      events: 0,
      rooms: 1
    },
    startedAt: Date.now()
  };
}

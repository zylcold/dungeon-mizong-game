/** 游戏与兼容性参数；不依赖 DOM。 */


export const STORAGE_KEY = "dungeon-mizong-save-v1";

export const RECORD_KEY = "dungeon-mizong-records-v1";

export const DIARY_KEY = "dungeon-mizong-diary-v1";

export const APP_VERSION = "1.12.0";

export const SAVE_VERSION = 4;

export const STORY_TRIGGER_VERSION = 3;

export const STORY_COOLDOWN_STEPS = 30;

export const NORMAL_STORY_MIN_GAP_STEPS = 20;

export const NORMAL_STORY_GAP_JITTER_STEPS = 10;

export const STORY_PRIORITY = {
  item: 100,
  event: 200,
  enemy: 300,
  health: 400,
  intro: 1000
};

export const MAZE_SIZE = 135;

export const ROOM_SPAN = 4;

export const ROOM_FLOOR_SIZE = 3;

export const MAX_LOGS = 200;

export const DEFAULT_VISION_RADIUS = 2;

export const FOG_VISION_RADIUS = 1;

export const VISION_DURATION = 30;

export const VISION_ZOOM_SCALE = 0.5;

export const AUTO_PATH_DELAY = 95;

export const WALL_RENDER_ALPHA = 0.9;

export const WALL_RENDER_MARGIN_ROOMS = 3;

export const ENEMY_DENSITY_MIN = 0.045;

export const ENEMY_DENSITY_MAX = 0.06;

export const ENEMY_CHEST_DROP_RATE = 0.28;

export const POISON_DAMAGE_PER_STEP = 2;

export const SLIME_POISON_DURATION = 3;

export const EXIT_SAFE_RADIUS = 2;

export const EXIT_SAFE_PATH_ROOMS = 4;

export const MOBILE_SAFE_TOP_FALLBACK = 96;

export const DIRECTIONS = {
  up: { dx: 0, dy: -1, bit: 1, opposite: 4 },
  right: { dx: 1, dy: 0, bit: 2, opposite: 8 },
  down: { dx: 0, dy: 1, bit: 4, opposite: 1 },
  left: { dx: -1, dy: 0, bit: 8, opposite: 2 }
};

export const DIRECTION_LIST = Object.entries(DIRECTIONS);

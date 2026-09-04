/** 离线 PNG 图集帧索引。 */


export const SPRITE_ATLAS = {
  url: "assets/sprites-atlas.png",
  columns: 5,
  rows: 4,
  frames: {
    player: [0, 0],
    chest: [1, 0],
    exit: [2, 0],
    "item-potion": [3, 0],
    "item-vision": [4, 0],
    "item-execute": [0, 1],
    "item-teleport": [1, 1],
    "enemy-rat": [2, 1],
    "enemy-skeleton": [3, 1],
    "enemy-slime": [4, 1],
    "enemy-ghost": [0, 2],
    "enemy-mimic": [1, 2],
    "enemy-guardian": [2, 2],
    "event-fountain": [3, 2],
    "event-trap": [4, 2],
    "event-map": [0, 3],
    "event-shrine": [1, 3],
    "event-portal": [2, 3],
    "event-corpse": [3, 3],
    "event-door": [4, 3]
  }
};

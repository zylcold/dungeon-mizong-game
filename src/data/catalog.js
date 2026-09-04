/** 敌人、道具与事件定义。 */


export const ITEM_DEFS = {
  potion: { name: "恢复药剂", asset: "item-potion", icon: "✚" },
  vision: { name: "视野拓宽", asset: "item-vision", icon: "◉" },
  execute: { name: "一击必杀", asset: "item-execute", icon: "⚔" },
  teleport: { name: "瞬移卷轴", asset: "item-teleport", icon: "✦" }
};

export const ENEMY_DEFS = {
  rat: {
    name: "地穴鼠",
    asset: "enemy-rat",
    icon: "♞",
    minHp: 6,
    maxHp: 12,
    scale: 1,
    description: "成群出没的弱小敌人，没有特殊能力。"
  },
  skeleton: {
    name: "骷髅守卫",
    asset: "enemy-skeleton",
    icon: "☠",
    minHp: 15,
    maxHp: 25,
    scale: 2,
    description: "沉默地守在通道中，以自身血量作为战斗消耗。"
  },
  slime: {
    name: "毒史莱姆",
    asset: "enemy-slime",
    icon: "●",
    minHp: 12,
    maxHp: 20,
    scale: 1.5,
    description: "击败后会使你中毒，接下来三步持续损失生命。"
  },
  ghost: {
    name: "游荡幽灵",
    asset: "enemy-ghost",
    icon: "◌",
    minHp: 18,
    maxHp: 28,
    scale: 2,
    description: "只有靠近到一格时才会显形。"
  },
  mimic: {
    name: "宝箱怪",
    asset: "enemy-mimic",
    icon: "▣",
    minHp: 22,
    maxHp: 35,
    scale: 2,
    description: "在你靠近前，它看起来和普通宝箱没有区别。"
  },
  guardian: {
    name: "出口守卫",
    asset: "enemy-guardian",
    icon: "♜",
    minHp: 35,
    maxHp: 55,
    scale: 3,
    description: "盘踞在出口附近的强敌，血量远高于普通怪物。"
  }
};

export const EVENT_DEFS = {
  chest: { name: "封尘宝箱", asset: "chest", icon: "▣", category: "item" },
  fountain: { name: "生命泉", asset: "event-fountain", icon: "✚", category: "heal" },
  trap: { name: "地刺陷阱", asset: "event-trap", icon: "⌁", category: "damage" },
  map: { name: "地图残片", asset: "event-map", icon: "⌖", category: "vision" },
  shrine: { name: "古老祭坛", asset: "event-shrine", icon: "◇", category: "system" },
  corpse: { name: "冒险者遗骸", asset: "event-corpse", icon: "☠", category: "system" },
  fog: { name: "浓雾区域", asset: "enemy-ghost", icon: "≋", category: "vision" },
  portal: { name: "传送法阵", asset: "event-portal", icon: "✦", category: "vision" },
  door: { name: "神秘石门", asset: "event-door", icon: "▥", category: "system" },
  roots: { name: "盘根裂隙", asset: "event-trap", icon: "⌁", category: "damage" },
  echo: { name: "谷底回声", asset: "enemy-ghost", icon: "◌", category: "vision" },
  cache: { name: "遗落农具", asset: "event-corpse", icon: "◇", category: "item" }
};

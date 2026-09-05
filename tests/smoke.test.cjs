"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const MAZE_SIZE = 135;
const MAZE_CENTER = Math.floor(MAZE_SIZE / 2);

class ClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) this.values.delete(name);
      else this.values.add(name);
      return this.values.has(name);
    }
    if (force) this.values.add(name);
    else this.values.delete(name);
    return force;
  }

  contains(name) {
    return this.values.has(name);
  }
}

function gradient() {
  return { addColorStop() {} };
}

function canvasContext() {
  const context = {
    setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {},
    save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, arc() {}, drawImage() {}, fillText() {},
    setLineDash() {}, createRadialGradient: gradient, createLinearGradient: gradient
  };
  return new Proxy(context, {
    get(target, property) {
      return property in target ? target[property] : target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
}

class MockElement {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.classList = new ClassList();
    this.listeners = {};
    this.scrollTop = 0;
    this.clientHeight = id === "eventLog" ? 140 : 100;
    this.width = 0;
    this.height = 0;
    this._context = id.toLowerCase().includes("canvas") ? canvasContext() : null;
  }

  get scrollHeight() {
    return Math.max(this.clientHeight, this.children.length * 28);
  }

  set innerHTML(value) {
    if (value === "") this.children = [];
  }

  get innerHTML() {
    return "";
  }

  addEventListener(type, listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  getContext() {
    return this._context;
  }

  getBoundingClientRect() {
    if (this.id === "gameCanvas") return { left: 0, top: 0, width: 390, height: 500 };
    if (this.id === "minimapCanvas") return { left: 0, top: 0, width: 106, height: 106 };
    if (this.id === "fullMapCanvas" || this.id === "endMapCanvas") return { left: 0, top: 0, width: 420, height: 420 };
    return { left: 0, top: 0, width: 100, height: 100 };
  }

  setPointerCapture() {}
}

const elementIds = [
  "gameShell", "stage", "gameCanvas", "minimapCanvas", "minimapButton", "fullMapCanvas", "endMapCanvas",
  "floorValue", "healthText", "healthFill", "stepsValue", "statusChip", "eventLog", "newEventBadge",
  "encounterCard", "encounterIcon", "encounterKicker", "encounterTitle", "encounterDescription",
  "encounterOutcome", "encounterActions", "encounterClose", "startOverlay", "continueButton", "newGameButton",
  "bestRecord", "diaryOverlay", "diaryClose", "diaryList", "diaryButton", "mapOverlay", "mapClose", "endOverlay", "endTitle", "endReveal", "endStats", "endRestartButton",
  "storyOverlay", "storyKicker", "storyText", "storyContinueButton",
  "restartButton", "toast", "countPotion", "countVision", "countExecute", "countTeleport", "timerVision"
];

const elements = Object.fromEntries(elementIds.map((id) => [id, new MockElement(id)]));
elements.mapOverlay.hidden = true;
elements.endOverlay.hidden = true;
elements.encounterCard.hidden = true;
elements.storyOverlay.hidden = true;
elements.diaryOverlay.hidden = true;
elements.continueButton.hidden = true;
elements.timerVision.hidden = true;
elements.newEventBadge.hidden = true;

const healthTrack = new MockElement("healthTrack");
const itemButtons = ["potion", "vision", "execute", "teleport"].map((item) => {
  const button = new MockElement(`item-${item}`);
  button.dataset.item = item;
  return button;
});
const rootStyleValues = {};
global.document = {
  documentElement: {
    style: {
      setProperty(name, value) { rootStyleValues[name] = value; }
    }
  },
  getElementById(id) {
    return elements[id] || (elements[id] = new MockElement(id));
  },
  querySelector(selector) {
    if (selector === ".health-track") return healthTrack;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === ".item-slot") return itemButtons;
    return [];
  },
  createElement() {
    return new MockElement();
  }
};

const store = new Map();
global.localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};

global.window = global;
global.window.devicePixelRatio = 1;
global.window.innerWidth = 390;
global.window.addEventListener = () => {};
global.window.confirm = () => true;
global.window.matchMedia = () => ({ matches: true });
global.location = { protocol: "file:" };
Object.defineProperty(global, "navigator", { value: {}, configurable: true });
global.requestAnimationFrame = (callback) => { callback(); return 1; };
global.setTimeout = () => 1;
global.clearTimeout = () => {};
global.Image = class {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1400;
    this.naturalHeight = 1120;
    this.src = "";
  }
};

require("node:vm").runInThisContext(fs.readFileSync(path.join(__dirname, "..", "dist", "game.js"), "utf8"), { filename: "dist/game.js" });

const game = global.__dungeonGame;
assert.ok(game, "游戏实例应成功创建");
assert.equal(game.renderer.assets.get().naturalWidth, 1400, "运行时应加载单张 PNG 图集");
game.startNewGame();

assert.equal(elements.storyOverlay.hidden, false, "新游戏应先播放开场故事");
assert.ok(elements.storyKicker.textContent.includes("序章"));
assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
assert.ok(elements.storyText.textContent.length > 60);
assert.ok(elements.storyText.textContent.split(/\n\s*\n/u).filter(Boolean).length <= 3, "单次演出文本不应超过三段");
const openingCandidates = game.story.buildStoryCandidates({
  illusion: "幻象在你眼前晃动。",
  reality: "你听见山风从耳边穿过。"
});
assert.ok(openingCandidates.length >= 3 && openingCandidates.length <= 5, "同一演出应存在 3-5 条候选文本");
elements.storyContinueButton.listeners.click[0]();
assert.equal(elements.storyOverlay.hidden, true, "开场每局只播放随机选中的一段故事");
assert.equal(rootStyleValues["--app-safe-area-top"], "96px", "移动端应同时避让状态栏与宿主导航工具栏");

// 开发者日记：新玩家不自动弹出，老玩家升级后首次进入自动展示一次。
assert.equal(elements.diaryOverlay.hidden, true, "新玩家首次进入不应自动弹出开发者日记");
store.set("dungeon-mizong-diary-v1", "1.11.0");
game.devDiary.maybeShowOnLaunch();
assert.equal(elements.diaryOverlay.hidden, false, "升级后首次进入应自动展示开发者日记");
assert.equal(store.get("dungeon-mizong-diary-v1"), "1.12.0", "展示后应记录已读版本");
elements.diaryClose.listeners.click[0]();
assert.equal(elements.diaryOverlay.hidden, true, "关闭按钮应关闭开发者日记");
game.devDiary.maybeShowOnLaunch();
assert.equal(elements.diaryOverlay.hidden, true, "同一版本只自动展示一次");
elements.diaryButton.listeners.click[0]();
assert.equal(elements.diaryOverlay.hidden, false, "开始界面入口可随时打开开发者日记");
assert.equal(elements.diaryList.children.length, 2, "开发者日记应包含两个版本的记录");
elements.diaryOverlay.listeners.click[0]({ target: elements.diaryOverlay });
assert.equal(elements.diaryOverlay.hidden, true, "点击遮罩应关闭开发者日记");

assert.equal(game.state.active, true);
assert.equal(game.state.storyTriggerVersion, 3, "新局应使用带冷却和优先级的剧情触发规则");
assert.equal(game.state.lastStoryStep, 0, "开场演出应占用第 0 步的剧情额度");
assert.deepEqual(game.state.pendingStories, [], "开场演出后不应残留待播放剧情");
assert.equal(game.state.floor, undefined, "游戏应为单层大型迷宫");
assert.equal(typeof game.nextFloor, "undefined", "出口不应再生成下一层");
assert.equal(game.state.maze.bits.length, MAZE_SIZE * MAZE_SIZE);
assert.equal(game.state.maze.roomCount, 18225, "迷宫总面积应在上一版基础上扩大约五倍");
assert.equal(game.state.logs.length, 5, "开局事件时间流默认应填充五条且包含随机环境文案");
assert.ok(game.state.maze.exits.length >= 1 && game.state.maze.exits.length <= 3);
assert.equal(game.state.player.x, MAZE_CENTER);
assert.equal(game.state.player.y, MAZE_CENTER);
assert.equal(game.vision.getVisionRadius(), 2);
assert.equal("wallPreviewRooms" in game, false, "墙体不应再依赖随移动更新的预绘集合");
const initialEnemies = Object.values(game.state.maze.entities).filter((entity) => entity.kind === "enemy");
assert.ok(initialEnemies.length >= Math.floor(MAZE_SIZE * MAZE_SIZE * 0.045), "怪物密度不应低于 4.5%");
assert.ok(initialEnemies.length <= Math.floor(MAZE_SIZE * MAZE_SIZE * 0.06), "怪物密度不应高于 6%");
assert.equal(initialEnemies.some((enemy) => enemy.type === "guardian"), false, "出口附近不再放置守卫");

// PNG 图集完整性与索引。
const assetDirectory = path.join(__dirname, "..", "assets");
const atlasManifest = JSON.parse(fs.readFileSync(path.join(assetDirectory, "sprites-atlas.json"), "utf8"));
const atlasPng = fs.readFileSync(path.join(assetDirectory, "sprites-atlas.png"));
assert.equal(atlasPng.toString("hex", 0, 8), "89504e470d0a1a0a", "图集必须是 PNG");
assert.equal(atlasPng.readUInt32BE(16), 1400);
assert.equal(atlasPng.readUInt32BE(20), 1120);
assert.ok([3, 6].includes(atlasPng[25]), "图集必须为带透明通道的索引色或 RGBA PNG");
if (atlasPng[25] === 3) {
  assert.notEqual(atlasPng.indexOf(Buffer.from("tRNS")), -1, "索引色图集必须保留透明通道");
}
assert.equal(Object.keys(atlasManifest.frames).length, 20);
assert.equal(new Set(Object.values(atlasManifest.frames).map((frame) => frame.join(","))).size, 20);
assert.equal(fs.readdirSync(assetDirectory).some((name) => name.endsWith(".svg")), false, "素材目录不应包含 SVG");
for (const sourceName of ["index.html", "styles.css", "game.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", "dist", sourceName), "utf8");
  assert.equal(source.includes(".svg"), false, `${sourceName} 不应引用 SVG`);
}
const indexSource = fs.readFileSync(path.join(__dirname, "..", "dist", "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(__dirname, "..", "dist", "game.js"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "..", "dist", "styles.css"), "utf8");
assert.equal(indexSource.includes("manifest.webmanifest"), false, "小程序包不应依赖 Web App Manifest");
assert.equal(indexSource.includes("control-dock"), false, "底部方向操作区应完全移除");
assert.equal(indexSource.includes("点击已探索区域自动寻路"), true, "主画面应提示点击自动寻路");
assert.equal(styleSource.includes("--app-safe-area-top: 96px"), true, "移动端 CSS 回退安全区应避让宿主工具栏");
assert.equal(gameSource.includes("serviceWorker"), false, "小程序包不应注册 Service Worker");
assert.equal(gameSource.includes("fetch("), false, "游戏运行时不应发起网络请求");
assert.equal(gameSource.includes("幻觉线 ·"), false, "演出界面不应标注幻觉路线");
assert.equal(gameSource.includes("真实线 ·"), false, "演出界面不应标注真实路线");
const loreKeys = [
  "enemy:rat", "enemy:skeleton", "enemy:slime", "enemy:ghost", "enemy:mimic",
  "event:chest", "event:fountain", "event:trap", "event:map", "event:shrine", "event:corpse",
  "event:fog", "event:portal", "event:door", "event:roots", "event:echo", "event:cache",
  "item:potion", "item:vision", "item:execute", "item:teleport"
];
for (const loreKey of loreKeys) {
  assert.ok(gameSource.includes(`"${loreKey}"`), `首遇剧情应覆盖 ${loreKey}`);
}

const dirs = [
  { name: "up", dx: 0, dy: -1, bit: 1 },
  { name: "right", dx: 1, dy: 0, bit: 2 },
  { name: "down", dx: 0, dy: 1, bit: 4 },
  { name: "left", dx: -1, dy: 0, bit: 8 }
];

function key(x, y) {
  return `${x},${y}`;
}

function captureWallFrame() {
  const view = game.renderer.getMainViewMetrics(390, 500);
  const bounds = game.renderer.getViewportRoomBounds(390, 500, view.tileSize, view.camera);
  const segmentKey = (segment) => {
    const start = `${segment.x1},${segment.y1}`;
    const end = `${segment.x2},${segment.y2}`;
    return start < end ? `${start}|${end}` : `${end}|${start}`;
  };
  const segments = game.renderer.collectMazeWallSegments(bounds);
  return { bounds, segments, keys: new Set(segments.map(segmentKey)) };
}

function neighbors(state, point) {
  const mask = state.maze.bits[point.y * MAZE_SIZE + point.x];
  return dirs
    .filter((direction) => mask & direction.bit)
    .map((direction) => ({
      x: point.x + direction.dx,
      y: point.y + direction.dy,
      name: direction.name
    }));
}

function findPath(state, target) {
  const start = state.player;
  const queue = [{ x: start.x, y: start.y }];
  const parents = new Map([[key(start.x, start.y), null]]);
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (current.x === target.x && current.y === target.y) break;
    for (const next of neighbors(state, current)) {
      const nextKey = key(next.x, next.y);
      if (parents.has(nextKey)) continue;
      parents.set(nextKey, current);
      queue.push(next);
    }
  }
  if (!parents.has(key(target.x, target.y))) return [];
  const path = [];
  let current = target;
  while (current) {
    path.push(current);
    current = parents.get(key(current.x, current.y));
  }
  return path.reverse();
}

function directionBetween(from, to) {
  return dirs.find((direction) => from.x + direction.dx === to.x && from.y + direction.dy === to.y).name;
}

function dismissAllStories(limit = 30) {
  let count = 0;
  while (!elements.storyOverlay.hidden && count++ < limit) {
    elements.storyContinueButton.listeners.click[0]();
  }
  assert.ok(count < limit, "连续剧情演出不应陷入循环");
  assert.equal(elements.storyOverlay.hidden, true);
}

function resolvePending() {
  dismissAllStories();
  let safety = 0;
  while (game.pending && safety++ < 5) {
    if (game.pending.type === "enemy") {
      game.state.hp = Math.max(game.state.hp, game.pending.enemy.hp + 100);
      game.state.maxHp = Math.max(game.state.maxHp, game.state.hp);
      game.combat.fightEnemy(false);
      dismissAllStories();
      continue;
    }
    const pendingKey = game.pending.key;
    const entity = game.state.maze.entities[pendingKey];
    if (!entity) {
      game.events.dismissEncounter();
      continue;
    }
    switch (entity.type) {
      case "chest": game.events.openChest(pendingKey); break;
      case "fountain": game.events.useFountain(pendingKey); break;
      case "shrine":
        if (game.state.hp <= 12) game.state.hp = 100;
        game.events.useShrine(pendingKey);
        break;
      case "corpse": game.events.searchCorpse(pendingKey); break;
      case "portal": game.events.usePortal(pendingKey); break;
      case "door": game.events.openStoneDoor(pendingKey); break;
      default: game.events.leaveEvent(pendingKey);
    }
    dismissAllStories();
  }
  assert.ok(safety < 5, "遭遇处理不应陷入循环");
}

function walkTo(target, maxMoves = 800) {
  let moves = 0;
  while ((game.state.player.x !== target.x || game.state.player.y !== target.y) && moves++ < maxMoves) {
    const route = findPath(game.state, target);
    assert.ok(route.length >= 2, `目标 ${key(target.x, target.y)} 应可达`);
    game.movement.attemptMove(directionBetween(route[0], route[1]));
    dismissAllStories();
    resolvePending();
  }
  assert.ok(moves < maxMoves, "移动不应超出安全上限");
}

// 21 类内容均随机选择一条故事线，每次只演出一段，并在本局内去重。
for (const loreKey of loreKeys) {
  game.state.lastStoryStep = game.state.totalSteps - 30;
  game.state.lastNormalStoryStep = game.state.totalSteps - 20;
  game.state.normalStoryGapJitter = 0;
  assert.equal(game.story.queueFirstLore(loreKey), true, `${loreKey} 应能触发首次故事`);
  assert.equal(elements.storyOverlay.hidden, true, "剧情应先进入调度队列，而不是在触发函数内立即弹出");
  assert.equal(game.story.tryShowPendingStory(), true, "满足普通演出步数间隔后应播放一条待处理剧情");
  assert.ok(elements.storyKicker.textContent.includes("残缺片段"));
  assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
  assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
  assert.ok(elements.storyText.textContent.length > 45, `${loreKey} 的随机文本应足够完整`);
  dismissAllStories();
  assert.equal(game.story.queueFirstLore(loreKey), false, `${loreKey} 不应重复播放`);
}
assert.equal(game.state.loreSeen.length, 21);
game.state.loreSeen = [];
game.state.pendingStories = [];
game.save();

// 墙体按可行走区域统一描边：无重复线段、无单侧叠亮，并删除四通路口孤立墙柱。
const initialView = game.renderer.getMainViewMetrics(390, 500);
const initialBounds = game.renderer.getViewportRoomBounds(390, 500, initialView.tileSize, initialView.camera);
const wallsBeforeMove = captureWallFrame();
assert.ok(wallsBeforeMove.segments.length > 0, "镜头缓冲区内应预先生成完整墙体边界");
assert.equal(wallsBeforeMove.keys.size, wallsBeforeMove.segments.length, "同一物理墙段只应绘制一次");
const wallStrokePasses = [];
const wallProbe = canvasContext();
wallProbe.stroke = () => wallStrokePasses.push({ style: wallProbe.strokeStyle, width: wallProbe.lineWidth });
game.renderer.drawMazeWalls(wallProbe, initialBounds, initialView.tileSize);
assert.deepEqual(wallStrokePasses.map((pass) => pass.style), ["#5b2228", "#bd555c"], "全部墙段应共享同一暗红底色和亮色描边");
assert.equal(wallStrokePasses.length, 2, "墙体只应进行两次统一描边，不按房间重复叠加");
let removablePillar = null;
for (let y = 1; y < MAZE_SIZE && !removablePillar; y += 1) {
  for (let x = 1; x < MAZE_SIZE; x += 1) {
    if (game.renderer.isRemovableWallPillar(x * 4, y * 4)) {
      removablePillar = { x: x * 4, y: y * 4 };
      break;
    }
  }
}
assert.ok(removablePillar, "大型迷宫应包含可用于验证的四通路口");
assert.equal(game.renderer.isMazeFloorCell(removablePillar.x, removablePillar.y), true, "孤立墙柱应并入地面而不是继续显示");
const fogCellAlphas = [];
const fogProbe = {
  globalAlpha: 1,
  fillStyle: "",
  save() {},
  restore() {},
  fillRect() { fogCellAlphas.push(this.globalAlpha); }
};
game.renderer.drawWorldFogCells(fogProbe, initialBounds, initialView.tileSize, false, new Set(game.state.explored));
assert.ok(fogCellAlphas.length > 0, "未探索墙体上方应覆盖独立迷雾层");
assert.ok(fogCellAlphas.every((alpha) => alpha >= 0.5 && alpha <= 0.94), "迷雾应遮挡墙体但保留少量轮廓");

const firstMove = neighbors(game.state, game.state.player)[0];
delete game.state.maze.entities[key(game.state.player.x + firstMove.dx, game.state.player.y + firstMove.dy)];
game.movement.attemptMove(firstMove.name);
const wallsAfterMove = captureWallFrame();
const sharedWalls = [...wallsBeforeMove.keys].filter((segment) => wallsAfterMove.keys.has(segment));
assert.ok(sharedWalls.length > 0, "相邻两帧应存在共同墙体");
assert.ok(sharedWalls.every((segment) => wallsBeforeMove.keys.has(segment) && wallsAfterMove.keys.has(segment)), "移动前后同一物理墙段应保持不变");

// 点击寻路只允许已探索格，并沿已探索连通区域逐格移动。
assert.equal(game.movement.startAutoPath({ x: 0, y: 0 }), false, "未知格不能成为自动寻路目标");
const exploredTarget = { x: MAZE_CENTER, y: MAZE_CENTER };
assert.equal(game.movement.startAutoPath(exploredTarget), true);
let autoSafety = 0;
while (game.movement.autoPath.length && autoSafety++ < 30) game.movement.runAutoPathStep();
assert.ok(autoSafety < 30, "自动寻路不应陷入循环");
assert.deepEqual(game.state.player, exploredTarget, "自动寻路应抵达所点选的已探索格");
game.maps.openMap(false);
assert.ok(game.maps.fullMapTransform && game.maps.fullMapTransform.scale > 0, "放大地图应保留点击坐标转换信息");
elements.fullMapCanvas.listeners.click[0]({
  clientX: game.maps.fullMapTransform.offsetX + game.state.player.x * game.maps.fullMapTransform.scale,
  clientY: game.maps.fullMapTransform.offsetY + game.state.player.y * game.maps.fullMapTransform.scale
});
assert.equal(elements.mapOverlay.hidden, true, "点击放大地图中的已探索格后应返回主画面");
const minimapStrokeStyles = [];
const minimapProbe = canvasContext();
minimapProbe.stroke = () => minimapStrokeStyles.push(minimapProbe.strokeStyle);
game.maps.drawMap(minimapProbe, 106, 106, false, true);
assert.ok(minimapStrokeStyles.includes("#3a505d"), "缩略图探索网络应以灰蓝色为主");
assert.equal(minimapStrokeStyles.includes("rgba(190, 73, 79, 0.98)"), false, "缩略图不应再使用高饱和红色网格");

// 血量节点随机选择一条线索且只播放一次，出口提示只能使用四个正方向。
for (const hp of [74, 49, 24]) {
  game.state.hp = hp;
  game.state.lastStoryStep = game.state.totalSteps - 30;
  game.state.lastNormalStoryStep = game.state.totalSteps - 20;
  game.state.normalStoryGapJitter = 0;
  game.ui.updateUI();
  assert.equal(elements.storyOverlay.hidden, false);
  assert.ok(elements.storyKicker.textContent.includes("记忆残片"));
  assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
  assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
  assert.ok(elements.storyText.textContent.length > 45);
  dismissAllStories();
}
game.state.hp = 100;
game.ui.updateUI();
for (const exitDirection of [
  game.maps.getExitHintDirection({ x: MAZE_CENTER, y: 0 }),
  game.maps.getExitHintDirection({ x: MAZE_SIZE - 1, y: MAZE_CENTER }),
  game.maps.getExitHintDirection({ x: MAZE_CENTER, y: MAZE_SIZE - 1 }),
  game.maps.getExitHintDirection({ x: 0, y: MAZE_CENTER })
]) {
  assert.equal(Math.abs(exitDirection.ux) + Math.abs(exitDirection.uy), 1, "出口箭头必须为正南、正北、正东或正西");
  assert.ok(exitDirection.ux === 0 || exitDirection.uy === 0);
}

// 每个出口半径两格及最后四个接近房间保持为空。
for (const mazeExit of game.state.maze.exits) {
  for (const [entityKey, entity] of Object.entries(game.state.maze.entities)) {
    const [entityX, entityY] = entityKey.split(",").map(Number);
    const distance = Math.abs(entityX - mazeExit.x) + Math.abs(entityY - mazeExit.y);
    if (distance <= 2) {
      assert.notEqual(entity.kind, "enemy", "出口安全区内不应生成怪物");
      assert.notEqual(entity.type, "chest", "出口安全区内不应生成宝箱");
    }
  }
  findPath(game.state, mazeExit).slice(-4).forEach((room) => {
    assert.equal(game.state.maze.entities[key(room.x, room.y)], undefined, "出口最后一段路线应保持为空");
  });
}

// 完整连通性与环路：从中心可访问全部 18225 个房间，并存在大量非唯一路线。
const reachable = new Set([key(MAZE_CENTER, MAZE_CENTER)]);
const queue = [{ x: MAZE_CENTER, y: MAZE_CENTER }];
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  for (const next of neighbors(game.state, queue[cursor])) {
    const nextKey = key(next.x, next.y);
    if (reachable.has(nextKey)) continue;
    reachable.add(nextKey);
    queue.push(next);
  }
}
assert.equal(reachable.size, MAZE_SIZE * MAZE_SIZE, "迷宫必须完整连通");
const edgeCount = game.state.maze.bits.reduce((sum, mask) => {
  let connections = 0;
  for (const direction of dirs) if (mask & direction.bit) connections += 1;
  return sum + connections;
}, 0) / 2;
const cycleCount = edgeCount - MAZE_SIZE * MAZE_SIZE + 1;
assert.equal(cycleCount, game.state.maze.loopCount, "记录的破墙数量应与实际环路数一致");
assert.ok(cycleCount >= Math.floor(MAZE_SIZE * MAZE_SIZE * 0.18), "大型迷宫应包含大量环路而非唯一路线");

const eventTypes = new Set(
  Object.values(game.state.maze.entities)
    .filter((entity) => entity.kind === "event")
    .map((entity) => entity.type)
);
assert.ok(eventTypes.size >= 10, "大型迷宫至少应包含十类随机事件");
for (const eventType of ["roots", "echo", "cache"]) assert.ok(eventTypes.has(eventType), `应生成新增事件 ${eventType}`);
assert.ok(Object.values(game.state.maze.entities).some((entity) => entity.kind === "enemy"), "地图应包含敌人");

// 首次事件只播放随机选中的一段剧情；同类事件之后不再重复演出。
const newEventKey = key(game.state.player.x, game.state.player.y);
game.state.maze.entities[newEventKey] = { kind: "event", type: "roots" };
game.state.lastStoryStep = game.state.totalSteps - 30;
game.state.lastNormalStoryStep = game.state.totalSteps - 20;
game.state.normalStoryGapJitter = 0;
game.events.resolveEvent(game.state.maze.entities[newEventKey], newEventKey);
assert.equal(elements.storyOverlay.hidden, true, "事件面板未结束前不应抢占演出");
assert.ok(elements.encounterDescription.textContent.length > 12);
game.events.crossRoots(newEventKey);
assert.equal(elements.storyOverlay.hidden, false, "事件结算后应立即衔接演出");
assert.ok(elements.storyKicker.textContent.includes("残缺片段"));
assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
assert.ok(elements.storyText.textContent.length > 45);
dismissAllStories();
assert.equal(game.state.maze.entities[newEventKey], undefined);
game.state.maze.entities[newEventKey] = { kind: "event", type: "roots" };
game.events.resolveEvent(game.state.maze.entities[newEventKey], newEventKey);
assert.equal(elements.storyOverlay.hidden, true, "同类事件的剧情只应播放一次");
game.events.leaveEvent(newEventKey);
delete game.state.maze.entities[newEventKey];
game.state.maze.entities[newEventKey] = { kind: "event", type: "cache" };
game.state.lastStoryStep = game.state.totalSteps - 30;
game.state.lastNormalStoryStep = game.state.totalSteps - 20;
game.state.normalStoryGapJitter = 0;
game.events.resolveEvent(game.state.maze.entities[newEventKey], newEventKey);
dismissAllStories();
assert.ok(elements.encounterDescription.textContent.length > 12);
game.events.searchFarmCache(newEventKey);
dismissAllStories();
assert.equal(game.state.maze.entities[newEventKey], undefined);
game.state.maze.entities[newEventKey] = { kind: "event", type: "echo" };
game.state.lastStoryStep = game.state.totalSteps - 30;
game.state.lastNormalStoryStep = game.state.totalSteps - 20;
game.state.normalStoryGapJitter = 0;
game.events.resolveEvent(game.state.maze.entities[newEventKey], newEventKey);
dismissAllStories();
assert.equal(game.state.maze.entities[newEventKey], undefined);

// 初始持有的道具在使用时不触发故事；只有实际拾取入包后才演出。
game.state.pendingStories = [];
game.state.hp = 40;
game.state.maxHp = 100;
game.state.inventory.potion = 1;
game.state.loreSeen = game.state.loreSeen.filter((loreKey) => loreKey !== "item:potion");
game.inventory.useItem("potion");
assert.equal(game.state.hp, 70);
assert.equal(elements.storyOverlay.hidden, true, "使用初始道具不应触发首拾剧情");
const pickupKey = key(game.state.player.x, game.state.player.y);
game.state.inventory.potion = 0;
game.state.maze.entities[pickupKey] = { kind: "pickup", itemType: "potion" };
game.state.lastStoryStep = game.state.totalSteps - 30;
game.state.lastNormalStoryStep = game.state.totalSteps - 20;
game.state.normalStoryGapJitter = 0;
game.inventory.collectPickup(game.state.maze.entities[pickupKey], pickupKey);
assert.equal(game.state.inventory.potion, 1, "物品应先进入背包");
assert.equal(elements.storyOverlay.hidden, true, "拾取故事应先排队，不阻断拾取结算");
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, false, "拾取物品后应触发故事");
assert.ok(elements.storyKicker.textContent.includes("恢复药剂"));
assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
dismissAllStories();
const exploredBeforeVision = new Set(game.state.explored);
const normalMetrics = game.renderer.getMainViewMetrics(390, 500);
game.state.inventory.vision = 1;
game.inventory.useItem("vision");
dismissAllStories();
assert.equal(game.vision.getVisionRoomLimit(), Infinity);
assert.equal(game.vision.getVisionRadius(), Infinity, "视野道具开启时主画面不再受迷雾半径限制");
assert.equal(game.state.visionTurns, 30);
assert.equal(game.state.explored.length, exploredBeforeVision.size, "临时展开的迷雾不应永久计入已探索区域");
const expandedMetrics = game.renderer.getMainViewMetrics(390, 500);
assert.equal(expandedMetrics.enhanced, true);
assert.ok(Math.abs(expandedMetrics.tileSize - normalMetrics.tileSize * 0.5) < 0.001, "视野道具应让主地图精确缩小 50%");
const disabledFogCells = [];
game.renderer.drawWorldFogCells({ save() {}, restore() {}, fillRect() { disabledFogCells.push(1); } }, initialBounds, expandedMetrics.tileSize, true, exploredBeforeVision);
assert.equal(disabledFogCells.length, 0, "视野道具生效时应完全关闭格子迷雾");
game.state.visionTurns = 1;
game.movement.tickEffects();
game.vision.updateVisibility();
assert.equal(game.state.visionTurns, 0);
assert.equal(game.vision.getVisionRadius(), 2, "视野步数结束后应恢复默认两格");
assert.equal(game.vision.getVisionRoomLimit(), Infinity);
assert.ok(game.vision.visibleRooms.size < 100, "效果结束后迷雾应恢复初始范围");
assert.equal(game.renderer.getMainViewMetrics(390, 500).enhanced, false);
game.state.inventory.teleport = 1;
const beforeTeleport = { ...game.state.player };
game.inventory.useItem("teleport");
dismissAllStories();
assert.notDeepEqual(game.state.player, beforeTeleport);
assert.equal(game.state.path[game.state.path.length - 1].teleport, true);
game.state.inventory.execute = 1;
game.inventory.useItem("execute");
assert.equal(game.state.inventory.execute, 1, "未遇敌时不应消耗一击必杀");

// 发现怪物时不演出；首次击败后才播放随机故事，第二次击败不重复。
const loreEnemyKey = key(game.state.player.x, game.state.player.y);
const loreEnemy = { kind: "enemy", type: "rat", hp: 1, revealed: true };
game.state.loreSeen = game.state.loreSeen.filter((loreKey) => loreKey !== "enemy:rat");
const timingEventRoll = game.events.eventRoll;
game.events.eventRoll = () => 0.5;
game.state.maze.entities[loreEnemyKey] = loreEnemy;
game.state.lastStoryStep = game.state.totalSteps - 30;
game.state.lastNormalStoryStep = game.state.totalSteps - 20;
game.state.normalStoryGapJitter = 0;
game.combat.openEnemyEncounter(loreEnemy, { ...game.state.player }, loreEnemyKey, true);
assert.equal(game.pending.type, "enemy", "发现怪物后应立即打开战斗");
assert.equal(elements.storyOverlay.hidden, true, "开始战斗前不应播放怪物故事");
game.combat.fightEnemy(false);
assert.equal(game.pending, null);
assert.equal(elements.storyOverlay.hidden, false, "击败怪物后才播放故事");
assert.ok(elements.storyKicker.textContent.includes("地穴鼠"));
assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
dismissAllStories();
assert.ok(game.state.loreSeen.includes("enemy:rat"));
assert.ok(JSON.parse(localStorage.getItem("dungeon-mizong-save-v1")).loreSeen.includes("enemy:rat"), "首遇记录应写入存档");
const secondLoreEnemy = { kind: "enemy", type: "rat", hp: 1, revealed: true };
game.state.maze.entities[loreEnemyKey] = secondLoreEnemy;
game.combat.openEnemyEncounter(secondLoreEnemy, { ...game.state.player }, loreEnemyKey, true);
game.combat.fightEnemy(false);
assert.equal(elements.storyOverlay.hidden, true, "同类怪物第二次被击败后不应重复故事");
game.events.eventRoll = timingEventRoll;

// 击败怪物后按概率在原地生成可立即开启的宝箱；普通事件剧情受最小步数间隔限制。
const originalEventRoll = game.events.eventRoll;
game.events.eventRoll = () => 0;
const dropKey = key(game.state.player.x, game.state.player.y);
const dropEnemy = { kind: "enemy", type: "rat", hp: 1, revealed: true };
game.state.maze.entities[dropKey] = dropEnemy;
game.pending = { type: "enemy", enemy: dropEnemy, target: { ...game.state.player }, key: dropKey, surprise: true };
game.combat.fightEnemy(false);
assert.equal(game.state.maze.entities[dropKey].type, "chest");
assert.equal(elements.storyOverlay.hidden, true, "事件面板未结束前不应打断当前交互");
assert.ok(game.state.pendingStories.some((entry) => entry.scene.id.startsWith("lore-event-chest-")), "事件触发时应先记录待播故事");
assert.equal(game.pending.type, "event", "掉落宝箱应立即进入开启事件");
game.events.openChest(dropKey);
assert.equal(elements.storyOverlay.hidden, true, "普通事件剧情在 20 步内应顺延");
assert.ok(game.state.pendingStories.some((entry) => entry.scene.id.startsWith("lore-event-chest-")), "顺延时剧情应保留在队列");
game.events.eventRoll = originalEventRoll;

// 普通剧情按优先级缓存；两次普通演出至少相隔 20 步，关闭后同一步绝不连弹。
game.state.pendingStories = [];
game.state.lastStoryStep = game.state.totalSteps;
game.state.lastNormalStoryStep = game.state.totalSteps;
game.state.normalStoryGapJitter = 0;
for (const loreKey of ["item:vision", "event:fountain", "enemy:skeleton"]) {
  game.state.loreSeen = game.state.loreSeen.filter((seenKey) => seenKey !== loreKey);
  assert.equal(game.story.queueFirstLore(loreKey), true);
}
assert.equal(game.state.pendingStories.length, 3);
assert.equal(elements.storyOverlay.hidden, true);
game.state.totalSteps += 19;
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, true, "未满 20 步不能播放缓存剧情");
game.state.totalSteps += 1;
game.ui.updateUI();
assert.ok(elements.storyKicker.textContent.includes("骷髅守卫"), "达到间隔后应先播放高优先级怪物故事");
dismissAllStories();
assert.equal(game.state.pendingStories.length, 2);
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, true, "关闭演出后同一步不能连续弹出下一条");
game.state.normalStoryGapJitter = 0;
game.state.totalSteps += 20;
game.ui.updateUI();
assert.ok(elements.storyKicker.textContent.includes("生命泉"), "下一次触发应播放次高优先级事件故事");
dismissAllStories();
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, true, "事件故事关闭后仍需重新累计 20 步");
game.state.normalStoryGapJitter = 0;
game.state.totalSteps += 20;
game.ui.updateUI();
assert.ok(elements.storyKicker.textContent.includes("视野拓宽"), "最后播放低优先级道具故事");
dismissAllStories();
assert.equal(game.state.pendingStories.length, 0);
const cooldownSave = JSON.parse(localStorage.getItem("dungeon-mizong-save-v1"));
assert.equal(cooldownSave.lastStoryStep, game.state.totalSteps, "剧情冷却进度应写入存档");
assert.deepEqual(cooldownSave.pendingStories, [], "待播队列应持久化且在播放完后清空");

// 普通演出间隔为 20 步最小值 + 每次演出后掷出的 0-10 步随机延后，不再每次踩点触发。
game.state.lastStoryStep = game.state.totalSteps;
game.state.lastNormalStoryStep = game.state.totalSteps;
game.state.normalStoryGapJitter = 5;
game.state.loreSeen = game.state.loreSeen.filter((seenKey) => seenKey !== "event:trap");
assert.equal(game.story.queueFirstLore("event:trap"), true, "随机延后测试应能排队剧情");
game.state.totalSteps += 20;
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, true, "随机延后未满时不应播放剧情");
game.state.totalSteps += 5;
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, false, "补足随机延后步数后才播放剧情");
dismissAllStories();
assert.ok(game.state.normalStoryGapJitter >= 0 && game.state.normalStoryGapJitter <= 10, "普通演出后应重掷 0-10 步随机延后");

// 找到并击败一个敌人。
const enemyEntry = Object.entries(game.state.maze.entities).find(([, entity]) => entity.kind === "enemy");
assert.ok(enemyEntry);
const enemyTarget = (() => {
  const [x, y] = enemyEntry[0].split(",").map(Number);
  return { x, y };
})();
const enemiesBefore = game.state.stats.enemies;
walkTo(enemyTarget);
assert.ok(game.state.stats.enemies > enemiesBefore, "抵达敌人格后应完成战斗");

// 找到并触发一个选择事件。
const eventEntry = Object.entries(game.state.maze.entities).find(([, entity]) => entity.kind === "event");
assert.ok(eventEntry);
const eventTarget = (() => {
  const [x, y] = eventEntry[0].split(",").map(Number);
  return { x, y };
})();
const eventsBefore = game.state.stats.events;
walkTo(eventTarget);
resolvePending();
assert.ok(game.state.stats.events > eventsBefore, "抵达事件格应触发事件");

// 出口结束单层探索，不生成第二层。
const exit = game.state.maze.exits[0];
walkTo(exit);
assert.equal(game.state.player.x, exit.x);
assert.equal(game.state.player.y, exit.y);
assert.ok(game.state.discoveredExits.length >= 1);
assert.ok(localStorage.getItem("dungeon-mizong-save-v1"), "活跃游戏应自动保存");
game.events.openExitEncounter();
const leaveMazeButton = elements.encounterActions.children[0];
assert.equal(leaveMazeButton.textContent, "离开迷宫");
leaveMazeButton.listeners.click[0]();

assert.equal(elements.endOverlay.hidden, true, "结算前应先播放真相故事");
assert.equal(elements.storyOverlay.hidden, false);
assert.ok(elements.storyKicker.textContent.includes("梦醒"));
assert.equal(elements.storyKicker.textContent.includes("幻觉线"), false);
assert.equal(elements.storyKicker.textContent.includes("真实线"), false);
assert.ok(elements.storyText.textContent.includes("搜救绳"));
assert.ok(elements.storyText.textContent.includes("回到家"));
dismissAllStories();

// 游戏结束、全貌统计与个人纪录。
assert.equal(game.state.active, false);
assert.equal(localStorage.getItem("dungeon-mizong-save-v1"), null);
assert.ok(localStorage.getItem("dungeon-mizong-records-v1"));
assert.equal(JSON.parse(localStorage.getItem("dungeon-mizong-records-v1"))[0].escaped, true);
assert.equal(elements.endOverlay.hidden, false);
assert.ok(elements.endReveal.textContent.includes("真实路线"));
assert.equal(elements.endStats.children.length, 4);

const completedRunMetrics = {
  exits: game.state.maze.exits.length,
  totalSteps: game.state.totalSteps,
  logs: game.state.logs.length
};

// 死亡只是幻觉结束：玩家醒来后仍会走完现实归途。
game.startNewGame();
dismissAllStories();
game.endGame("你倒在了迷宫深处", false);
assert.equal(elements.storyOverlay.hidden, false);
assert.ok(elements.storyText.textContent.includes("你倒在了迷宫深处"));
assert.ok(elements.storyText.textContent.includes("现实归途的开始"));
assert.ok(elements.storyKicker.textContent.includes("梦醒"));
dismissAllStories();
assert.ok(elements.endReveal.textContent.includes("真实路线"));
assert.equal(elements.endReveal.textContent.includes("无法回应"), false);

// 日志越过容量上限后仍持续刷新，浏览旧记录时仍提示新事件。
game.startNewGame();
dismissAllStories();
game.state.logs = [];
game.ui.updateLog(true);
for (let i = 1; i <= 405; i += 1) game.ui.addLog("system", "·", `回归日志 ${i}`);
assert.equal(game.state.logs.length, 200);
assert.equal(elements.eventLog.children.length, 200);
assert.equal(elements.eventLog.children[0].children[2].textContent, "回归日志 206");
assert.equal(elements.eventLog.children[199].children[2].textContent, "回归日志 405", "数组长度不变时也应显示最新日志");
elements.eventLog.scrollTop = 0;
game.ui.addLog("system", "·", "浏览旧记录时到达的新事件");
assert.equal(elements.newEventBadge.hidden, false, "达到容量上限后仍应显示未读提示");
assert.equal(elements.eventLog.scrollTop, 0, "用户浏览旧记录时不应强制跳到底部");
game.save();
game.continueGame();
assert.equal(elements.eventLog.children[199].children[2].textContent, "浏览旧记录时到达的新事件", "恢复存档应显示最新日志");

// 未读演出先持久化；恢复同一段文字，不重抽路线、不让更高优先级剧情抢占。
game.startNewGame();
const introSnapshot = JSON.parse(JSON.stringify(game.state.currentStory));
assert.ok(introSnapshot && introSnapshot.id.startsWith("intro-"));
assert.equal(game.state.storyScenes.includes(introSnapshot.id), false, "尚未确认的开场不能标记完成");
game.story.queueFirstLore("item:potion");
game.continueGame();
assert.equal(elements.storyText.textContent, introSnapshot.text, "开场中断后应恢复原文");
assert.equal(elements.storyOverlay.hidden, false);
assert.equal(game.state.lastStoryStep, 0);
assert.equal(game.state.pendingStories.length, 1);
dismissAllStories();
assert.equal(game.state.currentStory, null);
assert.ok(game.state.storyScenes.includes(introSnapshot.id));
assert.equal(JSON.parse(localStorage.getItem("dungeon-mizong-save-v1")).currentStory, null, "确认完成后应立即更新存档");
game.continueGame();
assert.equal(elements.storyOverlay.hidden, true, "已读开场不应重播，普通待播剧情仍需等待下一次触发");
game.state.totalSteps = 20;
game.ui.updateUI();
const itemSnapshot = JSON.parse(JSON.stringify(game.state.currentStory));
assert.ok(itemSnapshot.id.startsWith("lore-item-potion-"));
game.story.queueFirstLore("enemy:rat");
for (let restore = 0; restore < 2; restore += 1) {
  game.continueGame();
  assert.equal(elements.storyText.textContent, itemSnapshot.text);
  assert.equal(game.state.currentStory.id, itemSnapshot.id, "当前未读片段优先于队列中更高优先级的片段");
  assert.equal(game.state.storyScenes.includes(itemSnapshot.id), false);
  assert.equal(game.state.lastStoryStep, 20, "恢复未读片段不能重置冷却起点");
  assert.equal(game.state.pendingStories.length, 1);
}
dismissAllStories();
assert.ok(game.state.storyScenes.includes(itemSnapshot.id));
game.continueGame();
assert.equal(elements.storyOverlay.hidden, true, "确认后再次继续游戏不能重播或连弹");
game.state.normalStoryGapJitter = 0;
game.state.totalSteps = 39;
game.ui.updateUI();
assert.equal(elements.storyOverlay.hidden, true);
game.state.totalSteps = 40;
game.ui.updateUI();
assert.ok(elements.storyKicker.textContent.includes("地穴鼠"));
dismissAllStories();
const legacyStorySave = JSON.parse(localStorage.getItem("dungeon-mizong-save-v1"));
delete legacyStorySave.currentStory;
localStorage.setItem("dungeon-mizong-save-v1", JSON.stringify(legacyStorySave));
game.continueGame();
assert.equal(game.state.currentStory, null, "旧存档缺少 currentStory 时应兼容恢复");
assert.equal(elements.storyOverlay.hidden, true);

// 战斗结果按真实血量核对，不补血；覆盖本步毒伤、伏击不走步、一击必杀和直接战败。
const combatCases = [
  { name: "新中毒立即致死", type: "slime", hp: 11, poison: 0, surprise: false, execute: false, expectedHp: 0, expectedPoison: 2 },
  { name: "新中毒后幸存", type: "slime", hp: 13, poison: 0, surprise: false, execute: false, expectedHp: 1, expectedPoison: 2 },
  { name: "伏击不结算步伤", type: "slime", hp: 11, poison: 0, surprise: true, execute: false, expectedHp: 1, expectedPoison: 3 },
  { name: "已有中毒立即致死", type: "rat", hp: 11, poison: 1, surprise: false, execute: false, expectedHp: 0, expectedPoison: 0 },
  { name: "已有中毒后幸存", type: "rat", hp: 15, poison: 2, surprise: false, execute: false, expectedHp: 3, expectedPoison: 1 },
  { name: "必杀仍受已有毒伤", type: "rat", hp: 1, poison: 1, surprise: false, execute: true, expectedHp: 0, expectedPoison: 0 },
  { name: "必杀不会新增中毒", type: "slime", hp: 11, poison: 0, surprise: false, execute: true, expectedHp: 11, expectedPoison: 0 },
  { name: "伏击保留已有毒时长", type: "rat", hp: 11, poison: 2, surprise: true, execute: false, expectedHp: 1, expectedPoison: 2 },
  { name: "同血量直接战败", type: "rat", hp: 10, poison: 0, surprise: false, execute: false, expectedHp: 0, expectedPoison: 0 },
  { name: "伏击必杀无需走步", type: "rat", hp: 1, poison: 1, surprise: true, execute: true, expectedHp: 1, expectedPoison: 1 }
];
const combatEventRoll = game.events.eventRoll;
for (const testCase of combatCases) {
  game.startNewGame();
  dismissAllStories();
  game.state.storyScenes.push("memory-75", "memory-50", "memory-25");
  game.state.loreSeen.push(`enemy:${testCase.type}`);
  game.state.hp = testCase.hp;
  game.state.poisonTurns = testCase.poison;
  game.state.inventory.execute = testCase.execute ? 1 : 0;
  game.events.eventRoll = () => 0.5;
  const nextRoom = neighbors(game.state, game.state.player)[0];
  const target = testCase.surprise ? { ...game.state.player } : { x: nextRoom.x, y: nextRoom.y };
  const targetKey = key(target.x, target.y);
  const enemy = { kind: "enemy", type: testCase.type, hp: 10, revealed: true };
  game.state.maze.entities[targetKey] = enemy;
  const predicted = game.combat.getCombatOutcome(enemy, testCase.surprise, testCase.execute);
  assert.equal(predicted.hpAfterAction, testCase.expectedHp, `${testCase.name}：计算值应正确`);
  game.combat.openEnemyEncounter(enemy, target, targetKey, testCase.surprise);
  if (!testCase.execute && predicted.defeated && !predicted.survives) {
    assert.ok(elements.encounterOutcome.textContent.includes("毒伤会立即结束本局"), `${testCase.name}：必须明确警告`);
  } else if (!testCase.execute && predicted.survives) {
    assert.ok(elements.encounterOutcome.textContent.includes(`预计剩余 ${testCase.expectedHp} HP`));
  }
  if (testCase.execute && !predicted.survives) {
    assert.ok(elements.encounterActions.children[1].textContent.includes("毒伤致命"));
  }
  game.combat.fightEnemy(testCase.execute);
  assert.equal(game.state.hp, predicted.hpAfterAction, `${testCase.name}：预告与实际血量必须一致`);
  assert.equal(game.state.poisonTurns, testCase.expectedPoison, `${testCase.name}：中毒时长必须一致`);
  assert.equal(game.state.active, testCase.expectedHp > 0);
  assert.equal(game.state.totalSteps, predicted.defeated && !testCase.surprise ? 1 : 0);
  dismissAllStories();
}
game.events.eventRoll = combatEventRoll;

console.log(JSON.stringify({
  connectedRooms: reachable.size,
  loops: cycleCount,
  exits: completedRunMetrics.exits,
  eventTypes: [...eventTypes].sort(),
  totalSteps: completedRunMetrics.totalSteps,
  logs: completedRunMetrics.logs,
  regressions: { cappedLogUpdates: true, unreadStoryRecovery: true, combatCases: combatCases.length },
  result: "ok"
}, null, 2));

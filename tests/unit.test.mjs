import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateMaze, shortestPath } from "../src/core/maze.js";
import { calculateCombatOutcome } from "../src/core/combat.js";
import { dailySeed, formatSeedCode, parseSeedInput } from "../src/core/random.js";
import { getEnding } from "../src/data/endings.js";
import { restoreState } from "../src/state/migrations.js";
import { SaveStore } from "../src/state/save-store.js";
import { DEV_DIARY } from "../src/data/dev-diary.js";
import { SAVE_VERSION, STORAGE_KEY, RECORD_KEY, STORY_TRIGGER_VERSION, APP_VERSION, MAX_POISON_TURNS } from "../src/config.js";
import { fearHpPerTurn } from "../src/systems/fear.js";

test("迷宫模块不依赖 DOM，同一种子生成相同拓扑、守卫和回响碎片", () => {
  const first = generateMaze(20260904);
  assert.deepEqual(first, generateMaze(20260904));
  assert.ok(first.loopCount > 0);
  assert.equal(first.shards.length, 3, "每局迷宫应在中场投放 3 块回响碎片");
  assert.equal(first.exits.some((exit) => exit.guarded), true, "最近出口应标记为守卫出口");
  const guardians = Object.values(first.entities).filter((entity) => entity.kind === "enemy" && entity.type === "guardian");
  assert.equal(guardians.length, 1, "近端出口接近路径外侧应放置 1 名出口守卫");
  for (const exit of first.exits) {
    assert.ok(shortestPath(first.bits, { x: 67, y: 67 }, exit).length > 1);
    assert.equal(first.entities[`${exit.x},${exit.y}`], undefined);
  }
});

test("纯战斗计算包含本步毒伤、毒叠加及出口守卫必杀减半，且不修改状态", () => {
  const state = Object.freeze({ hp: 12, poisonTurns: 0 });
  const slime = Object.freeze({ type: "slime", hp: 10 });
  const outcome = calculateCombatOutcome(state, slime, false);
  assert.equal(outcome.defeated, true);
  assert.equal(outcome.poisonDamage, 2);
  assert.equal(outcome.survives, false);
  assert.equal(calculateCombatOutcome(state, slime, true).hpAfterAction, 2);
  assert.equal(calculateCombatOutcome(state, slime, false, true).hpAfterAction, 12);
  assert.equal(calculateCombatOutcome({ hp: 2, poisonTurns: 1 }, slime, false, true).survives, false);

  // 毒素可叠加至上限 MAX_POISON_TURNS
  const stacked = calculateCombatOutcome({ hp: 50, poisonTurns: 2 }, slime, true, false);
  assert.equal(stacked.poisonTurnsAfterCombat, 5);
  const capped = calculateCombatOutcome({ hp: 50, poisonTurns: 8 }, slime, true, false);
  assert.equal(capped.poisonTurnsAfterCombat, MAX_POISON_TURNS);

  // 出口守卫首次受必杀仅削减一半生命且不耗步
  const guardian = Object.freeze({ type: "guardian", hp: 45, weakened: false });
  const guardExec = calculateCombatOutcome({ hp: 30, poisonTurns: 0 }, guardian, false, true);
  assert.equal(guardExec.defeated, false);
  assert.equal(guardExec.weakenedGuardian, true);
  assert.equal(guardExec.nextEnemyHp, 22);
  assert.equal(guardExec.hpAfterAction, 30);
});

test("旧存档迁移幂等，补齐支线与碎片字段并保留未读文本与冷却起点", () => {
  const scene = { id: "first-item", kicker: "片段", text: "已经抽取的文本" };
  const old = { totalSteps: 45, currentStory: scene, lastStoryStep: 30, loreSeen: ["enemy:rat", "event:chest", "event:echo"] };
  const state = restoreState(old);
  assert.equal(state.currentStory.id, scene.id);
  assert.equal(state.currentStory.kicker, scene.kicker);
  assert.equal(state.currentStory.text, scene.text);
  assert.equal(state.lastStoryStep, 30);
  assert.equal(state.storyTriggerVersion, STORY_TRIGGER_VERSION);
  assert.deepEqual(state.loreSeen, ["event:chest", "event:echo"]);
  // 1.13.0：缺主线字段时安全接入，不编造分叉；按步数/lore 接到下一节点。
  assert.equal(state.mainBeat, "M2");
  assert.deepEqual(state.branchFlags, { F1: null, F2: null });
  assert.deepEqual(state.realityAnchors, ["event:echo"]);
  assert.equal(state.shrineSacrifices, 0);
  assert.deepEqual(state.shards, []);
  assert.equal(state.seedMode, "normal");
  const snapshot = JSON.stringify(state);
  assert.equal(JSON.stringify(restoreState(state)), snapshot);
});

test("旧存档 currentStory 可携带 mode/choices 并在恢复时保留", () => {
  const scene = {
    id: "f1-choice",
    kicker: "分叉 · 信谁",
    text: "下一段路在发亮。",
    mode: "choiceBar",
    choices: [
      { id: "illusion", label: "追幻觉更深" },
      { id: "reality", label: "抓住现实线索" }
    ]
  };
  const state = restoreState({
    totalSteps: 80,
    currentStory: scene,
    loreSeen: ["event:chest", "event:fog", "event:map"]
  });
  assert.equal(state.currentStory.mode, "choiceBar");
  assert.equal(state.currentStory.choices.length, 2);
  assert.equal(state.mainBeat, "F1");
});

test("存储层独立保存、读取与结算，排行榜优先逃生成功并按步数升序，只清除当前进度", () => {
  const values = new Map([["unrelated", "keep"]]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const store = new SaveStore(storage);
  const state = { version: SAVE_VERSION, active: true, maze: { seed: 1 } };
  store.save(state);
  assert.deepEqual(store.loadSavedState(), state);
  for (let steps = 0; steps < 25; steps++) store.completeRun({ steps, explored: steps });
  assert.equal(values.has(STORAGE_KEY), false);
  assert.equal(values.get("unrelated"), "keep");
  assert.equal(JSON.parse(values.get(RECORD_KEY)).length, 20);
  assert.equal(store.loadRecords()[0].steps, 24);

  // 逃生成功记录优先于未逃生记录，且逃生成功按步数越少排越前
  store.completeRun({ steps: 320, explored: 200, escaped: true });
  store.completeRun({ steps: 180, explored: 150, escaped: true });
  const ranked = store.loadRecords();
  assert.equal(ranked[0].escaped, true);
  assert.equal(ranked[0].steps, 180);
  assert.equal(ranked[1].steps, 320);
});

test("种子解析、每日种子与第三真结局/坠落路标结局分支", () => {
  assert.equal(parseSeedInput("0000002A"), 42);
  assert.equal(parseSeedInput(12345), 12345);
  assert.equal(formatSeedCode(42), "0000002A");
  assert.equal(dailySeed(new Date(2026, 10, 6)), dailySeed(new Date(2026, 10, 6)));

  assert.equal(getEnding("走出迷宫", true, { shards: [1, 2, 3] }).id, "ending-awakened");
  assert.equal(getEnding("走出迷宫", true, { storyScenes: ["sidequest-shrine-3"] }).id, "ending-awakened");
  assert.equal(getEnding("力竭倒下", false, { storyScenes: ["memory-75", "memory-50", "memory-25"] }).id, "ending-fallen-beacon");
  assert.equal(getEnding("走出迷宫", true, { shards: [1] }).id, "ending-escaped");
  assert.equal(getEnding("力竭倒下", false, {}).id, "ending-dead");
  assert.equal(getEnding("走出迷宫", true, { branchFlags: { F1: "illusion", F2: "sword" } }).text.includes("你曾把钟声当成出口"), true, "心神分叉尾巴句应保留");
});

test("发版信息三处同步：package.json、APP_VERSION 与开发者日记首条", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, APP_VERSION);
  assert.equal(DEV_DIARY[0].version, APP_VERSION);
  assert.equal(new Set(DEV_DIARY.map((entry) => entry.version)).size, DEV_DIARY.length, "日记版本号不应重复");
});

test("开发者日记已读进度独立保存，不影响存档与纪录", () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const store = new SaveStore(storage);
  assert.equal(store.loadSeenDiaryVersion(), null);
  store.saveSeenDiaryVersion("1.11.0");
  assert.equal(store.loadSeenDiaryVersion(), "1.11.0");
  assert.equal(values.has(STORAGE_KEY), false);
});


test("旧档已有 F1 flag 且停在 F1 时跳到 M3，不重弹", () => {
  const state = restoreState({
    totalSteps: 120,
    loreSeen: ["event:chest", "event:fog", "event:map"],
    mainBeat: "F1",
    branchFlags: { F1: "illusion", F2: null }
  });
  assert.equal(state.mainBeat, "M3a");
  assert.equal(state.branchFlags.F1, "illusion");
});


test("心神仅 <60 每回合扣 1 HP", () => {
  assert.equal(fearHpPerTurn(100), 0);
  assert.equal(fearHpPerTurn(60), 0);
  assert.equal(fearHpPerTurn(59), 1);
  assert.equal(fearHpPerTurn(0), 1);
});

test("死亡结局不写梦醒回村；出口仍走醒来", () => {
  const dead = getEnding("心神崩溃", false);
  assert.equal(dead.id, "ending-dead");
  assert.equal(dead.mode, "death");
  assert.equal(dead.text.includes("梦醒"), false);
  assert.equal(dead.text.includes("回村"), false);
  assert.ok(dead.text.includes("暗红走廊没有碎裂"));
  const lived = getEnding("出口", true);
  assert.equal(lived.id, "ending-escaped");
  assert.ok(lived.text.includes("天光"));
});

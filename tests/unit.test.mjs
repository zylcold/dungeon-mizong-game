import test from "node:test";
import assert from "node:assert/strict";
import { generateMaze, shortestPath } from "../src/core/maze.js";
import { calculateCombatOutcome } from "../src/core/combat.js";
import { restoreState } from "../src/state/migrations.js";
import { SaveStore } from "../src/state/save-store.js";
import { SAVE_VERSION, STORAGE_KEY, RECORD_KEY, STORY_TRIGGER_VERSION } from "../src/config.js";

test("迷宫模块不依赖 DOM，同一种子生成相同拓扑和实体", () => {
  const first = generateMaze(20260904);
  assert.deepEqual(first, generateMaze(20260904));
  assert.ok(first.loopCount > 0);
  for (const exit of first.exits) {
    assert.ok(shortestPath(first.bits, { x: 67, y: 67 }, exit).length > 1);
    assert.equal(first.entities[`${exit.x},${exit.y}`], undefined);
  }
});

test("纯战斗计算包含本步毒伤且不会修改状态", () => {
  const state = Object.freeze({ hp: 12, poisonTurns: 0 });
  const slime = Object.freeze({ type: "slime", hp: 10 });
  const outcome = calculateCombatOutcome(state, slime, false);
  assert.equal(outcome.defeated, true);
  assert.equal(outcome.poisonDamage, 2);
  assert.equal(outcome.survives, false);
  assert.equal(calculateCombatOutcome(state, slime, true).hpAfterAction, 2);
  assert.equal(calculateCombatOutcome(state, slime, false, true).hpAfterAction, 12);
  assert.equal(calculateCombatOutcome({ hp: 2, poisonTurns: 1 }, slime, false, true).survives, false);
});

test("旧存档迁移幂等，并保留未读文本与冷却起点", () => {
  const scene = { id: "first-item", kicker: "片段", text: "已经抽取的文本" };
  const old = { totalSteps: 45, currentStory: scene, lastStoryStep: 30, loreSeen: ["enemy:rat", "event:chest"] };
  const state = restoreState(old);
  assert.equal(state.currentStory, scene);
  assert.equal(state.lastStoryStep, 30);
  assert.equal(state.storyTriggerVersion, STORY_TRIGGER_VERSION);
  assert.deepEqual(state.loreSeen, ["event:chest"]);
  const snapshot = JSON.stringify(state);
  assert.equal(JSON.stringify(restoreState(state)), snapshot);
});

test("存储层独立保存、读取与结算，只清除当前进度", () => {
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
});

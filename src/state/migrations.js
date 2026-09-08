/** 补齐旧存档字段，不修改存档键、游戏版本或已保存的随机文本。 */
import { NORMAL_STORY_MIN_GAP_STEPS, STORY_TRIGGER_VERSION } from "../config.js";

const REALITY_ANCHOR_KEYS = ["event:echo", "item:potion", "event:cache"];

/** 旧档无主线字段时，不补历史分叉，只按当前进度接到下一主线节点。 */
export function deriveMainBeat(state) {
  const steps = Number.isFinite(state.totalSteps) ? state.totalSteps : 0;
  const loreCount = Array.isArray(state.loreSeen) ? state.loreSeen.length : 0;
  if (steps <= 0) return "M0";
  if (steps < 20) return "M1";
  if (loreCount < 3) return "M2";
  return "F1";
}

export function restoreState(state) {
  state.storyScenes = Array.isArray(state.storyScenes) ? state.storyScenes : [];
  state.loreSeen = Array.isArray(state.loreSeen) ? state.loreSeen : [];
  if (state.storyTriggerVersion !== STORY_TRIGGER_VERSION) {
    if (!Number.isFinite(state.storyTriggerVersion) || state.storyTriggerVersion < 2) {
      state.loreSeen = state.loreSeen.filter(key => !key.startsWith("enemy:") && !key.startsWith("item:"));
    }
    state.storyTriggerVersion = STORY_TRIGGER_VERSION;
  }
  state.lastStoryStep = Number.isFinite(state.lastStoryStep) ? state.lastStoryStep : -NORMAL_STORY_MIN_GAP_STEPS;
  // 旧档缺 lastNormalStoryStep 时沿用 lastStoryStep，避免放宽迁移前的演出节奏。
  state.lastNormalStoryStep = Number.isFinite(state.lastNormalStoryStep) ? state.lastNormalStoryStep : state.lastStoryStep;
  // 演出队列已移除：旧档中排队内容直接丢弃，等对应内容下次触发时再走演出逻辑。
  delete state.pendingStories;
  state.hpStoryRatioLow = Number.isFinite(state.hpStoryRatioLow) ? state.hpStoryRatioLow : 1;
  delete state.storySequence;
  delete state.normalStoryGapJitter;
  const currentStory = state.currentStory;
  state.currentStory = currentStory && typeof currentStory.id === "string"
    && typeof currentStory.kicker === "string" && typeof currentStory.text === "string"
    ? {
      id: currentStory.id,
      kicker: currentStory.kicker,
      text: currentStory.text,
      buttonLabel: typeof currentStory.buttonLabel === "string" ? currentStory.buttonLabel : "继续",
      markIds: Array.isArray(currentStory.markIds) ? currentStory.markIds : [],
      // 1.13.0 向前兼容：旧档无 mode/choices 时保持 undefined，恢复不炸。
      ...(typeof currentStory.mode === "string" ? { mode: currentStory.mode } : {}),
      ...(Array.isArray(currentStory.choices) ? { choices: currentStory.choices } : {})
    }
    : null;
  state.nextAmbientStep = Number.isFinite(state.nextAmbientStep) ? state.nextAmbientStep : state.totalSteps + 8;

  // 1.13.0 主线字段：缺则安全接入，不编造历史分叉选择。
  const hadMainBeat = typeof state.mainBeat === "string" && state.mainBeat.length > 0;
  state.mainBeat = hadMainBeat ? state.mainBeat : deriveMainBeat(state);
  const flags = state.branchFlags && typeof state.branchFlags === "object" && !Array.isArray(state.branchFlags)
    ? state.branchFlags
    : {};
  state.branchFlags = {
    F1: flags.F1 === "illusion" || flags.F1 === "reality" ? flags.F1 : null,
    F2: flags.F2 === "sword" || flags.F2 === "basket" || flags.F2 === "signal" ? flags.F2 : null
  };
  const anchors = Array.isArray(state.realityAnchors)
    ? state.realityAnchors.filter((key) => typeof key === "string")
    : [];
  // 若旧档已见锚点 lore 但尚未有 realityAnchors，从 loreSeen 回填（这是已发生事实，不是编造分叉）。
  REALITY_ANCHOR_KEYS.forEach((key) => {
    if (state.loreSeen.includes(key) && !anchors.includes(key)) anchors.push(key);
  });
  state.realityAnchors = anchors;
  // 1.14.0 恐惧值：旧档缺字段时按满心神接入，不回溯扣血。
  state.fear = Number.isFinite(state.fear) ? Math.max(0, Math.min(100, state.fear)) : 100;
  state.fearDrainMilestone = Number.isFinite(state.fearDrainMilestone)
    ? state.fearDrainMilestone
    : Math.floor((Number.isFinite(state.totalSteps) ? state.totalSteps : 0) / 100);
  state.fearTier = Number.isFinite(state.fearTier) ? state.fearTier : (state.fear <= 20 ? 4 : state.fear <= 40 ? 3 : state.fear <= 60 ? 2 : state.fear <= 80 ? 1 : 0);
  return state;
}

/** 补齐旧存档字段，不修改存档键、游戏版本或已保存的随机文本。 */
import { NORMAL_STORY_MIN_GAP_STEPS, STORY_COOLDOWN_STEPS, STORY_TRIGGER_VERSION } from "../config.js";

export function restoreState(state) {
  state.storyScenes = Array.isArray(state.storyScenes) ? state.storyScenes : [];
  state.loreSeen = Array.isArray(state.loreSeen) ? state.loreSeen : [];
  if (state.storyTriggerVersion !== STORY_TRIGGER_VERSION) {
    if (!Number.isFinite(state.storyTriggerVersion) || state.storyTriggerVersion < 2) {
      state.loreSeen = state.loreSeen.filter(key => !key.startsWith("enemy:") && !key.startsWith("item:"));
    }
    state.storyTriggerVersion = STORY_TRIGGER_VERSION;
  }
  state.lastStoryStep = Number.isFinite(state.lastStoryStep) ? state.lastStoryStep : -STORY_COOLDOWN_STEPS;
  // 旧档缺 lastNormalStoryStep 时沿用 lastStoryStep，避免放宽迁移前的演出节奏。
  state.lastNormalStoryStep = Number.isFinite(state.lastNormalStoryStep) ? state.lastNormalStoryStep : state.lastStoryStep;
  state.normalStoryGapJitter = Number.isFinite(state.normalStoryGapJitter) ? state.normalStoryGapJitter : 0;
  state.pendingStories = Array.isArray(state.pendingStories) ? state.pendingStories : [];
  const currentStory = state.currentStory;
  state.currentStory = currentStory && typeof currentStory.id === "string"
    && typeof currentStory.kicker === "string" && typeof currentStory.text === "string"
    ? currentStory : null;
  state.storySequence = Number.isFinite(state.storySequence) ? state.storySequence : 0;
  state.nextAmbientStep = Number.isFinite(state.nextAmbientStep) ? state.nextAmbientStep : state.totalSteps + 8;
  return state;
}

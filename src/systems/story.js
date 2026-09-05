/** 剧情优先队列、限频与未读演出恢复。 */
import { NORMAL_STORY_MIN_GAP_STEPS, STORY_COOLDOWN_STEPS, STORY_PRIORITY } from "../config.js";
import { roomKey } from "../core/coordinates.js";
import { AMBIENT_COPY } from "../data/copy.js";
import { LORE_SCENES, STORY_SCENES } from "../data/stories.js";

const STORY_VARIANT_FILLERS = [
  "你停下半息，确认这段念头还在脑海里。",
  "你把这段记忆压在心底，继续向前。"
];
const STORY_VARIANT_DEFAULT = "你在黑暗里停住呼吸，确认自己仍要继续向前。";

export class StorySystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.storyOnClose = null;
  }

  pickCopy(items, key, salt) {
    if (!items || !items.length) return "";
    const index = Math.floor(this.game.events.eventRoll(key, salt) * items.length);
    return items[Math.min(items.length - 1, index)];
  }

  addOpeningAtmosphere() {
    const key = roomKey(this.game.state.player.x, this.game.state.player.y);
    const firstIndex = Math.floor(this.game.events.eventRoll(key, "opening-a") * AMBIENT_COPY.length);
    let secondIndex = Math.floor(this.game.events.eventRoll(key, "opening-b") * AMBIENT_COPY.length);
    if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % AMBIENT_COPY.length;
    this.game.ui.addLog("system", "·", AMBIENT_COPY[firstIndex]);
    this.game.ui.addLog("system", "·", AMBIENT_COPY[secondIndex]);
  }

  maybeAddAmbientLog() {
    if (!this.game.state || this.game.state.totalSteps < this.game.state.nextAmbientStep) return;
    const key = roomKey(this.game.state.player.x, this.game.state.player.y);
    const text = this.pickCopy(AMBIENT_COPY, key, `ambient-${this.game.state.totalSteps}`);
    this.game.ui.addLog("system", "·", text);
    const gapRoll = this.game.events.eventRoll(key, `ambient-gap-${this.game.state.totalSteps}`);
    this.game.state.nextAmbientStep = this.game.state.totalSteps + 8 + Math.floor(gapRoll * 9);
  }

  checkStoryProgress() {
    if (!this.game.state || !this.game.state.active || this.game.state.hp <= 0 || this.game.state.currentStory || !this.dom.storyOverlay.hidden) return;
    this.game.state.storyScenes = Array.isArray(this.game.state.storyScenes) ? this.game.state.storyScenes : [];
    const healthRatio = this.game.state.hp / Math.max(1, this.game.state.maxHp);
    const eligible = STORY_SCENES.filter((scene) => (
      healthRatio <= scene.threshold && !this.game.state.storyScenes.includes(scene.id)
    ));
    if (!eligible.length) return;
    const scene = eligible[eligible.length - 1];
    eligible.forEach((item) => {
      if (!this.game.state.storyScenes.includes(item.id)) this.game.state.storyScenes.push(item.id);
    });
    this.queueRandomStory(scene.id, `记忆残片 · ${scene.title}`, scene, "继续前行", STORY_PRIORITY.health);
    this.game.save();
  }

  pickStoryVariant(sceneKey, story) {
    const candidates = this.buildStoryCandidates(story);
    if (!candidates.length) return { key: "fallback", text: "" };
    const playerKey = roomKey(this.game.state.player.x, this.game.state.player.y);
    const roll = this.game.events.eventRoll(playerKey, `story-variant-${sceneKey}-${this.game.state.totalSteps}`);
    const index = Math.min(candidates.length - 1, Math.floor(roll * candidates.length));
    return { key: `v${index + 1}`, text: candidates[index] };
  }

  clipStoryParagraphs(text, maxParagraphs = 3) {
    if (typeof text !== "string") return "";
    const parts = text.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return "";
    return parts.slice(0, maxParagraphs).join("\n\n");
  }

  buildStoryCandidates(story) {
    const unique = [];
    const pushUnique = (text) => {
      const normalized = this.clipStoryParagraphs(text);
      if (!normalized || unique.includes(normalized)) return;
      unique.push(normalized);
    };
    if (Array.isArray(story?.variants)) story.variants.forEach(pushUnique);
    pushUnique(story?.illusion);
    pushUnique(story?.reality);
    if (!unique.length) return [STORY_VARIANT_DEFAULT];
    if (story?.allowAutoVariants === false) return unique.slice(0, 5);
    const baseA = unique[0] || "";
    const baseB = unique[1] || baseA;
    [`${baseA}\n\n${baseB}`, `${baseB}\n\n${baseA}`].forEach(pushUnique);
    if (unique.length < 3) {
      const paddedBase = baseA || STORY_VARIANT_DEFAULT;
      STORY_VARIANT_FILLERS.forEach((filler) => {
        if (unique.length < 3) pushUnique(`${paddedBase}\n\n${filler}`);
      });
    }
    return unique.slice(0, 5);
  }

  queueRandomStory(sceneKey, kicker, story, buttonLabel = "继续", priority = STORY_PRIORITY.event, options = {}) {
    const variant = this.pickStoryVariant(sceneKey, story);
    this.scheduleStory({
      id: `${sceneKey}-${variant.key}`,
      kicker,
      text: variant.text,
      buttonLabel
    }, priority, options);
  }

  queueFirstLore(loreKey) {
    if (!this.game.state || !this.game.state.active) return false;
    const lore = LORE_SCENES[loreKey];
    if (!lore) return false;
    this.game.state.loreSeen = Array.isArray(this.game.state.loreSeen) ? this.game.state.loreSeen : [];
    if (this.game.state.loreSeen.includes(loreKey)) return false;
    this.game.state.loreSeen.push(loreKey);
    const sceneId = loreKey.replace(":", "-");
    const category = loreKey.split(":")[0];
    this.queueRandomStory(
      `lore-${sceneId}`,
      `残缺片段 · ${lore.title}`,
      lore,
      "继续",
      STORY_PRIORITY[category] || STORY_PRIORITY.item
    );
    this.game.save();
    return true;
  }

  scheduleStory(scene, priority, options = {}) {
    if (!this.game.state || !this.game.state.active) return false;
    this.game.state.pendingStories = Array.isArray(this.game.state.pendingStories) ? this.game.state.pendingStories : [];
    if (this.game.state.pendingStories.some((entry) => entry.scene.id === scene.id)) return false;
    this.game.state.storySequence = Number.isFinite(this.game.state.storySequence) ? this.game.state.storySequence : 0;
    this.game.state.pendingStories.push({
      scene,
      priority,
      triggerStep: this.game.state.totalSteps,
      order: this.game.state.storySequence,
      special: Boolean(options.special)
    });
    this.game.state.storySequence += 1;
    this.game.save();
    return true;
  }

  tryShowPendingStory() {
    if (!this.game.state || !this.game.state.active || !this.dom.storyOverlay.hidden || !this.dom.startOverlay.hidden || !this.dom.endOverlay.hidden || this.game.pending) return false;
    // 恢复的是同一次未读演出，不重新抽签，也不重新消耗 30 步演出额度。
    if (this.game.state.currentStory) return this.showStory(this.game.state.currentStory);
    this.game.state.pendingStories = Array.isArray(this.game.state.pendingStories) ? this.game.state.pendingStories : [];
    if (!this.game.state.pendingStories.length) return false;
    this.game.state.pendingStories.sort((a, b) => (
      b.priority - a.priority || a.triggerStep - b.triggerStep || a.order - b.order
    ));
    const specialIndex = this.game.state.pendingStories.findIndex((entry) => (
      entry.special || /^intro-|^ending-/u.test(entry.scene.id)
    ));
    const lastStep = Number.isFinite(this.game.state.lastStoryStep) ? this.game.state.lastStoryStep : -STORY_COOLDOWN_STEPS;
    const lastNormalStep = Number.isFinite(this.game.state.lastNormalStoryStep)
      ? this.game.state.lastNormalStoryStep
      : -NORMAL_STORY_MIN_GAP_STEPS;
    if (this.game.state.totalSteps === lastStep) return false;
    if (specialIndex < 0 && this.game.state.totalSteps - lastNormalStep < NORMAL_STORY_MIN_GAP_STEPS) return false;
    const entry = specialIndex >= 0
      ? this.game.state.pendingStories.splice(specialIndex, 1)[0]
      : this.game.state.pendingStories.shift();
    this.game.state.lastStoryStep = this.game.state.totalSteps;
    if (!(entry.special || /^intro-|^ending-/u.test(entry.scene.id))) {
      this.game.state.lastNormalStoryStep = this.game.state.totalSteps;
    }
    const shown = this.showStory(entry.scene);
    if (!shown) {
      this.game.state.pendingStories.unshift(entry);
      this.game.state.lastStoryStep = lastStep;
      this.game.state.lastNormalStoryStep = lastNormalStep;
      return false;
    }
    this.game.save();
    return true;
  }

  showStory({ id, kicker, text, buttonLabel = "继续", onClose = null, markIds = [] }) {
    if (!this.dom.storyOverlay.hidden) return false;
    this.game.movement.cancelAutoPath();
    if (this.game.state && this.game.state.active) {
      this.game.state.currentStory = { id, kicker, text, buttonLabel, markIds: Array.isArray(markIds) ? markIds : [] };
    }
    this.dom.storyKicker.textContent = kicker;
    this.dom.storyText.textContent = text;
    this.dom.storyContinueButton.textContent = buttonLabel;
    this.storyOnClose = onClose;
    this.dom.storyOverlay.hidden = false;
    this.dom.storyOverlay.classList.remove("visible");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.dom.storyOverlay.classList.add("visible"));
    });
    this.game.save();
    return true;
  }

  hideStory() {
    if (this.dom.storyOverlay.hidden) return;
    this.dom.storyOverlay.classList.remove("visible");
    this.dom.storyOverlay.hidden = true;
    if (this.game.state && this.game.state.active && this.game.state.currentStory) {
      const scene = this.game.state.currentStory;
      this.game.state.storyScenes = Array.isArray(this.game.state.storyScenes) ? this.game.state.storyScenes : [];
      [scene.id].concat(scene.markIds || []).forEach((sceneId) => {
        if (sceneId && !this.game.state.storyScenes.includes(sceneId)) this.game.state.storyScenes.push(sceneId);
      });
      this.game.state.currentStory = null;
      this.game.save();
    }
    const onClose = this.storyOnClose;
    this.storyOnClose = null;
    if (typeof onClose === "function") onClose();
  }
}

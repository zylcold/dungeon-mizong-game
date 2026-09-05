/** 剧情即时演出：触发即播，条件不满足直接跳过，等下次同类触发再走完整逻辑；不维护演出队列。 */
import { NORMAL_STORY_MIN_GAP_STEPS } from "../config.js";
import { roomKey } from "../core/coordinates.js";
import { AMBIENT_COPY } from "../data/copy.js";
import { OPENING_STORY } from "../data/endings.js";
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
    const variant = this.pickStoryVariant(scene.id, scene);
    // 演出被跳过时不标记 storyScenes，血量下次检查会重新尝试。
    this.tryPlayStory({
      id: `${scene.id}-${variant.key}`,
      kicker: `记忆残片 · ${scene.title}`,
      text: variant.text,
      buttonLabel: "继续前行",
      markIds: [scene.id]
    });
  }

  pickStoryVariant(sceneKey, story) {
    const candidates = this.buildStoryCandidates(story);
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
    if (unique.length >= 2) [`${baseA}\n\n${baseB}`, `${baseB}\n\n${baseA}`].forEach(pushUnique);
    if (unique.length < 3) {
      // 基底先截到两段，让 filler 成为第三段，避免三段截断后退化成重复文本而被去重丢弃。
      const paddedBase = this.clipStoryParagraphs(baseA || STORY_VARIANT_DEFAULT, 2);
      STORY_VARIANT_FILLERS.forEach((filler) => {
        if (unique.length < 3) pushUnique(`${paddedBase}\n\n${filler}`);
      });
    }
    return unique.slice(0, 5);
  }

  playOpeningStory() {
    const variant = this.pickStoryVariant("intro", OPENING_STORY);
    return this.tryPlayStory({
      id: `intro-${variant.key}`,
      kicker: "序章 · 醒来",
      text: variant.text,
      buttonLabel: "开始探索"
    }, { special: true });
  }

  tryPlayLore(loreKey) {
    if (!this.game.state || !this.game.state.active) return false;
    const lore = LORE_SCENES[loreKey];
    if (!lore) return false;
    this.game.state.loreSeen = Array.isArray(this.game.state.loreSeen) ? this.game.state.loreSeen : [];
    if (this.game.state.loreSeen.includes(loreKey)) return false;
    const sceneId = loreKey.replace(":", "-");
    const variant = this.pickStoryVariant(`lore-${sceneId}`, lore);
    const played = this.tryPlayStory({
      id: `lore-${sceneId}-${variant.key}`,
      kicker: `残缺片段 · ${lore.title}`,
      text: variant.text,
      buttonLabel: "继续"
    });
    // 只有真正演出过才标记 loreSeen；被跳过的片段留待下次同类触发重试。
    if (played) {
      this.game.state.loreSeen.push(loreKey);
      this.game.save();
    }
    return played;
  }

  tryPlayStory(scene, options = {}) {
    if (!this.game.state || !this.game.state.active) return false;
    if (!this.dom.storyOverlay.hidden || !this.dom.startOverlay.hidden || !this.dom.endOverlay.hidden || this.game.pending) return false;
    if (this.game.state.currentStory) return false;
    const special = Boolean(options.special) || /^intro-|^ending-/u.test(scene.id);
    const lastStep = Number.isFinite(this.game.state.lastStoryStep) ? this.game.state.lastStoryStep : -NORMAL_STORY_MIN_GAP_STEPS;
    const lastNormalStep = Number.isFinite(this.game.state.lastNormalStoryStep)
      ? this.game.state.lastNormalStoryStep
      : -NORMAL_STORY_MIN_GAP_STEPS;
    // 同一步绝不连弹；普通演出至少间隔 20 步，间隔内触发直接跳过、不排队。
    if (this.game.state.totalSteps === lastStep) return false;
    if (!special && this.game.state.totalSteps - lastNormalStep < NORMAL_STORY_MIN_GAP_STEPS) return false;
    if (!this.showStory(scene)) return false;
    this.game.state.lastStoryStep = this.game.state.totalSteps;
    if (!special) this.game.state.lastNormalStoryStep = this.game.state.totalSteps;
    this.game.save();
    return true;
  }

  tryResumeStory() {
    if (!this.game.state || !this.game.state.active || !this.game.state.currentStory) return false;
    if (!this.dom.storyOverlay.hidden || !this.dom.startOverlay.hidden || !this.dom.endOverlay.hidden || this.game.pending) return false;
    // 恢复的是同一次未读演出，不重新抽签，也不重新消耗普通演出间隔额度。
    return this.showStory(this.game.state.currentStory);
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

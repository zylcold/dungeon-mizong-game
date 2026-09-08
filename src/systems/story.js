/** 剧情即时演出：触发即播，条件不满足直接跳过，等下次同类触发再走完整逻辑；不维护演出队列。 */
import { NORMAL_STORY_MIN_GAP_STEPS } from "../config.js";
import { roomKey } from "../core/coordinates.js";
import { AMBIENT_COPY } from "../data/copy.js";
import { MAINLINE_BEATS } from "../data/mainline.js";
import { LORE_SCENES, STORY_SCENES } from "../data/stories.js";

const STORY_VARIANT_FILLERS = [
  "你停下半息，确认这段念头还在脑海里。",
  "你把这段记忆压在心底，继续向前。"
];
const STORY_VARIANT_DEFAULT = "你在黑暗里停住呼吸，确认自己仍要继续向前。";

/** 计入 realityAnchors 的现实锚点 lore key（与产品 F2 第三选项对齐）。 */
export const REALITY_ANCHOR_KEYS = ["event:echo", "item:potion", "event:cache"];

export class StorySystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.storyOnClose = null;
    this.proximateHold = false;
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
    if (!this.game.state || !this.game.state.active || this.game.state.hp <= 0) return;
    // 主线优先于血量碎片；条件未到则继续走旧碎片逻辑。
    if (this.tryAdvanceMainline()) return;
    this.game.state.storyScenes = Array.isArray(this.game.state.storyScenes) ? this.game.state.storyScenes : [];
    const healthRatio = this.game.state.hp / Math.max(1, this.game.state.maxHp);
    const previousLow = Number.isFinite(this.game.state.hpStoryRatioLow) ? this.game.state.hpStoryRatioLow : 1;
    if (healthRatio >= previousLow) return;
    this.game.state.hpStoryRatioLow = healthRatio;
    this.game.save();
    if (this.proximateHold) return;
    const eligible = STORY_SCENES.filter((scene) => (
      healthRatio <= scene.threshold && !this.game.state.storyScenes.includes(scene.id)
    ));
    if (!eligible.length) return;
    const scene = eligible[eligible.length - 1];
    const variant = this.pickStoryVariant(scene.id, scene);
    this.tryPlayStory({
      id: `${scene.id}-${variant.key}`,
      kicker: `记忆残片 · ${scene.title}`,
      text: variant.text,
      buttonLabel: "继续前行",
      markIds: [scene.id],
      mode: "lore"
    });
  }

  /** 若当前 mainBeat 条件满足则播出；返回是否已占用演出窗。 */
  tryAdvanceMainline() {
    if (!this.game.state || !this.game.state.active) return false;
    if (this.proximateHold) return false;
    const beatId = this.game.state.mainBeat;
    if (!beatId || beatId === "E") return false;
    const beat = MAINLINE_BEATS[beatId];
    if (!beat) return false;
    if (!this.mainlineRequirementsMet(beat)) return false;
    return this.playMainlineBeat(beat);
  }

  mainlineRequirementsMet(beat) {
    const require = beat.require || {};
    const steps = Number.isFinite(this.game.state.totalSteps) ? this.game.state.totalSteps : 0;
    const loreCount = Array.isArray(this.game.state.loreSeen) ? this.game.state.loreSeen.length : 0;
    if (Number.isFinite(require.minSteps) && steps < require.minSteps) return false;
    if (Number.isFinite(require.minLore) && loreCount < require.minLore) return false;
    return true;
  }

  resolveChoices(beat) {
    const anchors = Array.isArray(this.game.state.realityAnchors) ? this.game.state.realityAnchors : [];
    const hasAnchor = anchors.length > 0;
    return (beat.choices || []).filter((choice) => {
      if (choice.requireAnchor) return hasAnchor;
      return choice.always !== false;
    }).map((choice) => ({
      id: choice.id,
      label: choice.label,
      echo: choice.echo,
      nextBeat: choice.nextBeat
    }));
  }

  playMainlineBeat(beat) {
    const payload = {
      id: `main-${beat.id}`,
      kicker: beat.kicker,
      text: beat.text || "",
      buttonLabel: beat.buttonLabel || "继续",
      mode: beat.mode || "storyCard",
      beatId: beat.id,
      nextBeat: beat.nextBeat || null,
      illusion: beat.illusion || "",
      reality: beat.reality || "",
      flagKey: beat.flagKey || null
    };
    if (beat.mode === "choiceBar") {
      payload.choices = this.resolveChoices(beat);
      if (!payload.choices.length) return false;
    }
    return this.tryPlayMainBeat(payload);
  }

  playOpeningStory() {
    const beat = MAINLINE_BEATS.M0;
    this.game.state.mainBeat = "M0";
    return this.playMainlineBeat(beat);
  }

  /**
   * 主线节点通道：始终 special，绕过普通 20 步冷却；同一步/遮罩互斥仍生效。
   */
  tryPlayMainBeat(scene, options = {}) {
    return this.tryPlayStory(scene, { ...options, special: true });
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
      const paddedBase = this.clipStoryParagraphs(baseA || STORY_VARIANT_DEFAULT, 2);
      STORY_VARIANT_FILLERS.forEach((filler) => {
        if (unique.length < 3) pushUnique(`${paddedBase}\n\n${filler}`);
      });
    }
    return unique.slice(0, 5);
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
      buttonLabel: "继续",
      mode: "lore"
    });
    if (played) {
      this.game.state.loreSeen.push(loreKey);
      this.game.state.realityAnchors = Array.isArray(this.game.state.realityAnchors)
        ? this.game.state.realityAnchors
        : [];
      if (REALITY_ANCHOR_KEYS.includes(loreKey) && !this.game.state.realityAnchors.includes(loreKey)) {
        this.game.state.realityAnchors.push(loreKey);
      }
      this.game.save();
    }
    return played;
  }

  tryPlayStory(scene, options = {}) {
    if (!this.game.state || !this.game.state.active) return false;
    if (!this.dom.storyOverlay.hidden || !this.dom.startOverlay.hidden || !this.dom.endOverlay.hidden || this.game.pending) return false;
    if (this.game.state.currentStory) return false;
    const special = Boolean(options.special) || /^intro-|^ending-|^main-/u.test(scene.id);
    const lastStep = Number.isFinite(this.game.state.lastStoryStep) ? this.game.state.lastStoryStep : -NORMAL_STORY_MIN_GAP_STEPS;
    const lastNormalStep = Number.isFinite(this.game.state.lastNormalStoryStep)
      ? this.game.state.lastNormalStoryStep
      : -NORMAL_STORY_MIN_GAP_STEPS;
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
    return this.showStory(this.game.state.currentStory);
  }

  clearStoryModeClasses() {
    const overlay = this.dom.storyOverlay;
    if (!overlay) return;
    overlay.classList.remove("mode-lore", "mode-storyCard", "mode-dualPanel", "mode-choiceBar", "mode-echo");
  }

  applyStoryMode(mode) {
    this.clearStoryModeClasses();
    const resolved = typeof mode === "string" && mode ? mode : "lore";
    this.dom.storyOverlay.classList.add(`mode-${resolved}`);
    const isDual = resolved === "dualPanel";
    const isChoice = resolved === "choiceBar";
    if (this.dom.storyText) this.dom.storyText.hidden = isDual;
    if (this.dom.storyDual) this.dom.storyDual.hidden = !isDual;
    if (this.dom.storyChoices) this.dom.storyChoices.hidden = !isChoice;
    if (this.dom.storyContinueButton) this.dom.storyContinueButton.hidden = isChoice;
  }

  renderChoices(choices) {
    const host = this.dom.storyChoices;
    if (!host) return;
    host.innerHTML = "";
    (choices || []).forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "story-choice";
      button.textContent = choice.label;
      button.dataset.choiceId = choice.id;
      host.appendChild(button);
    });
  }

  showStory({
    id,
    kicker,
    text,
    buttonLabel = "继续",
    onClose = null,
    markIds = [],
    mode = "lore",
    choices = null,
    beatId = null,
    nextBeat = null,
    illusion = "",
    reality = "",
    flagKey = null,
    choiceId = null
  }) {
    if (!this.dom.storyOverlay.hidden) return false;
    this.game.movement.cancelAutoPath();
    const resolvedMode = typeof mode === "string" && mode ? mode : "lore";
    const resolvedChoices = Array.isArray(choices) ? choices : null;
    if (this.game.state && this.game.state.active) {
      const payload = {
        id,
        kicker,
        text: text || "",
        buttonLabel,
        markIds: Array.isArray(markIds) ? markIds : [],
        mode: resolvedMode
      };
      if (resolvedChoices) payload.choices = resolvedChoices;
      if (typeof beatId === "string") payload.beatId = beatId;
      if (typeof nextBeat === "string") payload.nextBeat = nextBeat;
      if (illusion) payload.illusion = illusion;
      if (reality) payload.reality = reality;
      if (typeof flagKey === "string") payload.flagKey = flagKey;
      if (typeof choiceId === "string") payload.choiceId = choiceId;
      this.game.state.currentStory = payload;
    }
    this.applyStoryMode(resolvedMode);
    this.dom.storyKicker.textContent = kicker;
    this.dom.storyText.textContent = text || "";
    if (this.dom.storyIllusion) this.dom.storyIllusion.textContent = illusion || "";
    if (this.dom.storyReality) this.dom.storyReality.textContent = reality || "";
    if (resolvedMode === "choiceBar") this.renderChoices(resolvedChoices || []);
    else if (this.dom.storyChoices) this.dom.storyChoices.innerHTML = "";
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

  /** ChoiceBar 选项：锁分叉、播回响、推进主线。 */
  chooseMainlineOption(choiceId) {
    if (!this.game.state || !this.game.state.active || !this.game.state.currentStory) return false;
    const scene = this.game.state.currentStory;
    if (scene.mode !== "choiceBar" || !Array.isArray(scene.choices)) return false;
    const choice = scene.choices.find((item) => item.id === choiceId);
    if (!choice) return false;
    const flagKey = scene.flagKey || scene.beatId;
    this.game.state.branchFlags = this.game.state.branchFlags && typeof this.game.state.branchFlags === "object"
      ? this.game.state.branchFlags
      : { F1: null, F2: null };
    if (flagKey === "F1" || flagKey === "F2") this.game.state.branchFlags[flagKey] = choice.id;
    // 先清掉当前 ChoiceBar，再以 echo 卡片播出（special，同一步可能互斥——临时放宽：直接 showStory 前清 currentStory）。
    this.dom.storyOverlay.classList.remove("visible");
    this.dom.storyOverlay.hidden = true;
    this.game.state.currentStory = null;
    this.game.state.lastStoryStep = this.game.state.totalSteps - 1;
    this.game.save();
    return this.tryPlayMainBeat({
      id: `main-${scene.beatId || "choice"}-echo-${choice.id}`,
      kicker: scene.kicker || "回响",
      text: choice.echo || "",
      buttonLabel: "继续",
      mode: "echo",
      beatId: scene.beatId,
      nextBeat: choice.nextBeat || scene.nextBeat || null,
      choiceId: choice.id
    });
  }

  hideStory() {
    if (this.dom.storyOverlay.hidden) return;
    this.dom.storyOverlay.classList.remove("visible");
    this.dom.storyOverlay.hidden = true;
    this.clearStoryModeClasses();
    if (this.dom.storyChoices) this.dom.storyChoices.innerHTML = "";
    if (this.dom.storyDual) this.dom.storyDual.hidden = true;
    if (this.dom.storyText) this.dom.storyText.hidden = false;
    if (this.dom.storyContinueButton) this.dom.storyContinueButton.hidden = false;
    if (this.game.state && this.game.state.active && this.game.state.currentStory) {
      const scene = this.game.state.currentStory;
      this.game.state.storyScenes = Array.isArray(this.game.state.storyScenes) ? this.game.state.storyScenes : [];
      [scene.id].concat(scene.markIds || []).forEach((sceneId) => {
        if (sceneId && !this.game.state.storyScenes.includes(sceneId)) this.game.state.storyScenes.push(sceneId);
      });
      if (typeof scene.nextBeat === "string" && scene.nextBeat) {
        this.game.state.mainBeat = scene.nextBeat;
      } else if (typeof scene.beatId === "string" && scene.beatId === "M0") {
        this.game.state.mainBeat = "M1";
      }
      this.game.state.currentStory = null;
      this.game.save();
    } else if (this.game.state) {
      this.game.state.currentStory = null;
    }
    const onClose = this.storyOnClose;
    this.storyOnClose = null;
    if (typeof onClose === "function") onClose();
  }
}

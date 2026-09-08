/** 心神（恐惧值）：1.14.1 起仅 <60 每回合扣 1 HP；静行可回升。 */

export const FEAR_MAX = 100;
export const FEAR_POTION_RESTORE = 20;
export const FEAR_VISION_RESTORE = 15;
export const FEAR_STEPS_PER_DRAIN = 100;
export const FEAR_COMBAT_DRAIN_MIN = 5;
export const FEAR_COMBAT_DRAIN_MAX = 10;
export const FEAR_HP_THRESHOLD = 60;
export const FEAR_CALM_TURNS = 5;
export const FEAR_CALM_RESTORE = 5;

/** <60 时每回合 −1 HP；≥60 不因心神扣血。 */
export function fearHpPerTurn(fear) {
  const value = Number.isFinite(fear) ? fear : FEAR_MAX;
  return value < FEAR_HP_THRESHOLD ? 1 : 0;
}

/** UI 色温：≥60 冷静；<60 溃散。 */
export function fearTier(fear) {
  const value = Number.isFinite(fear) ? fear : FEAR_MAX;
  if (value < 20) return 4;
  if (value < 40) return 3;
  if (value < FEAR_HP_THRESHOLD) return 2;
  if (value < 80) return 1;
  return 0;
}

export const SPIRIT_INTRO = {
  id: "spirit-intro",
  kicker: "心神溃散",
  text: "心神跌破六成后，每走一步都会失血。避开交战与遗骸、连续静行，心神会慢慢回来。",
  buttonLabel: "知道了"
};

export class FearSystem {
  constructor(game) {
    this.game = game;
  }

  ensureState() {
    const state = this.game.state;
    if (!state) return null;
    if (!Number.isFinite(state.fear)) state.fear = FEAR_MAX;
    if (!Number.isFinite(state.fearDrainMilestone)) {
      state.fearDrainMilestone = Math.floor((state.totalSteps || 0) / FEAR_STEPS_PER_DRAIN);
    }
    if (!Number.isFinite(state.fearTier)) state.fearTier = fearTier(state.fear);
    if (!Number.isFinite(state.fearCalmTurns)) state.fearCalmTurns = 0;
    if (typeof state.spiritIntroSeen !== "boolean") state.spiritIntroSeen = false;
    return state;
  }

  clampFear(value) {
    return Math.max(0, Math.min(FEAR_MAX, Math.round(value)));
  }

  setFear(next, floatText) {
    const state = this.ensureState();
    if (!state) return 0;
    const before = state.fear;
    const tierBefore = fearTier(before);
    state.fear = this.clampFear(next);
    const tierAfter = fearTier(state.fear);
    state.fearTier = tierAfter;
    if (floatText) this.game.ui.showFearFloat(floatText);
    if (tierAfter !== tierBefore) this.game.ui.flashFearBar(tierAfter);
    if (before >= FEAR_HP_THRESHOLD && state.fear < FEAR_HP_THRESHOLD) {
      this.maybePlaySpiritIntro();
    }
    return state.fear - before;
  }

  maybePlaySpiritIntro() {
    const state = this.ensureState();
    if (!state || state.spiritIntroSeen || !state.active) return false;
    state.spiritIntroSeen = true;
    this.game.save();
    return this.game.story.tryPlayMainBeat({
      id: SPIRIT_INTRO.id,
      kicker: SPIRIT_INTRO.kicker,
      text: SPIRIT_INTRO.text,
      buttonLabel: SPIRIT_INTRO.buttonLabel,
      mode: "storyCard",
      spiritIntro: true
    });
  }

  resetCalm() {
    const state = this.ensureState();
    if (!state) return;
    state.fearCalmTurns = 0;
  }

  /** 回合后：百步消耗、静行回升、&lt;60 扣血。 */
  onMove() {
    const state = this.ensureState();
    if (!state || !state.active) return;
    const milestone = Math.floor(state.totalSteps / FEAR_STEPS_PER_DRAIN);
    if (milestone > state.fearDrainMilestone) {
      const lost = milestone - state.fearDrainMilestone;
      state.fearDrainMilestone = milestone;
      this.setFear(state.fear - lost, lost === 1 ? "心神 −1" : `心神 −${lost}`);
      if (!state.active) return;
    }

    state.fearCalmTurns = (Number.isFinite(state.fearCalmTurns) ? state.fearCalmTurns : 0) + 1;
    if (state.fearCalmTurns >= FEAR_CALM_TURNS) {
      state.fearCalmTurns = 0;
      if (state.fear < FEAR_MAX) this.setFear(state.fear + FEAR_CALM_RESTORE, `心神 +${FEAR_CALM_RESTORE}`);
      if (!state.active) return;
    }

    const damage = fearHpPerTurn(state.fear);
    if (damage > 0) {
      state.hp = Math.max(0, state.hp - damage);
      this.game.ui.addLog("damage", "◇", `心神不稳，本回合损失 ${damage} 点生命`);
      if (state.hp <= 0) this.game.endGame("心神崩溃，你倒在了迷宫里");
    }
  }

  onCombatResolved(salt = "combat-fear") {
    const state = this.ensureState();
    if (!state || !state.active) return;
    this.resetCalm();
    const key = `${state.player.x},${state.player.y}`;
    const roll = this.game.events.eventRoll(key, `${salt}-${state.totalSteps}`);
    const span = FEAR_COMBAT_DRAIN_MAX - FEAR_COMBAT_DRAIN_MIN;
    const lost = FEAR_COMBAT_DRAIN_MIN + Math.floor(roll * (span + 1));
    this.setFear(state.fear - lost, `心神 −${lost}`);
  }

  onCorpseEncountered() {
    this.resetCalm();
  }

  onPotion() {
    const state = this.ensureState();
    if (!state) return 0;
    const before = state.fear;
    this.setFear(state.fear + FEAR_POTION_RESTORE, `心神 +${FEAR_POTION_RESTORE}`);
    return state.fear - before;
  }

  onVisionRestoredToFull(wasEnhanced) {
    const state = this.ensureState();
    if (!state || wasEnhanced) return 0;
    if (state.visionTurns <= 0) return 0;
    const before = state.fear;
    this.setFear(state.fear + FEAR_VISION_RESTORE, `心神 +${FEAR_VISION_RESTORE}`);
    return state.fear - before;
  }
}

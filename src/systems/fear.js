/** 恐惧值（心神）：消耗、回复与档位扣血。 */

export const FEAR_MAX = 100;
export const FEAR_POTION_RESTORE = 20;
export const FEAR_VISION_RESTORE = 15;
export const FEAR_STEPS_PER_DRAIN = 100;
export const FEAR_COMBAT_DRAIN_MIN = 5;
export const FEAR_COMBAT_DRAIN_MAX = 10;

/** 档位含边界：≤80/60/40/20 各 +1 HP/步，最多 4；仅 fear===100 时不因恐惧扣血。 */
export function fearHpPerStep(fear) {
  const value = Number.isFinite(fear) ? fear : FEAR_MAX;
  if (value >= FEAR_MAX) return 0;
  let damage = 0;
  if (value <= 80) damage += 1;
  if (value <= 60) damage += 1;
  if (value <= 40) damage += 1;
  if (value <= 20) damage += 1;
  return damage;
}

export function fearTier(fear) {
  const value = Number.isFinite(fear) ? fear : FEAR_MAX;
  if (value <= 20) return 4;
  if (value <= 40) return 3;
  if (value <= 60) return 2;
  if (value <= 80) return 1;
  return 0;
}

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
    if (floatText) this.game.ui.showFearFloat(floatText, tierAfter > tierBefore);
    if (tierAfter !== tierBefore) this.game.ui.flashFearBar(tierAfter);
    return state.fear - before;
  }

  /** 移动后：每 100 格 −1 恐惧，并结算档位扣血。 */
  onMove() {
    const state = this.ensureState();
    if (!state || !state.active) return;
    const milestone = Math.floor(state.totalSteps / FEAR_STEPS_PER_DRAIN);
    if (milestone > state.fearDrainMilestone) {
      const lost = milestone - state.fearDrainMilestone;
      state.fearDrainMilestone = milestone;
      this.setFear(state.fear - lost, lost === 1 ? "心神 −1" : `心神 −${lost}`);
    }
    const damage = fearHpPerStep(state.fear);
    if (damage > 0) {
      state.hp = Math.max(0, state.hp - damage);
      this.game.ui.addLog("damage", "◇", `心神不稳，移动损失 ${damage} 点生命`);
      if (state.hp <= 0) this.game.endGame("心神崩溃，你倒在了迷宫里");
    }
  }

  /** 交战结算：随机 −5～10。 */
  onCombatResolved(salt = "combat-fear") {
    const state = this.ensureState();
    if (!state || !state.active) return;
    const key = `${state.player.x},${state.player.y}`;
    const roll = this.game.events.eventRoll(key, `${salt}-${state.totalSteps}`);
    const span = FEAR_COMBAT_DRAIN_MAX - FEAR_COMBAT_DRAIN_MIN;
    const lost = FEAR_COMBAT_DRAIN_MIN + Math.floor(roll * (span + 1));
    this.setFear(state.fear - lost, `心神 −${lost}`);
  }

  onPotion() {
    const state = this.ensureState();
    if (!state) return 0;
    const before = state.fear;
    this.setFear(state.fear + FEAR_POTION_RESTORE, `心神 +${FEAR_POTION_RESTORE}`);
    return state.fear - before;
  }

  /** 视野从不满回到满时 +15；已满再续时不刷。 */
  onVisionRestoredToFull(wasEnhanced) {
    const state = this.ensureState();
    if (!state || wasEnhanced) return 0;
    if (state.visionTurns <= 0) return 0;
    const before = state.fear;
    this.setFear(state.fear + FEAR_VISION_RESTORE, `心神 +${FEAR_VISION_RESTORE}`);
    return state.fear - before;
  }
}

/** 纯战斗计算：预告与实际结算共用，不修改状态。 */
import { POISON_DAMAGE_PER_STEP, SLIME_POISON_DURATION } from "../config.js";

export function calculateCombatOutcome(state, enemy, surprise, useExecute = false) {
  const hpAfterCombat = Math.max(0, state.hp - (useExecute ? 0 : enemy.hp));
  const defeated = hpAfterCombat > 0;
  const poisonTurnsAfterCombat = defeated && !useExecute && enemy.type === "slime"
    ? Math.max(state.poisonTurns, SLIME_POISON_DURATION)
    : state.poisonTurns;
  // 迎战获胜后进入目标房间并结算一步毒伤；原地伏击不额外走步。
  const advancesStep = defeated && !surprise;
  const poisonDamage = advancesStep && poisonTurnsAfterCombat > 0 ? POISON_DAMAGE_PER_STEP : 0;
  const hpAfterAction = Math.max(0, hpAfterCombat - poisonDamage);
  return {
    defeated,
    hpAfterCombat,
    poisonTurnsAfterCombat,
    poisonDamage,
    hpAfterAction,
    poisonTurnsAfterAction: Math.max(0, poisonTurnsAfterCombat - (advancesStep ? 1 : 0)),
    survives: defeated && hpAfterAction > 0
  };
}

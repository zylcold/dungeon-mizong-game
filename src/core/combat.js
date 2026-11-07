/** 纯战斗计算：预告与实际结算共用，不修改状态。 */
import { MAX_POISON_TURNS, POISON_DAMAGE_PER_STEP, SLIME_POISON_DURATION } from "../config.js";

export function calculateCombatOutcome(state, enemy, surprise, useExecute = false) {
  // 出口守卫首次受「一击必杀」时不会当场阵亡，而是削减一半生命且玩家留在原格不耗步。
  if (useExecute && enemy && enemy.type === "guardian" && !enemy.weakened) {
    const nextEnemyHp = Math.max(1, Math.floor(enemy.hp * 0.5));
    return {
      defeated: false,
      weakenedGuardian: true,
      nextEnemyHp,
      hpAfterCombat: state.hp,
      poisonTurnsAfterCombat: state.poisonTurns,
      poisonDamage: 0,
      hpAfterAction: state.hp,
      poisonTurnsAfterAction: state.poisonTurns,
      survives: state.hp > 0
    };
  }
  const hpAfterCombat = Math.max(0, state.hp - (useExecute ? 0 : enemy.hp));
  const defeated = hpAfterCombat > 0;
  // 毒史莱姆毒素可叠加（上限 MAX_POISON_TURNS = 9 步），强化连续迎战史莱姆的腐蚀风险。
  const poisonTurnsAfterCombat = defeated && !useExecute && enemy.type === "slime"
    ? Math.min(MAX_POISON_TURNS, state.poisonTurns + SLIME_POISON_DURATION)
    : state.poisonTurns;
  // 迎战获胜后进入目标房间并结算一步毒伤；原地伏击不额外走步。
  const advancesStep = defeated && !surprise;
  const poisonDamage = advancesStep && poisonTurnsAfterCombat > 0 ? POISON_DAMAGE_PER_STEP : 0;
  const hpAfterAction = Math.max(0, hpAfterCombat - poisonDamage);
  return {
    defeated,
    weakenedGuardian: false,
    hpAfterCombat,
    poisonTurnsAfterCombat,
    poisonDamage,
    hpAfterAction,
    poisonTurnsAfterAction: Math.max(0, poisonTurnsAfterCombat - (advancesStep ? 1 : 0)),
    survives: defeated && hpAfterAction > 0
  };
}

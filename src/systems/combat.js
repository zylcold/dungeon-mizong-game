/** 战斗预测、结算与战利品。 */
import { ENEMY_CHEST_DROP_RATE } from "../config.js";
import { calculateCombatOutcome } from "../core/combat.js";
import { ENEMY_DEFS } from "../data/catalog.js";
import { ENEMY_COPY } from "../data/copy.js";

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;

  }

  getCombatOutcome(enemy, surprise, useExecute = false) {
    return calculateCombatOutcome(this.game.state, enemy, surprise, useExecute);
  }

  openEnemyEncounter(enemy, target, key, surprise, logEncounter = true) {
    const definition = ENEMY_DEFS[enemy.type];
    this.game.pending = { type: "enemy", enemy, target, key, surprise };
    const combat = this.getCombatOutcome(enemy, surprise);
    const poisonText = combat.poisonTurnsAfterAction > 0 ? `；之后仍中毒 ${combat.poisonTurnsAfterAction} 步` : "";
    let outcome = "你的生命不足以击败它，直接战斗将结束本局";
    if (combat.defeated && !combat.survives) {
      outcome = `虽能击败敌人并剩余 ${combat.hpAfterCombat} HP，但进入房间时的 ${combat.poisonDamage} 点毒伤会立即结束本局。`;
    } else if (combat.survives) {
      outcome = `本次行动后预计剩余 ${combat.hpAfterAction} HP${combat.poisonDamage ? `（已计入本步 ${combat.poisonDamage} 点毒伤）` : ""}${poisonText}`;
    }
    const actions = [
      {
        label: combat.survives ? "迎战" : "仍然迎战",
        onClick: () => this.fightEnemy(false)
      }
    ];
    if (this.game.state.inventory.execute > 0) {
      const executeOutcome = this.getCombatOutcome(enemy, surprise, true);
      actions.push({
        label: executeOutcome.survives ? "使用一击必杀" : "一击必杀（毒伤致命）",
        onClick: () => this.fightEnemy(true)
      });
    } else if (!surprise) {
      actions.push({ label: "后退", onClick: () => this.game.events.dismissEncounter() });
    }
    this.game.ui.showEncounter({
      kicker: surprise ? "遭遇伏击" : "发现敌人",
      title: `${definition.name} · ${enemy.hp} HP`,
      icon: definition.asset,
      description: `${definition.description} ${this.game.story.pickCopy(ENEMY_COPY[enemy.type], key, `enemy-copy-${enemy.type}`)}`,
      outcome,
      actions,
      closable: !surprise,
      key
    });
    if (logEncounter) this.game.ui.addLog("combat", definition.icon, `发现${definition.name}，血量 ${enemy.hp}`);
    this.game.save();
  }

  fightEnemy(useExecute) {
    if (!this.game.pending || this.game.pending.type !== "enemy") return;
    const { enemy, target, key, surprise } = this.game.pending;
    const definition = ENEMY_DEFS[enemy.type];
    const combat = this.getCombatOutcome(enemy, surprise, useExecute);
    if (useExecute) {
      if (this.game.state.inventory.execute <= 0) return;
      this.game.state.inventory.execute -= 1;
      const droppedChest = this.placeEnemyChestDrop(enemy, key);
      this.game.state.stats.enemies += 1;
      this.game.ui.addLog("combat", "⚔", `一击消灭${definition.name}，生命未受损${droppedChest ? "，并发现掉落宝箱" : ""}`);
      this.game.ui.hideEncounter();
      this.game.pending = null;
      this.finishEnemyVictory(enemy, target, surprise, droppedChest, droppedChest ? "一击必杀 · 掉落宝箱" : "一击必杀");
      return;
    }

    if (!combat.defeated) {
      this.game.state.hp = 0;
      this.game.ui.addLog("damage", "☠", `${definition.name}终结了本次探索`);
      this.game.ui.hideEncounter();
      this.game.pending = null;
      this.game.ui.updateUI();
      this.game.renderer.render();
      this.game.endGame(`你没能击败${definition.name}`);
      return;
    }

    this.game.state.hp = combat.hpAfterCombat;
    const droppedChest = this.placeEnemyChestDrop(enemy, key);
    this.game.state.stats.enemies += 1;
    this.game.state.poisonTurns = combat.poisonTurnsAfterCombat;
    this.game.ui.addLog("combat", definition.icon, `击败${definition.name}，剩余 ${this.game.state.hp} HP${droppedChest ? "，并发现掉落宝箱" : ""}`);
    this.game.ui.hideEncounter();
    this.game.pending = null;
    this.finishEnemyVictory(
      enemy,
      target,
      surprise,
      droppedChest,
      droppedChest ? `击败 ${definition.name} · 掉落宝箱` : `击败 ${definition.name}`
    );
  }

  finishEnemyVictory(enemy, target, surprise, droppedChest, toastText) {
    this.game.story.queueFirstLore(`enemy:${enemy.type}`);
    if (!surprise) this.game.movement.commitMove(target, { skipTrigger: !droppedChest });
    else if (droppedChest) {
      this.game.events.finishEncounter(false);
      this.game.events.triggerCurrentRoom();
    } else this.game.events.finishEncounter();
    this.game.ui.showToast(toastText);
  }

  placeEnemyChestDrop(enemy, key) {
    const dropped = this.game.events.eventRoll(key, `enemy-chest-${enemy.type}`) < ENEMY_CHEST_DROP_RATE;
    if (dropped) {
      this.game.state.maze.entities[key] = { kind: "event", type: "chest", dropped: true };
      return true;
    }
    delete this.game.state.maze.entities[key];
    return false;
  }
}

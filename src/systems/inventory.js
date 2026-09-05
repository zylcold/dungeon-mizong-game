/** 道具拾取、消耗与瞬移。 */
import { MAZE_SIZE, VISION_DURATION } from "../config.js";
import { roomKey } from "../core/coordinates.js";
import { clamp } from "../core/math.js";
import { hashString, mulberry32 } from "../core/random.js";
import { ITEM_DEFS } from "../data/catalog.js";

export class InventorySystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;

  }

  collectPickup(entity, key) {
    this.addItem(entity.itemType, 1);
    delete this.game.state.maze.entities[key];
    this.game.state.stats.items += 1;
    const item = ITEM_DEFS[entity.itemType];
    this.game.ui.addLog("item", item.icon, `拾取「${item.name}」`);
    this.game.ui.showToast(`获得 ${item.name}`);
    this.game.save();
  }

  randomItemFor(key, salt = "item") {
    const roll = this.game.events.eventRoll(key, salt);
    if (roll < 0.38) return "potion";
    if (roll < 0.66) return "vision";
    if (roll < 0.83) return "execute";
    return "teleport";
  }

  useItem(itemType) {
    if (!this.game.state || !this.game.state.active) return;
    const count = this.game.state.inventory[itemType] || 0;
    if (count <= 0) {
      this.game.ui.showToast(`尚未获得${ITEM_DEFS[itemType].name}`);
      return;
    }
    if (itemType === "execute" && (!this.game.pending || this.game.pending.type !== "enemy")) {
      this.game.ui.showToast("一击必杀只能在遇敌时使用");
      return;
    }
    if (itemType === "potion") {
      if (this.game.state.hp >= this.game.state.maxHp) {
        this.game.ui.showToast("生命值已满");
        return;
      }
    }
    if (itemType === "execute") {
      this.game.combat.fightEnemy(true);
      return;
    }
    if (itemType === "potion") {
      this.game.state.inventory.potion -= 1;
      const healed = Math.min(30, this.game.state.maxHp - this.game.state.hp);
      this.game.state.hp += healed;
      this.game.ui.addLog("heal", "✚", `使用恢复药剂，恢复 ${healed} 点生命`);
      this.game.ui.showToast(`恢复 ${healed} HP`);
    } else if (itemType === "vision") {
      this.game.state.inventory.vision -= 1;
      this.game.state.visionTurns = clamp(this.game.state.visionTurns + VISION_DURATION, VISION_DURATION, VISION_DURATION * 2);
      this.game.state.fogTurns = 0;
      this.game.vision.updateVisibility();
      this.game.ui.addLog("vision", "◉", `迷雾暂时关闭，主地图缩小 50%，持续 ${this.game.state.visionTurns} 步`);
      this.game.ui.showToast("迷雾关闭 · 地图缩小 50%");
    } else if (itemType === "teleport") {
      this.game.state.inventory.teleport -= 1;
      this.teleportPlayer("瞬移卷轴");
      return;
    }
    this.game.ui.updateUI();
    this.game.save();
    this.game.renderer.render();
    if (this.game.pending && this.game.pending.type === "enemy") {
      const pending = this.game.pending;
      this.game.combat.openEnemyEncounter(pending.enemy, pending.target, pending.key, pending.surprise, false);
    }
  }

  teleportPlayer(source) {
    const candidates = [];
    for (let y = 0; y < MAZE_SIZE; y += 1) {
      for (let x = 0; x < MAZE_SIZE; x += 1) {
        const key = roomKey(x, y);
        const distance = Math.abs(x - this.game.state.player.x) + Math.abs(y - this.game.state.player.y);
        const entity = this.game.state.maze.entities[key];
        if (distance < 6 || this.game.events.isExit(x, y) || entity) continue;
        candidates.push({ x, y });
      }
    }
    if (!candidates.length) {
      this.game.state.inventory.teleport += source === "瞬移卷轴" ? 1 : 0;
      this.game.ui.showToast("没有找到安全的瞬移位置");
      return;
    }
    const seed = hashString(`${this.game.state.maze.seed}:${this.game.state.totalSteps}:${source}`);
    const rng = mulberry32(seed);
    const target = candidates[Math.floor(rng() * candidates.length)];
    this.game.pending = null;
    this.game.ui.hideEncounter();
    this.game.ui.addLog("vision", "✦", `${source}将你送到迷宫中的安全位置`);
    this.game.movement.commitMove(target, { teleport: true });
    this.game.ui.showToast("瞬移完成");
  }

  addItem(itemType, amount, deferLore = false) {
    this.game.state.inventory[itemType] = (this.game.state.inventory[itemType] || 0) + amount;
    // 事件结算内获得的道具延迟演出（由事件收尾统一尝试），拾取时立即尝试。
    if (!deferLore) this.game.story.tryPlayLore(`item:${itemType}`);
  }
}

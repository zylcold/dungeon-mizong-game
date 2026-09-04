/** 房间事件与遭遇生命周期。 */
import { DIRECTION_LIST } from "../config.js";
import { inBounds, indexFor, roomKey } from "../core/coordinates.js";
import { connectRooms, createEnemy } from "../core/maze.js";
import { hashString, mulberry32 } from "../core/random.js";
import { ENEMY_DEFS, EVENT_DEFS, ITEM_DEFS } from "../data/catalog.js";
import { EVENT_COPY } from "../data/copy.js";

export class EventSystem {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;

  }

  triggerCurrentRoom() {
    if (!this.game.state || !this.game.state.active) return;
    const key = roomKey(this.game.state.player.x, this.game.state.player.y);
    const entity = this.game.state.maze.entities[key];
    if (entity && key !== this.game.state.dismissedKey) {
      if (entity.kind === "pickup") {
        this.game.inventory.collectPickup(entity, key);
        return;
      }
      if (entity.kind === "event") {
        this.resolveEvent(entity, key);
        return;
      }
    }
    if (this.isExit(this.game.state.player.x, this.game.state.player.y)) this.openExitEncounter();
  }

  isExit(x, y) {
    return this.game.state.maze.exits.some((exit) => exit.x === x && exit.y === y);
  }

  resolveEvent(entity, key) {
    this.game.story.queueFirstLore(`event:${entity.type}`);
    const definition = EVENT_DEFS[entity.type];
    const eventDescription = this.game.story.pickCopy(EVENT_COPY[entity.type], key, `event-copy-${entity.type}`);
    if (!entity.seen) {
      entity.seen = true;
      this.game.state.stats.events += 1;
    }
    switch (entity.type) {
      case "chest":
        this.game.ui.showEncounter({
          kicker: "随机事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: "打开宝箱不会消耗额外步数。",
          actions: [
            { label: "打开宝箱", onClick: () => this.openChest(key) },
            { label: "暂时离开", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "fountain":
        this.game.ui.showEncounter({
          kicker: "随机事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: `饮用后恢复 25 点生命，当前为 ${this.game.state.hp} / ${this.game.state.maxHp}。`,
          actions: [
            { label: "饮用泉水", onClick: () => this.useFountain(key) },
            { label: "离开", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "trap": {
        const damage = 8 + Math.floor(this.eventRoll(key, "trap") * 8);
        this.game.state.hp = Math.max(1, this.game.state.hp - damage);
        delete this.game.state.maze.entities[key];
        this.game.ui.addLog("damage", definition.icon, `触发地刺陷阱，损失 ${damage} 点生命`);
        this.game.ui.showToast(`地刺陷阱：-${damage} HP`);
        break;
      }
      case "map":
        this.game.state.exitHintTurns = Math.max(this.game.state.exitHintTurns, 30);
        delete this.game.state.maze.entities[key];
        this.game.ui.addLog("vision", definition.icon, "读懂地图残片，出口箭头强化 30 步");
        this.game.ui.showToast("出口箭头已强化");
        break;
      case "shrine":
        this.game.ui.showEncounter({
          kicker: "选择事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: this.game.state.hp > 12 ? "消耗 12 点生命，生命上限永久增加 15。" : "当前生命不足，无法献祭。",
          actions: [
            { label: "献祭生命", disabled: this.game.state.hp <= 12, onClick: () => this.useShrine(key) },
            { label: "拒绝", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "corpse":
        this.game.ui.showEncounter({
          kicker: "风险事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: "约三分之二概率获得道具，其余情况会遭遇伏击。",
          actions: [
            { label: "搜索背包", onClick: () => this.searchCorpse(key) },
            { label: "保持警惕", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "fog":
        this.game.state.fogTurns = Math.max(this.game.state.fogTurns, 15);
        delete this.game.state.maze.entities[key];
        this.game.vision.updateVisibility();
        this.game.ui.addLog("vision", definition.icon, "浓雾笼罩四周，视野降为 1 格，持续 15 步");
        this.game.ui.showToast("视野降为 1 格");
        break;
      case "portal":
        this.game.ui.showEncounter({
          kicker: "选择事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: "传送会计为一步，并在路线图上以虚线标记。",
          actions: [
            { label: "踏入法阵", onClick: () => this.usePortal(key) },
            { label: "离开", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "door":
        this.game.ui.showEncounter({
          kicker: "选择事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: "打开石门会连接一个原本不相通的相邻区域。",
          actions: [
            { label: "推开石门", onClick: () => this.openStoneDoor(key) },
            { label: "离开", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "roots":
        this.game.ui.showEncounter({
          kicker: "地形事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: "强行穿过可能受伤，也可能在树根下发现被遮住的补给。",
          actions: [
            { label: "踩稳穿过", onClick: () => this.crossRoots(key) },
            { label: "暂时绕开", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      case "echo": {
        const echoes = [
          "回声里有人喊着你的名字，声音来自迷宫边缘。",
          "乌鸦叫声与村人的呼喊重叠了一瞬。",
          "风穿过高处岩缝，替你指出了一个大致方向。"
        ];
        const message = this.game.story.pickCopy(echoes, key, "echo-result");
        this.game.state.exitHintTurns = Math.max(this.game.state.exitHintTurns, 16);
        delete this.game.state.maze.entities[key];
        this.game.ui.addLog("vision", definition.icon, `${definition.name}：${message}`);
        this.game.ui.showToast("回声带来了出口线索");
        break;
      }
      case "cache":
        this.game.ui.showEncounter({
          kicker: "记忆事件",
          title: definition.name,
          icon: definition.asset,
          description: eventDescription,
          outcome: "翻找不会消耗额外步数，但不一定能找到可用物品。",
          actions: [
            { label: "翻找布袋", onClick: () => this.searchFarmCache(key) },
            { label: "保持原样", onClick: () => this.leaveEvent(key) }
          ],
          closable: true,
          key
        });
        break;
      default:
        delete this.game.state.maze.entities[key];
    }
    this.game.ui.updateUI();
    this.game.save();
    this.game.renderer.render();
  }

  eventRoll(key, salt) {
    const input = `${this.game.state.maze.seed}:${key}:${salt}`;
    return mulberry32(hashString(input))();
  }

  openChest(key) {
    const roll = this.eventRoll(key, "chest");
    delete this.game.state.maze.entities[key];
    this.game.state.stats.chests += 1;
    if (roll < 0.76) {
      const itemType = this.game.inventory.randomItemFor(key, "chest-item");
      this.game.inventory.addItem(itemType, 1);
      this.game.state.stats.items += 1;
      this.game.ui.addLog("item", "▣", `打开宝箱，获得「${ITEM_DEFS[itemType].name}」`);
      this.game.ui.showToast(`宝箱：${ITEM_DEFS[itemType].name}`);
    } else if (roll < 0.94) {
      const heal = Math.min(20, this.game.state.maxHp - this.game.state.hp);
      this.game.state.hp += heal;
      this.game.ui.addLog("heal", "✚", heal > 0 ? `宝箱中的补给恢复 ${heal} 点生命` : "宝箱中只有已经失效的补给");
      this.game.ui.showToast(heal > 0 ? `恢复 ${heal} HP` : "补给已经失效");
    } else {
      this.game.ui.addLog("system", "□", "打开宝箱，里面空空如也");
      this.game.ui.showToast("这是一个空箱子");
    }
    this.finishEncounter();
  }

  crossRoots(key) {
    const roll = this.eventRoll(key, "roots-result");
    delete this.game.state.maze.entities[key];
    if (roll < 0.48) {
      const damage = 5 + Math.floor(this.eventRoll(key, "roots-damage") * 8);
      this.game.state.hp = Math.max(1, this.game.state.hp - damage);
      this.game.ui.addLog("damage", "⌁", `脚下树根突然滑动，你撞上碎石，损失 ${damage} 点生命`);
      this.game.ui.showToast(`盘根裂隙：-${damage} HP`);
    } else if (roll < 0.82) {
      const itemType = this.game.inventory.randomItemFor(key, "roots-item");
      this.game.inventory.addItem(itemType, 1);
      this.game.state.stats.items += 1;
      this.game.ui.addLog("item", "⌁", `你在树根下面找到「${ITEM_DEFS[itemType].name}」`);
      this.game.ui.showToast(`找到 ${ITEM_DEFS[itemType].name}`);
    } else {
      this.game.state.exitHintTurns = Math.max(this.game.state.exitHintTurns, 12);
      this.game.ui.addLog("vision", "⌁", "树根朝着风来的方向生长，为你留下出口线索");
      this.game.ui.showToast("获得出口方向线索");
    }
    this.finishEncounter();
  }

  searchFarmCache(key) {
    const roll = this.eventRoll(key, "farm-cache-result");
    delete this.game.state.maze.entities[key];
    if (roll < 0.56) {
      const itemType = this.game.inventory.randomItemFor(key, "farm-cache-item");
      this.game.inventory.addItem(itemType, 1);
      this.game.state.stats.items += 1;
      this.game.ui.addLog("item", "◇", `旧布袋里还留着「${ITEM_DEFS[itemType].name}」`);
      this.game.ui.showToast(`找到 ${ITEM_DEFS[itemType].name}`);
    } else if (roll < 0.82) {
      const healed = Math.min(14, this.game.state.maxHp - this.game.state.hp);
      this.game.state.hp += healed;
      this.game.ui.addLog("heal", "◇", healed > 0 ? `干粮让你恢复 ${healed} 点生命` : "布袋里的干粮提醒你曾来过这里");
      this.game.ui.showToast(healed > 0 ? `恢复 ${healed} HP` : "只找到少量干粮");
    } else {
      this.game.ui.addLog("system", "◇", "布袋里只有一张写着农时的湿纸，你却认得上面的字迹");
      this.game.ui.showToast("一段熟悉的字迹唤醒了记忆");
    }
    this.finishEncounter();
  }

  useFountain(key) {
    const healed = Math.min(25, this.game.state.maxHp - this.game.state.hp);
    this.game.state.hp += healed;
    delete this.game.state.maze.entities[key];
    this.game.ui.addLog("heal", "✚", healed > 0 ? `饮用生命泉，恢复 ${healed} 点生命` : "生命泉让你精神一振，但生命已满");
    this.game.ui.showToast(healed > 0 ? `恢复 ${healed} HP` : "生命值已满");
    this.finishEncounter();
  }

  useShrine(key) {
    if (this.game.state.hp <= 12) return;
    this.game.state.hp -= 12;
    this.game.state.maxHp += 15;
    this.game.state.hp += 15;
    delete this.game.state.maze.entities[key];
    this.game.ui.addLog("system", "◇", "完成献祭，生命上限增加 15");
    this.game.ui.showToast("生命上限 +15");
    this.finishEncounter();
  }

  searchCorpse(key) {
    const roll = this.eventRoll(key, "corpse");
    if (roll < 0.66) {
      const itemType = this.game.inventory.randomItemFor(key, "corpse-item");
      delete this.game.state.maze.entities[key];
      this.game.inventory.addItem(itemType, 1);
      this.game.state.stats.items += 1;
      this.game.ui.addLog("item", "☠", `搜索遗骸，找到「${ITEM_DEFS[itemType].name}」`);
      this.game.ui.showToast(`找到 ${ITEM_DEFS[itemType].name}`);
      this.finishEncounter();
      return;
    }
    const rng = mulberry32(hashString(`${this.game.state.maze.seed}:${key}:ambush`));
    const enemyType = roll > 0.9 ? "ghost" : "rat";
    const enemy = createEnemy(enemyType, rng);
    this.game.state.maze.entities[key] = enemy;
    this.game.ui.hideEncounter();
    this.game.ui.addLog("combat", "⚔", `${ENEMY_DEFS[enemyType].name}从阴影中发动伏击`);
    this.game.combat.openEnemyEncounter(enemy, { x: this.game.state.player.x, y: this.game.state.player.y }, key, true);
  }

  usePortal(key) {
    delete this.game.state.maze.entities[key];
    this.finishEncounter(false);
    this.game.inventory.teleportPlayer("传送法阵");
  }

  openStoneDoor(key) {
    const { x, y } = this.game.state.player;
    const mask = this.game.state.maze.bits[indexFor(x, y)];
    const candidates = DIRECTION_LIST.filter(([, direction]) => {
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      return inBounds(nx, ny) && (mask & direction.bit) === 0;
    });
    delete this.game.state.maze.entities[key];
    if (candidates.length) {
      const index = Math.floor(this.eventRoll(key, "door") * candidates.length);
      connectRooms(this.game.state.maze.bits, x, y, candidates[index][0]);
      this.game.state.maze.loopCount = (this.game.state.maze.loopCount || 0) + 1;
      this.game.ui.addLog("system", "▥", "石门开启，一条新的捷径出现了");
      this.game.ui.showToast("新捷径已打开");
    } else {
      this.game.state.exitHintTurns = Math.max(this.game.state.exitHintTurns, 20);
      this.game.ui.addLog("vision", "⌖", "石门后没有通路，但墙上刻着出口线索");
      this.game.ui.showToast("获得出口线索");
    }
    this.game.vision.updateVisibility();
    this.finishEncounter();
  }

  leaveEvent(key) {
    this.game.state.dismissedKey = key;
    this.game.ui.hideEncounter();
    this.game.pending = null;
    this.game.ui.updateUI();
    this.game.save();
    this.game.renderer.render();
  }

  dismissEncounter() {
    if (!this.game.pending) {
      this.game.ui.hideEncounter();
      return;
    }
    if (this.game.pending.surprise) return;
    if (this.game.pending.type === "event") this.game.state.dismissedKey = this.game.pending.key;
    this.game.pending = null;
    this.game.ui.hideEncounter();
    this.game.save();
    this.game.renderer.render();
  }

  finishEncounter(save = true) {
    this.game.pending = null;
    this.game.ui.hideEncounter();
    this.game.vision.updateVisibility();
    this.game.ui.updateUI();
    if (save) this.game.save();
    this.game.renderer.render();
  }

  openExitEncounter() {
    const exitNumber = this.game.state.maze.exits.findIndex((exit) => exit.x === this.game.state.player.x && exit.y === this.game.state.player.y) + 1;
    const currentExitKey = roomKey(this.game.state.player.x, this.game.state.player.y);
    this.game.state.discoveredExits = this.game.state.discoveredExits || [];
    this.game.ui.showEncounter({
      kicker: "发现出口",
      title: `迷宫出口 ${exitNumber}`,
      icon: "exit",
      description: `这是迷宫的第 ${exitNumber} 个出口。选择离开会结束本局，也可以继续探索其他出口。`,
      outcome: "离开后将展示整张大型迷宫和你的完整路线。",
      actions: [
        { label: "离开迷宫", onClick: () => this.game.endGame("你走出了迷宫", true) },
        { label: "继续探索", onClick: () => this.leaveEvent(roomKey(this.game.state.player.x, this.game.state.player.y)) }
      ],
      closable: true,
      key: currentExitKey
    });
    if (!this.game.state.discoveredExits.includes(currentExitKey)) {
      this.game.state.discoveredExits.push(currentExitKey);
      this.game.ui.addLog("system", "▣", `发现迷宫出口 ${exitNumber}`);
      this.game.ui.updateUI();
    }
  }
}

/** HUD、遭遇面板、日志和轻量提示。 */
import { MAX_LOGS } from "../config.js";
import { clamp } from "../core/math.js";
import { ITEM_DEFS } from "../data/catalog.js";
import { applyAtlasFrame } from "./assets.js";
import { replaceChildrenCompat } from "./dom.js";

export class GameUI {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.toastTimer = null;
    this.statusTimer = null;
    this.unreadEvents = 0;
    this.lastRenderedLogLength = -1;
    this.lastRenderedLogEntry = null;
    document.querySelectorAll("[data-sprite]").forEach((element) => applyAtlasFrame(element, element.dataset.sprite));
  }

  prepareEndSummary(record, ending) {
    this.dom.endTitle.textContent = ending.title;
    this.dom.endReveal.textContent = ending.reveal;
    this.dom.endStats.innerHTML = "";
    [
      ["探索格数", record.explored], ["总步数", record.steps],
      ["击败敌人", record.enemies], ["开启宝箱", record.chests]
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "end-stat";
      const name = document.createElement("span");
      name.textContent = label;
      const number = document.createElement("strong");
      number.textContent = value;
      item.appendChild(name);
      item.appendChild(number);
      this.dom.endStats.appendChild(item);
    });
  }

  setControlsEnabled(enabled) {
    this.dom.itemButtons.forEach((button) => {
      button.disabled = !enabled;
    });
  }

  showEncounter({ kicker, title, icon, description, outcome, actions, closable, key }) {
    this.game.movement.cancelAutoPath();
    this.game.pending = this.game.pending || { type: "event", key, surprise: false };
    if (this.game.pending.type !== "enemy") this.game.pending = { type: "event", key, surprise: false };
    this.dom.encounterKicker.textContent = kicker;
    this.dom.encounterTitle.textContent = title;
    this.dom.encounterDescription.textContent = description;
    this.dom.encounterOutcome.textContent = outcome || "";
    applyAtlasFrame(this.dom.encounterIcon, icon);
    this.dom.encounterClose.hidden = !closable;
    replaceChildrenCompat(this.dom.encounterActions);
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.disabled = Boolean(action.disabled);
      button.addEventListener("click", action.onClick, { once: true });
      this.dom.encounterActions.appendChild(button);
    });
    this.dom.encounterCard.hidden = false;
  }

  hideEncounter() {
    this.dom.encounterCard.hidden = true;
    replaceChildrenCompat(this.dom.encounterActions);
  }

  addLog(category, icon, text) {
    if (!this.game.state) return;
    this.game.state.logs.push({ category, icon, text, step: this.game.state.totalSteps });
    if (this.game.state.logs.length > MAX_LOGS) this.game.state.logs.splice(0, this.game.state.logs.length - MAX_LOGS);
    this.updateLog();
  }

  updateLog(forceBottom = false) {
    if (!this.game.state) return;
    const latestEntry = this.game.state.logs[this.game.state.logs.length - 1] || null;
    // 达到 200 条上限后长度不变，但新日志对象仍会变化，不能只比较数组长度。
    if (!forceBottom && this.lastRenderedLogLength === this.game.state.logs.length
      && this.lastRenderedLogEntry === latestEntry) return;
    const nearBottom = this.dom.eventLog.scrollHeight - this.dom.eventLog.scrollTop - this.dom.eventLog.clientHeight < 14;
    replaceChildrenCompat(this.dom.eventLog);
    this.game.state.logs.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `event-entry ${entry.category}`;
      row.title = `第 ${entry.step} 步`;
      const icon = document.createElement("span");
      icon.className = "event-icon";
      icon.textContent = entry.icon;
      const step = document.createElement("span");
      step.className = "event-step";
      step.textContent = `第${entry.step}步`;
      const copy = document.createElement("span");
      copy.textContent = entry.text;
      row.appendChild(icon);
      row.appendChild(step);
      row.appendChild(copy);
      this.dom.eventLog.appendChild(row);
    });
    this.lastRenderedLogLength = this.game.state.logs.length;
    this.lastRenderedLogEntry = latestEntry;
    requestAnimationFrame(() => {
      if (nearBottom || forceBottom) {
        this.dom.eventLog.scrollTop = this.dom.eventLog.scrollHeight;
        this.unreadEvents = 0;
        this.dom.newEventBadge.hidden = true;
      } else {
        this.unreadEvents += 1;
        this.dom.newEventBadge.textContent = `${this.unreadEvents} 条新事件`;
        this.dom.newEventBadge.hidden = false;
      }
    });
  }

  updateUI(forceLog = false) {
    if (!this.game.state) return;
    this.dom.floorValue.textContent = `${this.game.state.discoveredExits ? this.game.state.discoveredExits.length : 0}/${this.game.state.maze.exits.length}`;
    this.dom.stepsValue.textContent = this.game.state.totalSteps;
    this.dom.healthText.textContent = `${this.game.state.hp} / ${this.game.state.maxHp}`;
    const healthPercent = clamp((this.game.state.hp / this.game.state.maxHp) * 100, 0, 100);
    this.dom.healthFill.style.width = `${healthPercent}%`;
    this.dom.healthFill.style.background = healthPercent <= 28
      ? "linear-gradient(90deg, #71111f, #e03846)"
      : "linear-gradient(90deg, #9f1e2d, #f05252)";
    this.dom.healthTrack.setAttribute("aria-valuemax", String(this.game.state.maxHp));
    this.dom.healthTrack.setAttribute("aria-valuenow", String(this.game.state.hp));

    Object.keys(ITEM_DEFS).forEach((itemType) => {
      const count = this.game.state.inventory[itemType] || 0;
      this.dom.counts[itemType].textContent = count;
      const button = this.dom.itemButtons.find((candidate) => candidate.dataset.item === itemType);
      button.classList.toggle("empty", count <= 0);
    });
    this.dom.timerVision.hidden = this.game.state.visionTurns <= 0;
    this.dom.timerVision.textContent = `${this.game.state.visionTurns}步`;

    const statuses = [];
    if (this.game.movement.autoPath.length > 0) statuses.push(`自动寻路 · 剩余 ${this.game.movement.autoPath.length} 步`);
    if (this.game.state.visionTurns > 0) statuses.push(`迷雾关闭 · 50% · ${this.game.state.visionTurns}步`);
    else if (this.game.state.fogTurns > 0) statuses.push(`浓雾 · ${this.game.state.fogTurns}步`);
    if (this.game.state.poisonTurns > 0) statuses.push(`中毒 · ${this.game.state.poisonTurns}步`);
    if (this.game.state.exitHintTurns > 0) statuses.push(`出口指引 · ${this.game.state.exitHintTurns}步`);
    this.dom.statusChip.textContent = statuses.join("　");
    this.dom.statusChip.classList.toggle("visible", statuses.length > 0);

    if (forceLog) this.lastRenderedLogLength = -1;
    this.updateLog(forceLog);
    this.game.story.checkStoryProgress();
    this.game.story.tryShowPendingStory();
  }

  showStatus(message) {
    this.dom.statusChip.textContent = message;
    this.dom.statusChip.classList.add("visible");
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.updateUI(), 900);
  }

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.dom.toast.classList.remove("visible"), 1500);
  }
}

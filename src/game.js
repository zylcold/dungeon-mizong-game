/** 应用生命周期与各职责模块的组合入口；共享状态只在此持有。 */
import { DEFAULT_VISION_RADIUS, STORY_PRIORITY } from "./config.js";
import { OPENING_STORY, getEnding } from "./data/endings.js";
import { MapRenderer } from "./rendering/map-renderer.js";
import { MazeRenderer } from "./rendering/maze-renderer.js";
import { createInitialState } from "./state/initial-state.js";
import { SaveStore } from "./state/save-store.js";
import { restoreState } from "./state/migrations.js";
import { CombatSystem } from "./systems/combat.js";
import { EventSystem } from "./systems/events.js";
import { InventorySystem } from "./systems/inventory.js";
import { MovementSystem } from "./systems/movement.js";
import { StorySystem } from "./systems/story.js";
import { VisionSystem } from "./systems/vision.js";
import { createDOM } from "./ui/dom.js";
import { DevDiary } from "./ui/dev-diary.js";
import { GameUI } from "./ui/game-ui.js";
import { InputController } from "./ui/input.js";

export class DungeonGame {
  constructor(dom = createDOM()) {
    this.dom = dom;
    this.state = null;
    this.pending = null;
    this.storage = new SaveStore(window.localStorage);
    this.input = new InputController(this);
    this.movement = new MovementSystem(this);
    this.vision = new VisionSystem(this);
    this.events = new EventSystem(this);
    this.inventory = new InventorySystem(this);
    this.combat = new CombatSystem(this);
    this.story = new StorySystem(this);
    this.ui = new GameUI(this);
    this.devDiary = new DevDiary(this);
    this.renderer = new MazeRenderer(this);
    this.maps = new MapRenderer(this);
    this.input.bindEvents();
    this.prepareStartScreen();
    this.renderer.resize();
  }

  prepareStartScreen() {
    const saved = this.storage.loadSavedState();
    const records = this.storage.loadRecords();
    this.dom.continueButton.hidden = !saved;
    if (records.length) {
      const best = records[0];
      this.dom.bestRecord.textContent = `${best.steps} 步 · 探索 ${best.explored || 0} 格`;
    } else {
      this.dom.bestRecord.textContent = "尚无纪录";
    }
    this.dom.startOverlay.hidden = false;
    this.ui.setControlsEnabled(false);
    this.devDiary.maybeShowOnLaunch();
  }

  startNewGame() {
    this.movement.cancelAutoPath();
    this.story.storyOnClose = null;
    this.dom.storyOverlay.hidden = true;
    this.state = createInitialState();
    this.pending = null;
    this.dom.startOverlay.hidden = true;
    this.dom.endOverlay.hidden = true;
    this.dom.mapOverlay.hidden = true;
    this.ui.hideEncounter();
    this.ui.addLog("system", "◆", "你在迷宫中心醒来");
    this.ui.addLog("vision", "◉", `当前视野范围为 ${DEFAULT_VISION_RADIUS} 格`);
    this.ui.addLog("system", "⌖", "寻找迷宫外围的出口");
    this.story.addOpeningAtmosphere();
    this.vision.updateVisibility();
    this.ui.updateUI(true);
    this.ui.setControlsEnabled(true);
    this.save();
    this.renderer.render();
    this.ui.showToast("滑动探索未知区域，点击已探索区域自动寻路");
    this.story.queueRandomStory("intro", "序章 · 醒来", OPENING_STORY, "开始探索", STORY_PRIORITY.intro);
    this.story.tryShowPendingStory();
  }

  continueGame() {
    const saved = this.storage.loadSavedState();
    if (!saved) {
      this.ui.showToast("没有可继续的进度");
      this.startNewGame();
      return;
    }
    this.state = restoreState(saved);
    this.story.storyOnClose = null;
    this.dom.storyOverlay.hidden = true;
    this.pending = null;
    this.dom.startOverlay.hidden = true;
    this.dom.endOverlay.hidden = true;
    this.ui.hideEncounter();
    this.vision.updateVisibility();
    this.ui.updateUI(true);
    this.ui.setControlsEnabled(true);
    this.save();
    this.renderer.render();
    this.ui.showToast("已恢复上次探索");
  }

  endGame(reason, escaped = false) {
    if (!this.state || !this.state.active) return;
    this.movement.cancelAutoPath();
    this.state.active = false;
    this.pending = null;
    this.ui.hideEncounter();
    this.state.pendingStories = [];
    this.state.currentStory = null;
    this.story.storyOnClose = null;
    this.dom.storyOverlay.hidden = true;
    this.ui.setControlsEnabled(false);
    const record = {
      steps: this.state.totalSteps,
      enemies: this.state.stats.enemies,
      chests: this.state.stats.chests,
      explored: this.state.stats.rooms,
      escaped,
      endedAt: Date.now()
    };
    this.storage.completeRun(record);
    const ending = getEnding(reason, escaped);
    this.ui.prepareEndSummary(record, ending);
    const presentEndSummary = () => this.maps.presentEndSummary();
    const shown = this.story.showStory({
      id: ending.id,
      kicker: ending.kicker,
      text: ending.text,
      buttonLabel: "查看本局",
      onClose: presentEndSummary
    });
    if (!shown) presentEndSummary();
  }

  save() {
    this.storage.save(this.state);
  }
}

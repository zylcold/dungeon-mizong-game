/** 键盘、指针和按钮事件绑定。 */


export class InputController {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.pointerStart = null;
  }

  bindEvents() {
    window.addEventListener("resize", () => this.game.renderer.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.game.renderer.resize(), 120));
    if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
      window.visualViewport.addEventListener("resize", () => this.game.renderer.resize());
    }
    window.addEventListener("keydown", (event) => {
      const mapping = {
        ArrowUp: "up",
        w: "up",
        W: "up",
        ArrowRight: "right",
        d: "right",
        D: "right",
        ArrowDown: "down",
        s: "down",
        S: "down",
        ArrowLeft: "left",
        a: "left",
        A: "left"
      };
      if (!mapping[event.key]) return;
      event.preventDefault();
      this.game.movement.attemptMove(mapping[event.key]);
    });

    this.dom.gameCanvas.addEventListener("pointerdown", (event) => {
      this.game.movement.cancelAutoPath();
      this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
      if (typeof this.dom.gameCanvas.setPointerCapture === "function") {
        this.dom.gameCanvas.setPointerCapture(event.pointerId);
      }
    });
    this.dom.gameCanvas.addEventListener("pointerup", (event) => {
      if (!this.pointerStart || this.pointerStart.id !== event.pointerId) return;
      const dx = event.clientX - this.pointerStart.x;
      const dy = event.clientY - this.pointerStart.y;
      this.pointerStart = null;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude < 18) {
        this.game.movement.handleCanvasTap(event.clientX, event.clientY);
      } else {
        this.game.movement.moveFromVector(dx, dy, 18);
      }
    });
    this.dom.gameCanvas.addEventListener("pointercancel", () => {
      this.pointerStart = null;
    });

    this.dom.itemButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.game.movement.cancelAutoPath();
        this.game.inventory.useItem(button.dataset.item);
      });
    });

    this.dom.minimapButton.addEventListener("click", () => {
      this.game.movement.cancelAutoPath();
      this.game.maps.openMap(false);
    });
    this.dom.mapClose.addEventListener("click", () => {
      this.dom.mapOverlay.hidden = true;
    });
    this.dom.mapOverlay.addEventListener("click", (event) => {
      if (event.target === this.dom.mapOverlay) this.dom.mapOverlay.hidden = true;
    });
    this.dom.fullMapCanvas.addEventListener("click", (event) => this.game.movement.handleFullMapTap(event));
    this.dom.encounterClose.addEventListener("click", () => this.game.events.dismissEncounter());
    this.dom.continueButton.addEventListener("click", () => this.game.continueGame());
    this.dom.newGameButton.addEventListener("click", () => this.game.startNewGame());
    this.dom.endRestartButton.addEventListener("click", () => this.game.startNewGame());
    this.dom.storyContinueButton.addEventListener("click", () => this.game.story.hideStory());
    this.dom.restartButton.addEventListener("click", () => {
      if (!this.game.state || window.confirm("确定结束当前探索并重新开始吗？")) this.game.startNewGame();
    });
    this.dom.eventLog.addEventListener("scroll", () => {
      const nearBottom = this.dom.eventLog.scrollHeight - this.dom.eventLog.scrollTop - this.dom.eventLog.clientHeight < 12;
      if (nearBottom) {
        this.game.ui.unreadEvents = 0;
        this.dom.newEventBadge.hidden = true;
      }
    });
    this.dom.newEventBadge.addEventListener("click", () => {
      this.dom.eventLog.scrollTop = this.dom.eventLog.scrollHeight;
      this.game.ui.unreadEvents = 0;
      this.dom.newEventBadge.hidden = true;
    });
  }
}

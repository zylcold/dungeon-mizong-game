/** 集中创建界面引用与兼容性 DOM 操作。 */


export function replaceChildrenCompat(element, children) {
  element.innerHTML = "";
  (children || []).forEach((child) => element.appendChild(child));
}

export function createDOM() {
  return {
  gameShell: document.getElementById("gameShell"),
  stage: document.getElementById("stage"),
  gameCanvas: document.getElementById("gameCanvas"),
  minimapCanvas: document.getElementById("minimapCanvas"),
  minimapButton: document.getElementById("minimapButton"),
  fullMapCanvas: document.getElementById("fullMapCanvas"),
  endMapCanvas: document.getElementById("endMapCanvas"),
  floorValue: document.getElementById("floorValue"),
  healthText: document.getElementById("healthText"),
  healthFill: document.getElementById("healthFill"),
  healthTrack: document.querySelector(".health-track"),
  stepsValue: document.getElementById("stepsValue"),
  statusChip: document.getElementById("statusChip"),
  eventLog: document.getElementById("eventLog"),
  newEventBadge: document.getElementById("newEventBadge"),
  encounterCard: document.getElementById("encounterCard"),
  encounterIcon: document.getElementById("encounterIcon"),
  encounterKicker: document.getElementById("encounterKicker"),
  encounterTitle: document.getElementById("encounterTitle"),
  encounterDescription: document.getElementById("encounterDescription"),
  encounterOutcome: document.getElementById("encounterOutcome"),
  encounterActions: document.getElementById("encounterActions"),
  encounterClose: document.getElementById("encounterClose"),
  startOverlay: document.getElementById("startOverlay"),
  continueButton: document.getElementById("continueButton"),
  newGameButton: document.getElementById("newGameButton"),
  bestRecord: document.getElementById("bestRecord"),
  mapOverlay: document.getElementById("mapOverlay"),
  mapClose: document.getElementById("mapClose"),
  endOverlay: document.getElementById("endOverlay"),
  endTitle: document.getElementById("endTitle"),
  endReveal: document.getElementById("endReveal"),
  endStats: document.getElementById("endStats"),
  endRestartButton: document.getElementById("endRestartButton"),
  storyOverlay: document.getElementById("storyOverlay"),
  storyKicker: document.getElementById("storyKicker"),
  storyText: document.getElementById("storyText"),
  storyContinueButton: document.getElementById("storyContinueButton"),
  restartButton: document.getElementById("restartButton"),
  toast: document.getElementById("toast"),
  itemButtons: Array.from(document.querySelectorAll(".item-slot")),
  counts: {
    potion: document.getElementById("countPotion"),
    vision: document.getElementById("countVision"),
    execute: document.getElementById("countExecute"),
    teleport: document.getElementById("countTeleport")
  },
  timerVision: document.getElementById("timerVision")
};
}

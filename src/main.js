/** 浏览器启动入口；构建后作为离线经典脚本运行。 */


import { DungeonGame } from "./game.js";

const game = new DungeonGame();
window.__dungeonGame = game;

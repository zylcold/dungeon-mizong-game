# 「地下城：迷踪」深度玩法诊断与演进设计报告

> **分析基准版本**：`APP_VERSION = "1.12.0"`（`SAVE_VERSION = 4`，`STORY_TRIGGER_VERSION = 3`）  
> **定位约束**：纯前端 ES2017 / Chrome 61、单文件 IIFE 构建、零运行时依赖、确定性种子随机（`mulberry32` + `eventRoll`）、不引入云同步/账号/多人系统。  
> **参考规范**：[GAMEPLAY.md](GAMEPLAY.md) · [README.md](README.md) · [CHANGELOG.md](CHANGELOG.md) · [AGENTS.md](AGENTS.md) · [src/config.js](src/config.js)

---

## 核心诊断结论（Executive Summary）

1. **核心循环诊断**：单局策略退化为「HP 算术题 + 贴边直奔出口」。`135 × 135 = 18,225` 格巨型空间（`MAZE_SIZE = 135`）缺乏中场锚点，而 `18%–28%` 的高环路破墙率（`loopRate`）叠加非伏击 100% 可无损后退规则，消解了绕路与接战的博弈深度。
2. **剧情系统诊断**：全游戏 25 个叙事节点（序章 1 + 血量记忆 3 + 词条 21）与「普通演出间隔 20 步跳过即弃」规则存在结构性冲突。血量记忆线 `checkStoryProgress()` 因先写 `hpStoryRatioLow` 后判断 `proximateHold`，导致战斗/事件致伤触发的血量阈值极易永久漏演；`buildStoryCandidates` 通过拼接 `illusion` 与 `reality` 凑齐 4 条候选，不仅稀释单次信息量，还会当场剧透双线对照悬念。
3. **数值与平衡诊断**：单局全图回复池（超 `4,500+ HP`）与必杀道具（约 `60` 把）相对单局逃生所需的 `250–600` 步严重溢出；祭坛（`shrine`）名为扣血实则当场净回 `+3 HP` 并加 `+15 MaxHP`；毒史莱姆总毒伤封顶 `6 HP` 且不叠加；出口线索事件（全图 `105+` 处）与常驻方向箭头的缩略图叠加，使寻路彻底线性化。
4. **重玩动机诊断**：个人纪录榜（`SaveStore.loadRecords`）按 `steps` 降序排列且不区分 `escaped` 状态，导致「原地刷步数」排名高于「高效逃出迷宫」；底层虽具备完整的 `mulberry32(seed)` 确定性随机，却未暴露种子输入与每日挑战入口，且每局固定初始属性，缺乏局内轻构筑（Build）差异。

---

## 一、现状不足分析（附代码实现与规则依据）

### 1. 核心循环：算术化战斗与巨型迷宫的中后期空洞

#### 1.1 血量比较制战斗的决策单一性
* **代码依据**：
  * [src/core/combat.js](src/core/combat.js) `calculateCombatOutcome(state, enemy, surprise, useExecute)`：
    ```js
    const hpAfterCombat = Math.max(0, state.hp - (useExecute ? 0 : enemy.hp));
    const defeated = hpAfterCombat > 0;
    const advancesStep = defeated && !surprise;
    const poisonDamage = advancesStep && poisonTurnsAfterCombat > 0 ? POISON_DAMAGE_PER_STEP : 0;
    const hpAfterAction = Math.max(0, hpAfterCombat - poisonDamage);
    ```
  * [src/systems/combat.js](src/systems/combat.js) `openEnemyEncounter(enemy, target, key, surprise)`：在面板中直接向玩家展示 `combat.hpAfterAction` 与致命毒伤预警，且当 `!surprise` 时固定提供「后退」（`dismissEncounter`）按钮。
  * [src/core/maze.js](src/core/maze.js) `generateMaze(seed)`：破墙环路率 `const loopRate = 0.18 + rng() * 0.1;`，即每局打开 `3,280–5,103` 面封闭墙，且 `orderedWalls` 优先将 `deadEnd`（死胡同）排在前面打通。
* **系统分析**：
  1. **零信息差与零交换维度**：战斗只有唯一资源（HP）的线性减法，无先手、护甲、暴击、方位或回合概念，且结果在点击「迎战」前已 100% 算清。
  2. **高环路率瓦解卡位威胁**：由于死胡同被优先打通，迷宫呈高连通网格状。玩家遭遇高血量敌人（如 `skeleton` 15–25 HP、`ghost` 18–28 HP、`mimic` 22–35 HP）时，绕开该格通常只需多走 2–4 步，而正面迎战仅换取 `ENEMY_CHEST_DROP_RATE = 0.28`（28% 概率掉落宝箱）。因此理性决策恒定收敛为：**有 `execute`（一击必杀）则秒杀，无 `execute` 且绕路代价低则一律后退**。

#### 1.2 道具 4 种、事件 12 类的边际收益递减
* **代码依据**：
  * [src/data/catalog.js](src/data/catalog.js) `ITEM_DEFS`（4 种）与 `EVENT_DEFS`（12 种）。
  * [src/systems/inventory.js](src/systems/inventory.js) `randomItemFor(key, salt)`：固定按 `potion 38% / vision 28% / execute 17% / teleport 17%` 掉落；`useItem("vision")` 将视野步数 `clamp(visionTurns + 30, 30, 60)`。
  * [src/systems/events.js](src/systems/events.js) `resolveEvent(entity, key)`：12 类事件结算逻辑。
* **系统分析**：
  1. **事件结果同质化**：12 类事件在机制层面实际只有 4 类产出：
     * **给道具/回血**：`chest`（76% 道具 / 18% 回 20 HP）、`fountain`（回 25 HP）、`corpse`（66% 道具 / 34% 伏击）、`roots`（48% 扣 5–12 HP / 34% 道具 / 18% 线索）、`cache`（56% 道具 / 26% 回 14 HP / 18% 纯日志）。
     * **给出口线索（`exitHintTurns`）**：`map`（30 步）、`echo`（16 步）、`roots`（12 步）、`door`（无墙时 20 步）。
     * **扣血/减视野**：`trap`（扣 8–15 HP，保底 1 HP）、`fog`（视野降为 `FOG_VISION_RADIUS = 1` 持续 15 步）。
     * **空间改变**：`portal`（随机瞬移）、`door`（随机开一面墙）。
  2. **缺乏组合化学反应**：道具之间、事件与道具之间几乎没有联动（唯一联动是遇敌面板可用 `execute` 或吃 `potion` 刷新预测）。当玩家在开局前 100 步攒下 2–3 瓶药剂与 1–2 把必杀后，后续拾取的边际效用急剧滑坡。

#### 1.3 18,225 房间但目标单一的中后期空洞感
* **代码依据**：
  * [src/config.js](src/config.js) `MAZE_SIZE = 135`，`AUTO_PATH_DELAY = 95`。
  * [src/core/maze.js](src/core/maze.js) 出生点 `center = 67`，外围出口 `1–3` 个，距中心曼哈顿距离 `≥ Math.floor(135 * 0.72) = 97` 格。
  * [src/rendering/map-renderer.js](src/rendering/map-renderer.js) `drawMap(ctx, width, height, revealAll, compact)`：
    ```js
    const compactHints = compact
      ? this.game.state.maze.exits.map((exit) => this.getExitHintDirection(exit))
      : [];
    // compact 模式下无需 exitHintTurns > 0，始终绘制出口正方向箭头（globalAlpha = 0.76 或 1）
    ```
* **系统分析**：
  1. **空间利用率不足 3%**：从 `(67, 67)` 走到边界 `(x, 0)` 或 `(134, y)` 的最短路径仅约 `70–110` 步，正常探索逃出仅需访问 `250–600` 个房间，其余 `17,600+` 个房间完全处于冗余状态。
  2. **开局即暴露大方向**：右上角缩略图（`compact = true`）从第 0 步起就常驻显示出口位于正北/正南/正东/正西的箭头。玩家无需在迷宫中寻找方向，只需朝着箭头一侧不断滑动+点击已探索边缘自动寻路（`startAutoPath`），导致 15–30 分钟流程的后半段变成枯燥的赶路。

---

### 2. 剧情系统：跳过丢弃机制的叙事损耗与伪变体问题

#### 2.1 血量记忆残片（75/50/25）的永久漏演漏洞
* **代码依据**：
  * [src/systems/story.js](src/systems/story.js) `checkStoryProgress()`：
    ```js
    const healthRatio = this.game.state.hp / Math.max(1, this.game.state.maxHp);
    const previousLow = Number.isFinite(this.game.state.hpStoryRatioLow) ? this.game.state.hpStoryRatioLow : 1;
    if (healthRatio >= previousLow) return;
    this.game.state.hpStoryRatioLow = healthRatio;
    this.game.save();
    if (this.proximateHold) return;
    const eligible = STORY_SCENES.filter((scene) => (
      healthRatio <= scene.threshold && !this.game.state.storyScenes.includes(scene.id)
    ));
    if (!eligible.length) return;
    const scene = eligible[eligible.length - 1];
    ```
  * [src/systems/combat.js](src/systems/combat.js) `finishEnemyVictory()`：
    ```js
    this.game.story.proximateHold = true;
    try {
      if (!surprise) this.game.movement.commitMove(target, { skipTrigger: !droppedChest });
      ...
      this.game.story.tryPlayLore(`enemy:${enemy.type}`);
    } finally {
      this.game.story.proximateHold = false;
    }
    ```
* **系统分析（三大叙事损耗机制）**：
  1. **主动作抢占导致阈值白白记账**：玩家绝大多数掉血都发生在**战斗获胜扣血**（`finishEnemyVictory` 期间 `proximateHold = true`）或**事件结算扣血**（`crossRoots` / `trap` 在 `finishEncounter` 中先调 `attemptPendingLore()` 占用了当步演出额度，随后才调 `updateUI() -> checkStoryProgress()`）。此时 `hpStoryRatioLow` 已经被改写为新低值（例如从 `1.0` 直接改写为 `0.70`），但演出因 `proximateHold` 或同步冷却/20 步冷却被直接跳过！
  2. **回血后再受伤无法重新触发同一阈值区段**：一旦 `hpStoryRatioLow` 在未演出状态下被刷到 `0.45`，即便玩家吃药回到 `0.90` 再跌到 `0.48`，也会因 `healthRatio >= previousLow`（`0.48 >= 0.45`）被直接拒之门外。
  3. **逆序选取 `eligible[eligible.length - 1]` 跳过前序残片**：若 `memory-75` 在 `0.72` 时因冷却跳过，玩家在 `0.48` 时终于满足冷却，`eligible` 包含 `["memory-75", "memory-50"]`，代码取最后一项播放了 `memory-50`；待下次跌破 `0.25` 时又取最后一项播放 `memory-25`，导致 `memory-75` 整局永远无法播出。

#### 2.2 候选变体 3–5 条的「拼接剧透」与重复度
* **代码依据**：[src/systems/story.js](src/systems/story.js) `buildStoryCandidates(story)`：
  ```js
  if (Array.isArray(story?.variants)) story.variants.forEach(pushUnique);
  pushUnique(story?.illusion);
  pushUnique(story?.reality);
  ...
  const baseA = unique[0] || "";
  const baseB = unique[1] || baseA;
  if (unique.length >= 2) [`${baseA}\n\n${baseB}`, `${baseB}\n\n${baseA}`].forEach(pushUnique);
  ```
* **系统分析**：
  * [src/data/stories.js](src/data/stories.js) 中的 `STORY_SCENES`（3 条）和 `LORE_SCENES`（21 条）**没有任何一条定义了 `variants` 数组**，全部只有 `illusion` 和 `reality` 两个字段。
  * 因此 `buildStoryCandidates` 实际构造的 4 个候选项为：
    1. `v1`：纯 `illusion`（幻觉单段）
    2. `v2`：纯 `reality`（现实单段）
    3. `v3`：`illusion + "\n\n" + reality`（上段幻觉 + 下段现实直接揭底）
    4. `v4`：`reality + "\n\n" + illusion`（上段现实 + 下段幻觉）
  * **设计缺陷**：玩家有 **50% 概率**在单次弹窗中同时读到完全一样的 `illusion` 与 `reality` 两段话，这不仅让「幻觉/现实双线各自独立成立、多局拼凑真相」的设计初衷失效，还使得第 2 局重玩时抽中所谓「不同变体」的文字 100% 是第 1 局已经看过的句子排列组合。

---

### 3. 数值与平衡：资源池冗余与威胁失效

#### 3.1 全图实体投放与 HP 经济账本推演
根据 [src/core/maze.js](src/core/maze.js) 与 [src/config.js](src/config.js) 对单局 `18,225` 房间的精确期望计算：

| 实体类别 | 投放公式 / 权重 | 期望数量 / 局 | 折算 HP / 资源产投比 |
| --- | --- | --- | --- |
| **敌人总数** | `18225 × (4.5% ~ 6.0%)` | **820 ~ 1,093 只** | 全图仅需打通路径上的 8–15 只即可出逃 |
| ├ 地穴鼠 (`rat`) | 权重 `7/26` (26.9%)，HP `6–12` | ~257 只 | 均伤 `9 HP`，击败还掉 `28%` 宝箱（期望反赚补给） |
| ├ 骷髅守卫 (`skeleton`) | 权重 `7/26` (26.9%)，HP `15–25` | ~257 只 | 均伤 `20 HP`，无特殊机制 |
| ├ 毒史莱姆 (`slime`) | 权重 `5/26` (19.2%)，HP `12–20` | ~184 只 | 均伤 `16 HP` + 固定 `6 HP` 毒伤 = `22 HP` |
| ├ 游荡幽灵 (`ghost`) | 权重 `4/26` (15.4%)，HP `18–28` | ~147 只 | 均伤 `23 HP`，1 格显形但可无损「后退」 |
| └ 宝箱怪 (`mimic`) | 权重 `3/26` (11.5%)，HP `22–35` | ~110 只 | 均伤 `28.5 HP`，贴脸显形后仍可无损「后退」 |
| **地面直落道具** | `⌊18225 × 1.2%⌋` | **218 个** | `potion` ~79 瓶 (`+2,370 HP`)、`vision` ~59、`execute` ~40、`teleport` ~40 |
| **随机事件总数** | `⌊18225 × 3.5%⌋` | **637 个** | 12 类事件按总权重 `53` 分配 |
| ├ 恢复类事件 | `fountain` (5/53) + `chest` 18% + `cache` 26% | ~60 泉 + ~15 箱 + ~12 袋 | 合计提供约 **`+1,960 HP`** 直接恢复 |
| ├ 道具产出事件 | `chest` 76% + `corpse` 66% + `roots` 34% + `cache` 56% | 合计产出 **~145 件道具** | 额外提供 `potion` ~55 瓶 (`+1,650 HP`)、`execute` ~25 把 |
| └ 古老祭坛 (`shrine`) | 权重 `4/53` (7.5%) | **~48 座** | 每座 `-12 HP` 再 `+15 MaxHP / +15 HP`，**净回 `+3 HP` 且撑高上限** |

* **核心失衡点**：
  1. **伪装怪（幽灵/宝箱怪）零惩罚**：`attemptMove`（[src/systems/movement.js](src/systems/movement.js) 第 160–166 行）在玩家迈向 `ghost` 或未显形的 `mimic` 时，只是弹出 `openEnemyEncounter(..., surprise = false)`，**既不强制交战，也不扣除步数或血量**，玩家点「后退」即可全身而退，使 `mimic` 的伪装和 `ghost` 的隐身完全失去惊吓与惩罚意义。
  2. **祭坛正收益倒挂**：[src/systems/events.js](src/systems/events.js) `useShrine` 中 `this.game.state.hp -= 12; this.game.state.maxHp += 15; this.game.state.hp += 15;` 导致献祭后当前 HP 反而增加了 `3` 点，违背了文案“用疼痛换取更强的身体”的风险交换原则。
  3. **出口守卫 `guardian` 闲置**：[src/data/catalog.js](src/data/catalog.js) 中唯一具有压迫感的 `guardian`（35–55 HP）未被放入生成池，导致终局逃脱缺乏守门 Boss 战。

---

### 4. 重玩动机：排行榜导向扭曲与零构筑差异

* **代码依据**：[src/state/save-store.js](src/state/save-store.js) `loadRecords()` 与 `completeRun(record)`：
  ```js
  records.sort((a, b) => b.steps - a.steps || (b.explored || 0) - (a.explored || 0));
  ```
* **系统分析**：
  1. **目标激励悖论**：游戏主目标是“找到迷宫外围的出口”，但个人纪录榜（以及开始界面的 `bestRecord`）却把 `steps`（总步数）越大排在越前面，甚至 `escaped: false`（中途毒发或撞怪身亡）的 2,000 步记录会压过 `escaped: true` 的 300 步速通记录。
  2. **单局规则零变异**：每次 `startNewGame()` 均固定为 `hp: 100, maxHp: 100, inventory: { potion: 1, vision: 0, execute: 0, teleport: 0 }`，既无局内被动分支，也无种子挑战模式，玩家看完结局后缺乏开第二局的系统驱动力。

---

## 二、丰富玩法提案（共 6 条，按实现成本从低到高排序）

### 提案总览对比表

| 编号 | 提案名称 | 解决痛点 | 预计代码量级 | 存档与触发器版本影响 |
| --- | --- | --- | --- | --- |
| **P1** | 种子分享、每日挑战与逃生效率榜重构 | 重玩动机、排行榜刷步数悖论 | **小**（~85 行） | 保持 `SAVE_VERSION = 4`、`STORY_TRIGGER_VERSION = 3` |
| **P2** | 出口守卫（`guardian`）复苏与远近出口博弈 | 终局无高潮、资产闲置、找出口太线性 | **小**（~90 行） | 保持 `SAVE_VERSION = 4`、`STORY_TRIGGER_VERSION = 3` |
| **P3** | 祭坛「破釜沉舟」多层契约与毒素腐蚀机制 | 祭坛白送血、毒素威胁过低 | **小**（~95 行） | 保持 `SAVE_VERSION = 4`、`STORY_TRIGGER_VERSION = 3` |
| **P4** | 局部小目标：3 块「回响碎片」与第三真结局 | 18,225 格中场空洞、双结局单一 | **中**（~160 行） | `migrations.js` 补 `shardsCollected: 0`，不升版本号 |
| **P5** | 敌人特性差异化（幽灵迷眼/骷髅架盾/宝箱怪破绽） | 血量比较制战斗决策单一、环路无战术价值 | **中**（~220 行） | 保持 `SAVE_VERSION = 4`、`STORY_TRIGGER_VERSION = 3` |
| **P6** | 轻构筑系统：「山谷遗物」3 选 1 微 Buff | 多局体验同质化、缺乏 Build 差异 | **中**（~260 行） | `migrations.js` 补 `relics: []`（或升 `SAVE_VERSION = 5`） |

---

### P1. 种子分享、每日挑战与逃生效率榜重构
* **预计代码量级**：**小（~85 行）**
* **规则草案**：
  1. **支持自定义种子与每日挑战**：
     * `createInitialState(customSeed, mode = "normal")` 支持传入指定种子；若未传则走 `randomSeed()`。
     * 开始界面（`startOverlay`）增加「每日迷宫」按钮（以当天本地日期 `YYYY-MM-DD` 计算 `hashString("daily:" + dateStr)` 作为固定种子）与「种子挑战」输入框（支持输入任意字符串或数字种子）。
     * 结算界面（`endOverlay`）在统计栏展示本局 8 位十六进制种子码（如 `SEED: 7A3F9C12`）及「重玩同种子」按钮。
  2. **纪录榜排序合理化**：
     * 修改 `SaveStore.loadRecords` 排序准则为：**① 成功逃生（`escaped === true`）优先于未逃生；② 逃生局按 `steps` 升序（步数越少越强），同步数按 `explored` 降序；③ 未逃生局按 `explored`（探索格数）降序**。
     * 开始界面 `bestRecord` 优先展示：「最佳逃生：`X` 步 · 探索 `Y` 格」（若尚无逃生纪录则展示「最远探索：`Y` 格 · `X` 步」）。
* **涉及文件**：
  * [src/core/random.js](src/core/random.js)（新增 `dailySeed()` 与 `parseSeedInput(raw)`）
  * [src/state/initial-state.js](src/state/initial-state.js)（`createInitialState(seed)` 接收可选参数）
  * [src/state/save-store.js](src/state/save-store.js)（重构 `compareRecords(a, b)` 排序函数）
  * [src/game.js](src/game.js)、[src/ui/game-ui.js](src/ui/game-ui.js)、[public/index.html](public/index.html)
* **与 `eventRoll` 兼容性**：100% 兼容。整套迷宫生成与事件判定原本就建立在 `this.game.state.maze.seed` 之上，固定 `seed` 即可获得完全一致的地图、怪物 HP、宝箱掉落与文案抽样。
* **风险点**：`SAVE_VERSION` 与 `STORY_TRIGGER_VERSION` 均无需变更；旧 `localStorage` 中的 `dungeon-mizong-records-v1` 数组会在下次 `loadRecords()` 时自动按新规则重排。
* **`GAMEPLAY.md` / `tests` 需同步的点**：
  * 更新 [GAMEPLAY.md](GAMEPLAY.md) 第 10 节「存档与纪录」排序规则说明。
  * 更新 [tests/unit.test.mjs](tests/unit.test.mjs) 第 47–59 行中 `store.completeRun` 的测试断言（补充 `escaped: true` 排序校验）。

---

### P2. 出口守卫（`guardian`）复苏与远近出口差异化博弈
* **预计代码量级**：**小（~90 行）**
* **规则草案**：
  1. **唤醒闲置资产 `guardian`**：直接启用 [src/data/catalog.js](src/data/catalog.js) 已定义的 `guardian`（出口守卫，35–55 HP，图集帧 `enemy-guardian: [2, 2]`）。
  2. **远近出口风险分层**：
     * 当 `generateMaze` 生成 `2–3` 个出口时，按中心 `(67, 67)` 到各出口的 `shortestPath` 长度排序：
     * **近端出口（主出口）**：在从中心通往该出口最短路径的**倒数第 5 格**（即 `approachPath[approachPath.length - 5]`，恰好位于 `EXIT_SAFE_PATH_ROOMS = 4` 安全区外侧第 1 格，严格遵守“最后 4 格为空”的约束）放置 1 只 `guardian`（HP `35–55`），并在右上角缩略图常驻显示暗红色方向箭头。
     * **远端出口（隐秘出口）**：不放置 `guardian`，但右上角缩略图默认**隐藏**其方向箭头，仅当玩家触发地图残片/回声/盘根使 `exitHintTurns > 0` 时，才在缩略图与全览图上浮现亮金色方向箭头。
  3. **守卫精英特性**：对 `guardian` 使用「一击必杀」（`execute`）不会直接秒杀，而是将其当前 HP 削减 **50%**（向下取整）并消耗 1 把必杀剑，玩家留在原格不前进；正面击败 `guardian` 100% 掉落封尘宝箱。
* **涉及文件**：
  * [src/core/maze.js](src/core/maze.js)（在 `exits` 循环后，为最短路出口的 `slice(-5, -4)` 节点生成 `guardian`）
  * [src/core/combat.js](src/core/combat.js) 与 [src/systems/combat.js](src/systems/combat.js)（处理 `enemy.type === "guardian"` 时的 `useExecute` 削血逻辑）
  * [src/rendering/map-renderer.js](src/rendering/map-renderer.js)（区分 guarded 出口与隐秘出口的箭头显隐）
  * [src/data/copy.js](src/data/copy.js) 与 [src/data/stories.js](src/data/stories.js)（补齐 `enemy:guardian` 遭遇文案与首杀残片）
* **与 `eventRoll` 兼容性**：守卫在 `generateMaze(seed)` 阶段放置在 `entities` 字典完成后执行，或使用派生 `mulberry32(seed ^ 0x13579bdf)` 生成其 HP，确保不扰动原有 `available` 房间洗牌序列。
* **风险点**：[tests/smoke.test.cjs](tests/smoke.test.cjs) 第 194 行有显式断言 `assert.equal(initialEnemies.some((enemy) => enemy.type === "guardian"), false, "出口附近不再放置守卫")` 及 `loreKeys` 列表（21 项），启用时必须同步更新该回归断言。
* **`GAMEPLAY.md` / `tests` 需同步的点**：
  * 更新 [GAMEPLAY.md](GAMEPLAY.md) 第 2 节注记（移除“当前生成器不投放”）与第 4 节战斗表格。
  * 更新 [tests/smoke.test.cjs](tests/smoke.test.cjs) 第 194 行、第 229 行 `loreKeys`（21 → 22）及第 395 行安全区测试。

---

### P3. 祭坛「破釜沉舟」多层契约与毒素腐蚀机制
* **预计代码量级**：**小（~95 行）**
* **规则草案**：
  1. **祭坛真实献祭与三阶递进**：
     * 修正 [src/systems/events.js](src/systems/events.js) `useShrine(key)` 的数值倒挂：献祭改为**扣除当前生命 `15 HP`，永久提升 `maxHp += 20`（不再当场白送 `+15 HP`）**，真正构成“用眼前血量换取后续恢复上限与血量比例优势”的策略抉择。
     * 同一座祭坛在献祭后不立即消失，而是记录 `entity.sacrifices = (entity.sacrifices || 0) + 1`（最多 3 次）：
       * 第 1 次：`-15 HP`，`maxHp +20`；
       * 第 2 次：`-20 HP`，`maxHp +20`，并获得 `visionTurns +20`；
       * 第 3 次：`-25 HP`，`maxHp +20`，额外获得 `execute +1`，随后祭坛碎裂消失并触发 S2 隐藏支线。
  2. **毒素叠加与受疗腐蚀**：
     * [src/core/combat.js](src/core/combat.js) 中击败 `slime` 后的中毒步数由 `Math.max(state.poisonTurns, SLIME_POISON_DURATION)` 改为**可叠加**：`Math.min(9, state.poisonTurns + SLIME_POISON_DURATION)`（上限 9 步 = 18 HP）。
     * 当 `state.poisonTurns > 0` 时，使用 `potion`（恢复药剂）或饮用 `fountain`（生命泉）会**立即净化全部毒素（`poisonTurns = 0`）**，但因药力用于解毒，本次 HP 回复量减少 `8` 点（`potion` 最多回 `22 HP`，`fountain` 最多回 `17 HP`）。
* **涉及文件**：
  * [src/core/combat.js](src/core/combat.js)、[src/systems/events.js](src/systems/events.js)、[src/systems/inventory.js](src/systems/inventory.js)
* **与 `eventRoll` 兼容性**：纯确定性状态转移，不新增随机调用。
* **风险点**：`calculateCombatOutcome` 中连续打两只史莱姆的 `poisonTurnsAfterCombat` 会累加；旧档完全兼容。
* **`GAMEPLAY.md` / `tests` 需同步的点**：
  * 更新 [GAMEPLAY.md](GAMEPLAY.md) 第 4 节毒史莱姆特性、第 5 节古老祭坛与生命泉、第 6 节恢复药剂说明。
  * 检查并同步 [tests/smoke.test.cjs](tests/smoke.test.cjs) 第 325 行 `resolvePending` 中 `case "shrine"` 的处理（若祭坛可献祭 3 次，`resolvePending` 应在献祭 1 次后调 `leaveEvent` 或献祭满 3 次销毁，避免 `while (game.pending && safety++ < 5)` 超限）。

---

### P4. 局部小目标：3 块「回响碎片」与第三真结局
* **预计代码量级**：**中（~160 行）**
* **规则草案**：
  1. **三环中场锚点投放**：
     * 在 `generateMaze(seed)` 完成常规实体投放后，使用独立派生随机源 `const shardRng = mulberry32(seed ^ 0x9e3779b9)`，在距中心曼哈顿距离 `30 ≤ dist ≤ 62` 的三个象限扇区内，挑选 3 个 `cache`（遗落农具）或 `corpse`（冒险者遗骸）事件格，挂载属性 `shardId: 1 | 2 | 3`（分别对应信物：「停摆的铜怀表」「蓝布药瓶塞」「刻名护林牌」）。
  2. **回声与残片的双重指引**：
     * 当玩家触发 `echo`（谷底回声）或 `map`（地图残片）使 `exitHintTurns > 0` 时，缩略图与全览图不仅指示外围出口，还以**青色菱形光点（`#61d9f2`）**标出距离玩家最近的未收集「回响碎片」方向。
     * 玩家完成带 `shardId` 的事件交互时，除了常规奖励外，必定获得对应信物（`state.shards.push(entity.shardId)`），顶部 HUD `floorValue` 旁或 `statusChip` 显示 `记忆信物 X/3`。
  3. **解锁第三真结局**：
     * 当 `state.shards.length === 3` 时走出迷宫出口，`endGame(reason, true)` 判定进入第三真结局 `ending-awakened`（详见第三部分 S3）。
* **涉及文件**：
  * [src/core/maze.js](src/core/maze.js)、[src/state/initial-state.js](src/state/initial-state.js)、[src/state/migrations.js](src/state/migrations.js)、[src/systems/events.js](src/systems/events.js)、[src/rendering/map-renderer.js](src/rendering/map-renderer.js)、[src/data/endings.js](src/data/endings.js)、[src/ui/game-ui.js](src/ui/game-ui.js)
* **与 `eventRoll` 兼容性**：使用独立异或种子 `seed ^ 0x9e3779b9` 为既有事件格打标签，零侵入原 `rng` 序列与 `eventRoll`。
* **风险点**：新增持久化字段 `state.shards = []`，必须在 [src/state/migrations.js](src/state/migrations.js) `restoreState(state)` 中补齐：`state.shards = Array.isArray(state.shards) ? state.shards : [];`，即可保持 `SAVE_VERSION = 4` 平滑升级。
* **`GAMEPLAY.md` / `tests` 需同步的点**：
  * 在 [GAMEPLAY.md](GAMEPLAY.md) 第 1、2、9 节补充「回响碎片」投放规则与第三结局触发条件。
  * 在 [tests/smoke.test.cjs](tests/smoke.test.cjs) 新增集齐 3 块碎片后触发 `ending-awakened` 的回归测试。

---

### P5. 敌人特性差异化：方位博弈与幽灵显形机制扩展
* **预计代码量级**：**中（~220 行）**
* **规则草案**：在不引入复杂多回合战斗的前提下，将**空间走位、视野状态、环路绕行**深度绑定到 `calculateCombatOutcome` 纯函数中：
  1. **游荡幽灵（`ghost`）——「噬光与惊惧」**：
     * **显形扩展**：常态下仍为距离 `≤ 1` 格显形；但当玩家处于 `fogTurns > 0`（浓雾）时，幽灵在 `2` 格距离即以半透明闪烁显形，且战斗损耗增加 **`+6 HP`**（浓雾助长幽灵）。
     * **强光破魅**：当玩家开启 `visionTurns > 0`（视野拓宽道具生效期）时，全场幽灵强制显形，且迎战幽灵的 HP 损耗**减半**（`Math.ceil(enemy.hp * 0.5)`），赋予 `vision` 道具明确的战斗克制价值！
     * **退避代价**：遭遇幽灵面板点击「后退」时，若当前未开启 `visionTurns`，幽灵会吹散阴风使玩家获得 `fogTurns = Math.max(state.fogTurns, 6)`。
  2. **骷髅守卫（`skeleton`）——「正面铁盾与绕后破绽」**：
     * 利用 `hashString(seed + ":" + key + ":dir") % 4` 为每只骷髅确定性分配朝向 `facing`（`up/right/down/left`），主画面在骷髅格朝向侧绘制一道亮色盾线。
     * 若玩家从骷髅正对的方向迎战（正面撞盾），战斗损耗 **`+5 HP`**；若玩家利用迷宫环路绕到其侧面或背后房间发起迎战（破甲背刺），战斗损耗 **`-6 HP`（最低扣 5 HP）**。
  3. **宝箱怪（`mimic`）——「贴脸伏击锁死」**：
     * 当 `mimic` 处于未显形状态（`!entity.revealed`）时，玩家一脚迈向该格触发的 `openEnemyEncounter` 改为 **`surprise = true`（遭遇伏击，不可点击后退！）**；唯有玩家在开启 `visionTurns > 0` 期间靠近（视野看破伪装，提前将 `revealed = true`），才允许不进战安全绕开。击败 `mimic` 100% 掉落真宝箱。
* **涉及文件**：
  * [src/core/combat.js](src/core/combat.js)（扩展 `calculateCombatOutcome(state, enemy, surprise, useExecute, approachDir)`）
  * [src/systems/combat.js](src/systems/combat.js)、[src/systems/movement.js](src/systems/movement.js)、[src/rendering/maze-renderer.js](src/rendering/maze-renderer.js)
* **与 `eventRoll` 兼容性**：骷髅朝向由坐标哈希静态派生，幽灵、宝箱怪规则均为纯确定性状态分支，100% 保持同种子可回放。
* **风险点**：`mimic` 首次贴脸触发 `surprise = true` 会改变 `walkTo` 辅助函数在测试中的行为（`smoke.test.cjs` 的 `resolvePending` 已经会把遇到的敌人加血打死，因此自动寻路测试依然全绿，但需确认 `surprise` 不额外计步的断言）。
* **`GAMEPLAY.md` / `tests` 需同步的点**：
  * 更新 [GAMEPLAY.md](GAMEPLAY.md) 第 4 节五类敌人特性表。
  * 在 [tests/unit.test.mjs](tests/unit.test.mjs) 补充幽灵强光减半、骷髅背刺减伤与宝箱怪伏击的纯函数单测。

---

### P6. 轻构筑系统：「山谷遗物」3 选 1 微 Buff（单局最多 2 件）
* **预计代码量级**：**中（~260 行）**
* **规则草案**：
  1. **零新 UI 弹窗的获取流程**：
     * 玩家在单局第 `1` 次与第 `4` 次开启 `chest`（或完成 `shrine` 献祭）时，直接复用现有 `encounterCard` 面板（`kicker: "记忆遗物 · 三选一"`），在 `encounterActions` 中渲染 3 个遗物按钮，点击即收入 `state.relics` 数组（单局上限 **2 件**，形成 `C(6, 2) = 15` 种双遗物组合流派）。
  2. **6 件山谷遗物设计表**：

| 遗物 ID | 名称 | 叙事意象（农夫旧物） | 局内被动效果（微 Buff） |
| --- | --- | --- | --- |
| `sickle` | **磨薄的短镰** | 梯田割稻与开路的随身铁器 | 所有非必杀战斗承受的敌方 HP 伤害 `-3`（最低扣 `1 HP`） |
| `lantern` | **裂口铜油灯** | 父亲传下、山风吹不灭的旧灯 | 常态视野半径由 `2` 格升至 `3` 格；抵消 `fog` 事件 50% 持续步数 |
| `sachet` | **艾草辟瘴囊** | 妻子塞在篓底防虫蛇的香囊 | 毒伤由 `2 HP/步` 降至 `1 HP/步`；`trap` 与 `roots` 伤害减半 |
| `sandals` | **双耳麻草鞋** | 走惯山路、浸雨反而不滑的鞋 | 每满 `20` 步自动恢复 `3 HP`；`portal` 与 `teleport` 落地额外回 `8 HP` |
| `plaque` | **刻痕护林牌** | 记录后山暗渠与捷径的木牌 | 打开 `door`（神秘石门）额外获得 `1` 把 `execute`（每局最多触发 2 次） |
| `Gourd` | **苦药旧芦瓢** | 盛过无数次草药汤的葫芦瓢 | `potion` 回复量 `+10`（升至 `40 HP`）；满血时喝药可转化为 `+8 MaxHP` |

* **涉及文件**：
  * [src/data/catalog.js](src/data/catalog.js)（新增 `RELIC_DEFS`）、[src/state/initial-state.js](src/state/initial-state.js)、[src/state/migrations.js](src/state/migrations.js)、[src/core/combat.js](src/core/combat.js)、[src/systems/events.js](src/systems/events.js)、[src/systems/inventory.js](src/systems/inventory.js)、[src/systems/movement.js](src/systems/movement.js)、[src/systems/vision.js](src/systems/vision.js)、[src/ui/game-ui.js](src/ui/game-ui.js)
* **与 `eventRoll` 兼容性**：3 选 1 候选通过 `shuffled(Object.keys(RELIC_DEFS), mulberry32(hashString(seed + ":" + key + ":relics"))).slice(0, 3)` 确定性抽出。
* **风险点**：`migrations.js` 需补齐 `state.relics = Array.isArray(state.relics) ? state.relics : [];`。若希望严格隔离存档结构，可将 `SAVE_VERSION` 从 `4` 升至 `5`（升级 `SAVE_VERSION` 时需同步检查 `unit.test.mjs`）。
* **`GAMEPLAY.md` / `tests` 需同步的点**：
  * 在 [GAMEPLAY.md](GAMEPLAY.md) 新增第 6.5 节「山谷遗物（轻构筑）」。
  * 在 [tests/smoke.test.cjs](tests/smoke.test.cjs) 新增遗物抽取去重、上限 2 件及被动生效回归测试。

---

## 三、丰富剧情提案（共 3 条，紧扣「昏迷幻象 / 山谷自救」框架）

### S1. 叙事防漏演修复 + 5 类敌怪对照残片 + 4 类缺失事件触发文案
* **预计代码量级**：**小（~90 行，主要为 `src/data/stories.js`、`src/data/copy.js` 与 `src/systems/story.js`）**

#### 1.1 修复 `checkStoryProgress` 漏演与 `buildStoryCandidates` 伪变体
* **代码级改动点（[src/systems/story.js](src/systems/story.js)）**：
  1. 在 `checkStoryProgress()` 中，**不要在 `proximateHold` 或冷却校验前覆写 `hpStoryRatioLow`**；改为仅当 `tryPlayStory` 返回 `true`（真正弹出演出）时，才将该段 `scene.threshold` 记入 `storyScenes` 并更新 `hpStoryRatioLow`，且将 `const scene = eligible[eligible.length - 1]` 改为 `const scene = eligible[0]`（严格按 `memory-75 → memory-50 → memory-25` 顺序揭示，不跳段）。
  2. 在 `buildStoryCandidates(story)` 中，移除 `${baseA}\n\n${baseB}` 这种把幻觉与现实直接拼在同一弹窗里的逻辑，改为读取每条故事的 `[story.illusion, story.reality, ...(story.variants || [])]`，确保每次弹窗只呈现纯粹的一条视角，多局游玩才能拼出全貌。

#### 1.2 五类敌怪新增背景碎片（幻觉线 + 现实线对照，各 2–3 句）
可直接作为 `variants: [illusion2, reality2]` 注入 [src/data/stories.js](src/data/stories.js) 的 `LORE_SCENES`：

1. **地穴鼠（`enemy:rat`）**
   * **幻觉线（`illusion` 变体）**：
     > 它们从不单独行动，每只死去的灰鼠腹中都塞着半截带字的布条。你怀疑它们一直在替迷宫搬运闯入者散落的生平，直到把你的来路彻底吃空。
   * **现实线（`reality` 变体）**：
     > 谷底乱石间散着几粒发潮的炒米，那是妻子昨晚在铁锅里一勺勺焙干的。山鼠顺着雨水冲刷的泥沟聚拢过来，倒替昏沉的你标出了摔落时的斜坡方向。

2. **骷髅守卫（`enemy:skeleton`）**
   * **幻觉线（`illusion` 变体）**：
     > 守卫倒下时，胸骨间卡着一枚早已停摆的铜壳怀表。它似乎曾是某个比你更早醒来的人，只因迟疑了太久，才被走廊同化成冰冷的路障。
   * **现实线（`reality` 变体）**：
     > 被山风吹垮的稻草人下压着半截断锄，木柄上还留着你父亲当年刻下的防滑横纹。那是去年秋收后留在梯田边的旧物，只是高烧与眩晕让它显得面目可憎。

3. **毒史莱姆（`enemy:slime`）**
   * **幻觉线（`illusion` 变体）**：
     > 暗绿胶质在石面上沸腾，映出无数张扭曲求救的面孔。每当它擦过你的脚踝，血液里就像多了一道催促你放弃呼吸的诅咒。
   * **现实线（`reality` 变体）**：
     > 腐叶下的积水混着断肠草与荆棘的白汁，沾上小腿擦伤后灼痛难忍。你知道这种山谷湿毒不能硬撑，必须尽快找到活水冲洗，否则天黑前就会发起高热。

4. **游荡幽灵（`enemy:ghost`）**
   * **幻觉线（`illusion` 变体）**：
     > 它总在拐角处背对你站立，披着一件被灰雨浸透的旧衣。当你试图看清它的五官时，它却用你自己的嗓音低声问你：为什么还不回家？
   * **现实线（`reality` 变体）**：
     > 山雾把远处搜救人的蓑衣影子拉得极长，手电与火把的光晕在水汽里一明一暗。风声把村支书沙哑的吆喝吹得断断续续，听起来竟像贴在耳畔的叹息。

5. **宝箱怪（`enemy:mimic`）**
   * **幻觉线（`illusion` 变体）**：
     > 箱锁合拢的瞬间像捕兽夹咬碎骨头，里面没有金银，只有一团蠕动的暗红肉块。迷宫似乎在嘲笑你：越是急着寻找生机的人，越容易把手伸进死地。
   * **现实线（`reality` 变体）**：
     > 你伸手去够那只挂在荆棘丛里的旧竹篓，却惊动了躲在篓底避雨的野獾。利爪在你手背留下一道血痕后窜入草丛，篓底则露出你出门前塞进去的半卷麻布。

#### 1.3 补齐 12 类事件中缺失的 4 类触发文案（[src/data/copy.js](src/data/copy.js) `EVENT_COPY`）
当前 `EVENT_COPY` 仅定义了 8 类选择型事件，`trap`、`map`、`fog`、`echo` 四类即时事件无描述文案池。建议在 `EVENT_COPY` 中补齐，并在 `resolveEvent` 的日志与 Toast 中调用 `pickCopy` 输出：

```js
  trap: [
    "松动的石板在脚下骤然下陷，锈蚀铁刺带着寒气从砖缝间弹起。",
    "地面裂开一道窄口，某种暗藏的机括在黑暗中发出冷酷的脆响。",
    "脚底踩空的一瞬，湿滑碎石混着尖锐断枝狠狠扎进草鞋。"
  ],
  map: [
    "墙角压着半张染血的羊皮卷，残存的墨迹正指向外围的某处缺口。",
    "石壁上留着前人用利器刻下的箭头，笔画急促却依然清晰。",
    "一块钉在岩缝里的护林木牌露出半角，熟悉的炭笔符号让你猛然记起山脊走向。"
  ],
  fog: [
    "粘稠的灰白水汽从走廊深处翻涌而来，火光在两步之外便彻底失明。",
    "寒冷雾气贴着地面漫过脚踝，四周的暗红石墙在视野里迅速融化。",
    "山谷底部的湿气随着阵风倒灌进来，连近在咫尺的岩壁也只剩模糊轮廓。"
  ],
  echo: [
    "空旷回廊深处传来层层叠叠的呼唤，每次折返都比上一次更接近出口。",
    "你听见高处落下一阵急促的敲击声，在石壁间撞出指路的回响。",
    "铜盆声与熟悉的犬吠穿过层层山雾落进谷底，有人正在上方沿着水沟找你。"
  ]
```

---

### S2. 可选支线设计：「祭坛的低语 / 土地龛的旧愿」（连续 3 次献祭触发）
* **预计代码量级**：**小（~75 行）**
* **设计定位**：为愿意在单局内承担高风险（累计献祭 3 次）的玩家提供一条揭露「农夫清晨冒雨上山真正原因」的深层叙事支线，并直接赋能终局结局变体。
* **状态字段与存档迁移**：
  * 在 [src/state/initial-state.js](src/state/initial-state.js) 中新增：`shrineSacrifices: 0`。
  * 在 [src/state/migrations.js](src/state/migrations.js) `restoreState(state)` 中补齐：
    ```js
    state.shrineSacrifices = Number.isFinite(state.shrineSacrifices) ? state.shrineSacrifices : 0;
    ```
* **与 `loreSeen` / `storyScenes` 的状态机关系**：
  1. **首次献祭（`shrineSacrifices === 1`）**：保持现有 `pendingLoreKey = "event:shrine"` 机制，受 `NORMAL_STORY_MIN_GAP_STEPS (20)` 约束；一旦播出，由 `tryPlayLore` 将 `"event:shrine"` 推入 `state.loreSeen`。
  2. **二次献祭（`shrineSacrifices === 2`）**：不弹窗打断，但在 `eventLog` 插入专属紫字预示日志：`"石龛上的香灰无风自动，你似乎认出了底座下压着的那枚铜钱。"`
  3. **三次献祭（`shrineSacrifices === 3`）**：当场完成支线闭环！在 `useShrine` 内 `finishEncounter()` 之后，若 `!this.game.state.storyScenes.includes("sidequest-shrine-3")`，直接调用：
     ```js
     this.game.story.tryPlayStory({
       id: "sidequest-shrine-3",
       kicker: "隐藏支线 · 土地龛的旧愿",
       text: SHRINE_SIDEQUEST_TEXT,
       buttonLabel: "握紧铜钱",
       markIds: ["sidequest-shrine-3"]
     }, { special: true });
     ```
     * **关键机制说明**：传入 `{ special: true }` 使其如同序章/结局一样豁免 `20` 步冷却间隔（但仍遵守 `totalSteps === lastStep` 同一步不连弹保护；若第 1 次 `event:shrine` 恰好在同一步刚弹出过，则将 `pendingLoreKey` 让位给 `"sidequest-shrine-3"`）。玩家点击「握紧铜钱」关闭弹窗时，`hideStory()` 会自动将 `"sidequest-shrine-3"` 写入 `state.storyScenes` 持久化，确保本局绝不重复触发，并奖励 `exitHintTurns = Math.max(state.exitHintTurns, 45)`。
* **支线完整文案（幻象破除、双线交汇）**：
  > 「第三次把染血的掌心按上石台时，无风自燃的烛火骤然熄灭，冷硬神像的裂纹在眼前褪成山腰小土地龛上熟悉的青苔。你摸到底座下压着的一枚磨亮铜钱——那是父亲临终那年塞进你手里的旧物。你终于完整记起今晨冒雨上山的缘由：连夜山洪冲垮了后山老堰，若不赶在天亮前撬开旧排水洞的分流木闸，山下那十几亩快要抽穗的稻田就会被泥石彻底吞没。」

---

### S3. 新增第三真结局与坠落结局变体叙事大纲
* **预计代码量级**：**小（~60 行，修改 [src/data/endings.js](src/data/endings.js) 与 [src/game.js](src/game.js) `endGame` 传参）**
* **触发架构**：将 `getEnding(reason, escaped)` 扩展为 `getEnding(reason, escaped, state)`，根据玩家局内探索深度（`state.shards?.length === 3` 或 `state.storyScenes.includes("sidequest-shrine-3")` 或 `state.loreSeen.length >= 12`）在原有二元结局之上分化出高完成度真结局与悲壮变体：

#### 1. 新增第三真结局：`ending-awakened`（梦醒 · 破妄 / 自己走出山谷）
* **触发条件**：`escaped === true` 且满足以下任一条件：① 集齐 3 块回响碎片（P4）；② 完成「祭坛的低语」3 次献祭支线（S2）；③ 单局解锁 `loreSeen.length >= 12`。
* **叙事大纲**：
  1. **主动识破幻境**：走到迷宫出口时，不等天光将暗红走廊震碎，玩家已在脑海中拼齐了全部记忆——眼前的“迷宫石门”正是后山旧排水洞的分流口，所谓的怪物与陷阱不过是高烧与剧痛编织的自保幻觉。
  2. **完成护田初心**：在村人垂下搜救绳之前，玩家忍着腿伤用随身短镰斩断缠死木闸的腐根，亲手推开分流石板，听见浑浊的山洪顺着泄洪道奔向远谷，保住了山下的稻田。
  3. **凭双脚走上归途**：玩家背起修补过三次的旧竹篓，顺着儿时熟记的排水洞缓坡自己走出谷口，在漫天雨雾渐渐散去的山腰处，迎面撞见举着火把、敲着铜盆奔来的妻子与乡亲。
* **核心关键句（2 句）**：
  > **关键句 1**：「这一次，不等天光将暗红走廊震碎，你已认出眼前正是后山旧排水洞的分流闸，并用那把磨薄的短镰亲手替山下的稻田引走了整场暴雨。」  
  > **关键句 2**：「你没有趴在谷底等待搜救绳垂落，而是背起旧竹篓迎着火把走上山道——当你彻底记起自己是谁，就没有哪座迷宫能再困住你的归途。」

#### 2. 坠落结局变体：`ending-fallen-beacon`（梦醒 · 路标 / 蓝布条的指引）
* **触发条件**：`escaped === false`（HP 归零），但局内已触发全部 3 段血量记忆（`memory-75`、`memory-50`、`memory-25`）或已完成 `sidequest-shrine-3`。
* **叙事大纲**：
  1. **昏迷前的清醒一击**：虽然在幻境中力竭倒下，但局内积累的记忆残片让玩家在现实昏厥加深前的最后一刻恢复了短暂清明。
  2. **系上求生路标**：玩家没有盲目乱爬，而是解下草药瓶口那截妻子缠上的蓝布条，吃力地系在排水沟上方最显眼的一根断枝上，随后才安心合上眼睛。
  3. **火塘边的苏醒**：搜山犬与村人正是循着那抹蓝布条在天黑前找到了谷底的你；再次睁眼时已是自家温暖的火塘边，窗外雨过天晴。
* **核心关键句（2 句）**：
  > **关键句 1**：「幻境里的力竭没有把你拖入长夜，反而让你在彻底昏沉前，把药瓶口那截妻子剪下的蓝布条系上了谷底最高的一根断枝。」  
  > **关键句 2**：「你在艾草烟气与熟悉的犬吠声中睁开眼，自家屋檐下的灯火正映着窗外初晴的夜空——哪怕在梦里倒下，那一念清醒终究替寻你的人点亮了路标。」

---

## 四、分阶段落地执行路线图（Implementation Roadmap）

为确保每次迭代均可独立通过 `npm test` 与 `npm run check`（小红书离线包四文件白名单校验），建议按以下三个阶段推进：

1. **阶段一：零存档迁移的体验速赢（S1 + S2 + S3 + P1，预计 0.5 天）**
   * 修复 `checkStoryProgress` 血量残片漏演与 `buildStoryCandidates` 拼接剧透；
   * 写入 5 类敌怪新变体、`EVENT_COPY` 4 类缺失文案、`sidequest-shrine-3` 支线与 `ending-awakened` 真结局；
   * 重构 `SaveStore` 排行榜为逃生效率优先，并在开始/结束界面暴露种子码与每日挑战。
2. **阶段二：中后期空间目标与数值张力重塑（P2 + P3 + P4，预计 1 天）**
   * 启用 `guardian` 镇守近端出口、远端出口隐藏默认箭头；
   * 实装祭坛真实扣血三阶契约与毒史莱姆叠加减疗；
   * 投放中场 3 块「回响碎片」并在缩略图提供回声指引。
3. **阶段三：战术走位与轻构筑重玩扩展（P5 + P6，预计 1–1.5 天）**
   * 实装幽灵强光减半/浓雾强化、骷髅朝向侧击与宝箱怪贴脸伏击；
   * 实装 6 种「山谷遗物」3 选 1 系统（单局上限 2 件），完成从线性逃生向高重玩性轻度 Roguelike 的演进。

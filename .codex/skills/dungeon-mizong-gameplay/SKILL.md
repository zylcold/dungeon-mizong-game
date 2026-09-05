# 地下城：迷踪 · 玩法规则技能

调整本游戏玩法、数值、事件/道具/战斗/剧情节奏，或排查玩法相关 bug 时使用本技能。

## 步骤

1. 读仓库根目录 `GAMEPLAY.md`（玩法规则唯一权威来源，按小节定位），再读 `src/config.js` 确认当前常量值。
2. 定位实现：规则计算在 `src/core/`（纯函数）与 `src/systems/`（业务流程），静态数据在 `src/data/`（catalog=敌人/道具/事件定义，stories=剧情文案）。
3. 修改前确认四处同步范围：`src/config.js` 常量 → `GAMEPLAY.md` 对应小节 → `tests/smoke.test.cjs` 断言 → README「已实现」清单。
4. 涉及随机概率的改动必须走 `eventRoll(key, salt)`，禁止 `Math.random()`（见 GAMEPLAY.md 第 12 节）。
5. 新增持久化字段时：`src/state/initial-state.js` 写初始值 + `src/state/migrations.js` 给旧档补默认值；剧情触发相关还需评估 `STORY_TRIGGER_VERSION`。
6. 验证：`npm ci && npm test` 全绿后才可提交；冒烟测试即玩法规格，断言失败先判断是实现错还是断言过时。
7. 分支约定：从 main 拉功能分支（`feature/` 或 `docs/` 前缀），PR 合并；不直接提交 main。

## 边界

- 不新增运行时依赖、框架、后端；目标 Chrome 61 / ES2017（见根 `AGENTS.md`）。
- H5 交付/兼容性任务先读 `.codex/skills/minitool-zip-builder/SKILL.md`。

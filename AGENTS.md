# 仓库维护指南

## 项目与入口

这是“地下城：迷踪”的源码仓库：移动端优先、离线运行的单层迷宫探索游戏。保持原生 HTML/CSS/Canvas 2D；源码按 ES Modules 拆分，构建为经典 IIFE。不要为普通修复新增框架、后端或运行时依赖。

- `public/index.html`、`src/styles.css`：界面结构、布局和安全区。
- `src/main.js`、`src/game.js`：启动、生命周期及系统组合。
- `src/core/`、`src/data/`：无 DOM 的规则计算与静态文案数据。
- `src/data/dev-diary.js`、`src/ui/dev-diary.js`：开发者日记数据与展示；每次发版在日记最前追加条目。
- `src/state/`：状态初始化、迁移和可注入存储适配。
- `src/systems/`：移动、视野、事件、背包、战斗和剧情业务流程。
- `src/rendering/`、`src/ui/`：地图渲染、输入、HUD、弹层；瞬态字段由对应模块持有。
- `scripts/`：构建、开发服务器、运行目录与 ZIP 校验、打包。
- `.github/workflows/release.yml`：CI 校验和 Release 附件发布。
- `assets/sprites-atlas.png`、`assets/sprites-atlas.json`：PNG 图集及索引；图标和素材说明也在 `assets/`。
- `tests/smoke.test.cjs`：针对构建产物的状态机与 DOM/Canvas 模拟回归。
- `tests/unit.test.mjs`、`tests/artifact.test.mjs`：纯规则、存档和打包边界测试。
- `.codex/skills/minitool-zip-builder/`：随仓库保存的小红书小工具技能 1.6.0。

## 小红书技能与运行约束

修改 H5 的兼容性、端能力或交付 ZIP 时，先完整阅读 [.codex/skills/minitool-zip-builder/SKILL.md](.codex/skills/minitool-zip-builder/SKILL.md)，再按其路由阅读本次任务对应的参考文档。

- 游戏运行时目标是 Chrome/WebView 61、ES2017；不能把 Node.js 测试可用的语法或 API 直接搬到浏览器产物。
- 所有运行资源使用包内相对路径。发布产物不允许外部 CDN、联网请求、模块脚本、内联脚本、行内事件或动态代码执行；源码静态 import 必须在构建时完全消除。
- 继续使用 PNG 图集与 Canvas/CSS，不新增 SVG 绘制或 SVG 素材。
- 保留原始技能与参考文档；确需调整技能时，应说明改动原因并单独检查其影响。
- 发布包与源码仓库分离，打包命令和工具要求见 [README.md](README.md)。

## 不应被普通修复改变的游戏约定

以下是当前规则，并非禁止用户以后调整；只在任务明确要求时改变。

- 单层 135×135 房间，从中心出发，最多三个出口；通路有环路，不退化为唯一路线。出口附近保持安全，离开即结算。
- 墙体轮廓固定存在，仅由迷雾遮挡；绘制房间和通道的统一外边界，避免共享边重复叠亮，清理孤立墙柱。
- 缩略图区分已探索通道与暗红墙影，出口仅指示正南、正北、正东或正西，不直接泄露精确方位。
- 普通视野为两格；视野道具持续 30 步，关闭主图迷雾并缩小到 50%，结束后恢复。
- 自动寻路只经过已探索的连通区域，遇到敌人、事件、剧情或结束状态时安全停止。
- 战斗预告必须与实际结算一致，包括本步毒伤、原地伏击、一击必杀和致命风险；优先复用现有 `getCombatOutcome`，不要维护两套公式。
- 首类怪物故事在击败后触发，道具故事在真正拾取后触发，不在看见怪物或使用初始道具时触发。
- 每次只随机展示一套候选故事，不显示“真实/幻觉”标签。普通剧情每 30 步最多一段，优先级为血量记忆 > 击杀 > 遭遇 > 拾取；关闭演出不能立即连弹。结局保持单段，不接着播放积压队列。
- 剧情队列、冷却起点和当前未读文本都要持久化；继续游戏不重抽未读文本，确认继续后才标记完成。
- 事件日志最多 200 条；达到上限后仍需刷新最新内容及未读提示，不要仅靠数组长度判断变化。
- 手机布局保留状态栏与宿主导航安全区；地图下方是可滚动事件时间流，不恢复已删除的底部方向操作区。

## 存档与改动范围

进度键为 `dungeon-mizong-save-v1`，个人纪录键为 `dungeon-mizong-records-v1`。修改状态结构前检查 `SAVE_VERSION`、`STORY_TRIGGER_VERSION` 及载入迁移逻辑，不要通过随意改键或清空全部 localStorage 规避兼容性问题。

游戏内版本号唯一来源是 `src/config.js` 的 `APP_VERSION`；发版时同步 package.json、`APP_VERSION` 与 `src/data/dev-diary.js` 首条，测试会校验一致。开发者日记已读进度存 `DIARY_KEY`（`dungeon-mizong-diary-v1`），与存档、纪录键互不影响。

围绕任务做最小修改，保留用户未提交的变更。不要仅因文件较长就重写游戏架构；新增玩法与故事规则需要对应需求。运行资源改动后同步测试、README 和版本记录；纯维护文档调整不需要提高游戏版本。

## 验证与交付

使用 Node.js 22+，先运行 `npm ci`，再运行 `npm test`。`npm run package` 会重新构建、运行全部测试并校验最终 ZIP。不要直接修改 dist 或 release；依赖变动同步锁文件。随机地图或事件相关修改可重复运行并保留失败信息，不能把偶现失败当作通过。

按改动范围补充行为回归，特别关注血量边界、剧情冷却/优先级、存档恢复和地图连通性。测试使用模拟 DOM/Canvas，不代表真机视觉、触摸、Chrome 61 兼容性或性能验收；未实测的项目应明确说明。

交付小红书 ZIP 时：

- 先按技能要求检查运行目录，再审计最终 ZIP；体积审计不等同于语义合规检查。
- `index.html` 必须直接位于 ZIP 根目录。当前运行包仅含 `index.html`、`styles.css`、`game.js`、`assets/sprites-atlas.png`。
- 不把测试、文档、技能、依赖、Git 元数据、用户存档、密钥或临时截图打进运行包。
- GitHub Download ZIP 是源码包，不能直接作为小红书运行包上传。
- Release 标签须等于 package.json 版本加 v 前缀；主分支和 PR 只生成 Artifact，发布 Release 才上传附件。核心战斗公式只维护在 `src/core/combat.js` 的 `calculateCombatOutcome` 中。
- 未经用户要求，不更改部署、仓库权限或发布工作流；提交时保留已有历史，不强制覆盖远端。

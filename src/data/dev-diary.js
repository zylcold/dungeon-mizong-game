/** 开发者日记数据；每次发版在最前面追加一条，并与 package.json、APP_VERSION 保持一致。 */

export const DIARY_ITEM_LABELS = {
  new: "新增",
  improve: "优化",
  fix: "修复"
};

export const DEV_DIARY = [
  {
    version: "1.14.0",
    date: "2026-09",
    title: "心神（恐惧值）系统",
    items: [
      { kind: "new", text: "新增心神值：上限 100，满值时移动不因心神扣血" },
      { kind: "new", text: "心神越低移动扣血越多（≤80/60/40/20 可叠加，最多 4 点/步）" },
      { kind: "improve", text: "交战消耗心神，恢复药剂与视野回满可恢复心神；血条旁可见心神细条" }
    ]
  },
  {
    version: "1.13.3",
    date: "2026-09",
    title: "分叉选择锁死",
    items: [
      { kind: "fix", text: "修复主线分叉选项反复弹出：选定后立即推进主线，本局不再重播" },
      { kind: "fix", text: "旧存档若已选过分叉但仍停在分叉节点，接入时自动跳到下一主线" }
    ]
  },
  {
    version: "1.13.2",
    date: "2026-09",
    title: "修复演出层无法点击",
    items: [
      { kind: "fix", text: "故事遮罩层不再拦截点击，继续与分叉按钮可正常点按" },
      { kind: "improve", text: "继续 / 分叉按钮热区至少 44px，按下有明确反馈" }
    ]
  },
  {
    version: "1.13.1",
    date: "2026-09",
    title: "演出降频与双栏去标签",
    items: [
      { kind: "improve", text: "任意两次演出（含主线）全局至少间隔 10 步，减少连续弹窗；开场与结局豁免" },
      { kind: "improve", text: "分叉选择后的回响仍可紧接，回响结束后下一主线再计间隔" },
      { kind: "improve", text: "双栏对照不再显示「幻觉 / 现实」标签，只靠暖红 / 冷青版式区分" },
      { kind: "improve", text: "分叉按钮文案去掉「幻觉」「现实」字样" }
    ]
  },
  {
    version: "1.13.0",
    date: "2026-09",
    title: "故事主线与演出专版",
    items: [
      { kind: "new", text: "新增可读主线「坠谷→幻境→苏醒」：章节卡、双栏幻/现实、分叉选择三种演出节奏" },
      { kind: "new", text: "新增两条可见分叉（信谁 / 留下什么），现实锚点可解锁额外选项；结局文案随路径变体" },
      { kind: "improve", text: "主线节点走 special 通道，不被普通 20 步冷却吞没；填充 lore 仍保持间隔节奏" },
      { kind: "improve", text: "存档增加 mainBeat、branchFlags、realityAnchors；旧档缺字段可安全接入，不编造历史分叉" },
      { kind: "improve", text: "玩法数值（迷宫/战斗/事件/道具）本版未改，专注故事与演出" }
    ]
  },
  {
    version: "1.12.0",
    date: "2026-09",
    title: "开发者日记与剧情节奏重做",
    items: [
      { kind: "new", text: "新增开发者日记：检测到游戏更新后，首次进入会自动展示本版更新内容" },
      { kind: "new", text: "开始界面新增“开发者日记”入口，可随时回看历次更新记录" },
      { kind: "improve", text: "日记阅读进度独立保存在浏览器中，不影响游戏存档与个人纪录" },
      { kind: "improve", text: "剧情演出改为即时触发：间隔不足时直接跳过，不再排队等待或延迟弹出" },
      { kind: "improve", text: "普通剧情两次演出至少间隔 20 步，开场后也留有 20 步呼吸期" },
      { kind: "improve", text: "击败怪物、结算事件的瞬间优先播放对应剧情，血量记忆不再抢占演出时机" },
      { kind: "fix", text: "修复剧情延迟补播与旧存档中排队残留的演出" }
    ]
  },
  {
    version: "1.11.0",
    date: "2026-09",
    title: "源码重构与自动发布",
    items: [
      { kind: "improve", text: "源码按模块拆分重构，游戏规则、剧情与存档完全保持不变" },
      { kind: "improve", text: "接入自动化构建、测试与发布流程，后续更新更可靠" },
      { kind: "fix", text: "修复发布包校验，Release 标签带或不带 v 前缀均可正常上传" }
    ]
  }
];

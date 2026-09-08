/** 1.13.0 主线节点文案与分叉；玩法数值无关。 */

export const MAINLINE_BEATS = {
  M0: {
    id: "M0",
    mode: "storyCard",
    kicker: "序章 · 坠谷",
    text: "湿根在脚下断裂的瞬间，世界翻成了暗红的走廊。你握着并不存在的剑，却闻得到竹篓里草药的苦味。",
    buttonLabel: "开始探索",
    nextBeat: "M1"
  },
  M1: {
    id: "M1",
    mode: "storyCard",
    kicker: "幻境成形",
    text: "墙缝会跟着你的心跳收紧。你开始分不清：是迷宫在长，还是记忆在塌。",
    buttonLabel: "继续",
    require: { minSteps: 20 },
    nextBeat: "M2"
  },
  M2: {
    id: "M2",
    mode: "dualPanel",
    kicker: "记忆渗入",
    illusion: "披甲的影子站在转角，用你的乳名下令——不许醒来。",
    reality: "那只是挂满雨珠的枯枝与稻草人。有人把草绳系在上面，等雾散。",
    buttonLabel: "继续",
    require: { minLore: 3 },
    nextBeat: "F1"
  },
  F1: {
    id: "F1",
    mode: "choiceBar",
    kicker: "分叉 · 信谁",
    text: "下一段路在发亮。一边是更深的钟声，一边是岩壁折回的犬吠。",
    choices: [
      { id: "illusion", label: "追钟声更深", echo: "你跟着钟声走。剑更沉，痛却更远。", nextBeat: "M3a" },
      { id: "reality", label: "循犬吠寻路", echo: "你循着犬吠摸石壁。泥腥味比铁锈更像回家。", nextBeat: "M3b" }
    ],
    flagKey: "F1"
  },
  M3a: {
    id: "M3a",
    mode: "storyCard",
    kicker: "深陷",
    text: "走廊开始复读你的脚步。你怀疑出口只通向更深处的自己。",
    buttonLabel: "继续",
    nextBeat: "F2"
  },
  M3b: {
    id: "M3b",
    mode: "storyCard",
    kicker: "寻声",
    text: "铜盆与犬吠又近了一寸。谷底有人在找你，只是路还不肯直。",
    buttonLabel: "继续",
    nextBeat: "F2"
  },
  F2: {
    id: "F2",
    mode: "choiceBar",
    kicker: "分叉 · 留下什么",
    text: "苏醒前，有样东西要先放下——或认领。",
    choices: [
      { id: "sword", label: "留下剑与名字", echo: "你把冒险者的名字埋进砖缝，空手去见天亮。", nextBeat: "M4", always: true },
      { id: "basket", label: "认领竹篓与伤", echo: "篓带勒进肩窝。痛是真的，路也是。", nextBeat: "M4", always: true },
      { id: "signal", label: "顺着搜山信号走", echo: "你朝折返的喊声举手。雾没有散，但方向有了。", nextBeat: "M4", requireAnchor: true }
    ],
    flagKey: "F2"
  },
  M4: {
    id: "M4",
    mode: "storyCard",
    kicker: "苏醒前夜",
    text: "两种梦叠在同一口气里。再往前一步，不是更深，就是醒来。",
    buttonLabel: "继续",
    nextBeat: "E"
  }
};

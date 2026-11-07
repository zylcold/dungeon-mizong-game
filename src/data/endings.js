/** 开场与结局文本，集中维护，不参与游戏规则计算。 */
export const OPENING_STORY = {
  illusion: "某天，你在迷宫深处醒来。你头疼欲裂，但什么都不记得。潮湿石壁向黑暗延伸，暗红墙线像凝固的血管；你只知道必须找到出口，否则连仅剩的自己也会被这里吞掉。",
  reality: "同一个清晨，一个农夫在山村尚未生火时出了门。他背着竹篓，带上镰刀、麻绳和一瓶草药水，要赶在雨前走到山那边。你看不清他的脸，却莫名记得篓带压在肩上的重量。"
};

function endingTail(branchFlags = {}) {
  const f1 = branchFlags && branchFlags.F1;
  const f2 = branchFlags && branchFlags.F2;
  const parts = [];
  if (f1 === "illusion") parts.push("你曾把钟声当成出口");
  else if (f1 === "reality") parts.push("你曾循着犬吠摸回石壁");
  if (f2 === "sword") parts.push("把冒险者的名字留在了砖缝里");
  else if (f2 === "basket") parts.push("肩上还留着竹篓带的勒痕");
  else if (f2 === "signal") parts.push("是搜山的喊声把你拽回方向");
  if (!parts.length) return "";
  return `这一路上，${parts.join("，")}。`;
}

export function getEnding(reason, escaped, state = {}) {
  // 兼容两种调用约定：完整游戏状态（含 shards/storyScenes/loreSeen/shrineSacrifices/branchFlags）
  // 或直接传 branchFlags 子对象（1.14.x 心神分流）。
  const flags = state && state.branchFlags ? state.branchFlags : state;
  const tail = endingTail(flags);
  const shardsCount = Array.isArray(state && state.shards) ? state.shards.length : 0;
  const scenes = Array.isArray(state && state.storyScenes) ? state.storyScenes : [];
  const loreCount = Array.isArray(state && state.loreSeen) ? state.loreSeen.length : 0;
  const hasShrineQuest = scenes.includes("sidequest-shrine-3") || (state && state.shrineSacrifices >= 3);
  const hasAllMemories = ["memory-75", "memory-50", "memory-25"].every((id) => scenes.includes(id));

  if (escaped && (shardsCount >= 3 || hasShrineQuest || loreCount >= 12)) {
    return {
      id: "ending-awakened",
      kicker: "梦醒 · 破妄",
      title: "你凭双脚走出了山谷",
      reveal: "你不仅在幻境中寻回全部记忆，更在搜救绳垂落前亲手推开排水洞分流闸；沿着熟悉的山道迎向家人，才是这条真实路线的终点。",
      text: `这一次，不等天光将暗红走廊震碎，你已认出眼前正是后山旧排水洞的分流闸，并用那把磨薄的短镰亲手替山下的稻田引走了整场暴雨。醒来时，你在谷底旧排水洞边握紧村人垂下的搜救绳与旧铜钱；记忆早已彻底归位——清晨你为疏通暴雨堵塞的引水沟独自上山，因踩断湿根而坠落。${tail}你没有趴在谷底等待救援，而是背起修补过三次的旧竹篓迎着火把走上山道，最终回到家里那盏始终为你亮着的灯前。当你记起自己是谁，就没有哪座迷宫能再困住你的归途。`,
      mode: "storyCard"
    };
  }

  if (escaped) {
    return {
      id: "ending-escaped",
      kicker: "梦醒 · 天光",
      title: "你在天光中醒来",
      reveal: "你走出的只是昏迷中的幻觉迷宫；醒来之后，沿搜救绳回到村庄，才是这条真实路线的终点。",
      text: `你越过最后一道暗红墙线，整座迷宫在天光中碎裂。醒来时，你正趴在谷底旧排水洞边，手中紧握着村人垂下的搜救绳；记忆也终于归位——清晨，你为查看暴雨堵塞的引水沟独自上山，因踩断湿根而坠落。${tail}你被拉出山谷，沿熟悉的村道走到那盏始终为你亮着的灯前。迷宫出口只是醒来，回到家才是真正的终点。`,
      mode: "storyCard"
    };
  }

  if (hasShrineQuest || hasAllMemories || shardsCount >= 2) {
    return {
      id: "ending-fallen-beacon",
      kicker: "梦醒 · 路标",
      title: "蓝布条为你引来归途",
      reveal: "幻觉中的力竭让你在彻底昏沉前系上求生路标；现实里的搜山人循着蓝布条将你带回村庄，才是这条真实路线的终点。",
      text: `${reason}。幻境里的力竭没有把你拖入长夜，反而让你在彻底昏沉前，把药瓶口那截妻子剪下的蓝布条系上了谷底最高的一根断枝。你在艾草烟气与熟悉的犬吠声中睁开眼，自家屋檐下的灯火正映着窗外初晴的夜空——梦中的倒下不是终点，而是现实归途的开始。`,
      mode: "storyCard"
    };
  }

  return {
    id: "ending-dead",
    kicker: "结局 · 沉没",
    title: "你倒在了幻境里",
    reveal: "这一次没有醒来。出口的风吹不到这里。",
    text: `${reason}。暗红走廊没有碎裂。你倒在自己的名字旁边，竹篓与搜山声都到不了这里。`,
    mode: "death"
  };
}

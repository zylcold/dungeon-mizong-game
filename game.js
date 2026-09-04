"use strict";

(() => {
  const STORAGE_KEY = "dungeon-mizong-save-v1";
  const RECORD_KEY = "dungeon-mizong-records-v1";
  const SAVE_VERSION = 4;
  const STORY_TRIGGER_VERSION = 3;
  const STORY_COOLDOWN_STEPS = 30;
  const STORY_PRIORITY = {
    item: 100,
    event: 200,
    enemy: 300,
    health: 400,
    intro: 1000
  };
  const MAZE_SIZE = 135;
  const ROOM_SPAN = 4;
  const ROOM_FLOOR_SIZE = 3;
  const MAX_LOGS = 200;
  const DEFAULT_VISION_RADIUS = 2;
  const FOG_VISION_RADIUS = 1;
  const VISION_DURATION = 30;
  const VISION_ZOOM_SCALE = 0.5;
  const AUTO_PATH_DELAY = 95;
  const WALL_RENDER_ALPHA = 0.9;
  const WALL_RENDER_MARGIN_ROOMS = 3;
  const ENEMY_DENSITY_MIN = 0.045;
  const ENEMY_DENSITY_MAX = 0.06;
  const ENEMY_CHEST_DROP_RATE = 0.28;
  const POISON_DAMAGE_PER_STEP = 2;
  const SLIME_POISON_DURATION = 3;
  const EXIT_SAFE_RADIUS = 2;
  const EXIT_SAFE_PATH_ROOMS = 4;
  const MOBILE_SAFE_TOP_FALLBACK = 96;

  const DIRECTIONS = {
    up: { dx: 0, dy: -1, bit: 1, opposite: 4 },
    right: { dx: 1, dy: 0, bit: 2, opposite: 8 },
    down: { dx: 0, dy: 1, bit: 4, opposite: 1 },
    left: { dx: -1, dy: 0, bit: 8, opposite: 2 }
  };

  const DIRECTION_LIST = Object.entries(DIRECTIONS);

  const ITEM_DEFS = {
    potion: { name: "恢复药剂", asset: "item-potion", icon: "✚" },
    vision: { name: "视野拓宽", asset: "item-vision", icon: "◉" },
    execute: { name: "一击必杀", asset: "item-execute", icon: "⚔" },
    teleport: { name: "瞬移卷轴", asset: "item-teleport", icon: "✦" }
  };

  const ENEMY_DEFS = {
    rat: {
      name: "地穴鼠",
      asset: "enemy-rat",
      icon: "♞",
      minHp: 6,
      maxHp: 12,
      scale: 1,
      description: "成群出没的弱小敌人，没有特殊能力。"
    },
    skeleton: {
      name: "骷髅守卫",
      asset: "enemy-skeleton",
      icon: "☠",
      minHp: 15,
      maxHp: 25,
      scale: 2,
      description: "沉默地守在通道中，以自身血量作为战斗消耗。"
    },
    slime: {
      name: "毒史莱姆",
      asset: "enemy-slime",
      icon: "●",
      minHp: 12,
      maxHp: 20,
      scale: 1.5,
      description: "击败后会使你中毒，接下来三步持续损失生命。"
    },
    ghost: {
      name: "游荡幽灵",
      asset: "enemy-ghost",
      icon: "◌",
      minHp: 18,
      maxHp: 28,
      scale: 2,
      description: "只有靠近到一格时才会显形。"
    },
    mimic: {
      name: "宝箱怪",
      asset: "enemy-mimic",
      icon: "▣",
      minHp: 22,
      maxHp: 35,
      scale: 2,
      description: "在你靠近前，它看起来和普通宝箱没有区别。"
    },
    guardian: {
      name: "出口守卫",
      asset: "enemy-guardian",
      icon: "♜",
      minHp: 35,
      maxHp: 55,
      scale: 3,
      description: "盘踞在出口附近的强敌，血量远高于普通怪物。"
    }
  };

  const EVENT_DEFS = {
    chest: { name: "封尘宝箱", asset: "chest", icon: "▣", category: "item" },
    fountain: { name: "生命泉", asset: "event-fountain", icon: "✚", category: "heal" },
    trap: { name: "地刺陷阱", asset: "event-trap", icon: "⌁", category: "damage" },
    map: { name: "地图残片", asset: "event-map", icon: "⌖", category: "vision" },
    shrine: { name: "古老祭坛", asset: "event-shrine", icon: "◇", category: "system" },
    corpse: { name: "冒险者遗骸", asset: "event-corpse", icon: "☠", category: "system" },
    fog: { name: "浓雾区域", asset: "enemy-ghost", icon: "≋", category: "vision" },
    portal: { name: "传送法阵", asset: "event-portal", icon: "✦", category: "vision" },
    door: { name: "神秘石门", asset: "event-door", icon: "▥", category: "system" },
    roots: { name: "盘根裂隙", asset: "event-trap", icon: "⌁", category: "damage" },
    echo: { name: "谷底回声", asset: "enemy-ghost", icon: "◌", category: "vision" },
    cache: { name: "遗落农具", asset: "event-corpse", icon: "◇", category: "item" }
  };

  const EVENT_COPY = {
    chest: [
      "箱盖上积着厚厚的灰尘。锁孔里卡着一根已经发黑的松针。",
      "暗红墙角躺着一只旧木箱，边缘留有被拖拽过的痕迹。",
      "一只半埋在碎石中的箱子挡住去路，里面传来轻微碰撞声。"
    ],
    fountain: [
      "冰凉泉水从石缝中流出，微弱蓝光让头痛稍稍退去。",
      "石盆里积着清水，水面映出的却像一小片灰白天空。",
      "你听见滴水声。岩缝下的浅泉带着泥土和草根气味。"
    ],
    shrine: [
      "祭坛要求生命作为交换。石碑上刻着：舍弃眼前，才能走得更远。",
      "烛火无风自燃，石台上的凹槽恰好能容下一只染血的手掌。",
      "残破石像注视着你，脚下铭文承诺用疼痛换取更强的身体。"
    ],
    corpse: [
      "倒下的冒险者仍攥着背包。搜索可能找到补给，也可能惊醒附近的怪物。",
      "一具被斗篷遮住的遗骸靠在墙边，背包搭扣仍然紧闭。",
      "散落的骨骸中压着一只布包，阴影里似乎还有东西在呼吸。"
    ],
    portal: [
      "法阵通向迷宫中的未知位置，落点安全，但无法预测方向。",
      "地面符号忽明忽暗，中心吹来不属于这里的潮湿山风。",
      "紫色微光沿石缝循环流动，像在等待下一名误入者。"
    ],
    door: [
      "石门背后传来微弱风声。推开它可能形成一条新的捷径。",
      "门缝里长出细小苔藓，后方也许连接着另一条回廊。",
      "这扇石门没有锁，只有一道需要用肩膀撞开的沉重缝隙。"
    ],
    roots: [
      "湿滑树根从裂隙里钻出，像绳索一样缠住前方石面。",
      "一片盘根横过通道，踩错位置就会滑向锋利碎石。",
      "泥水覆盖了凸起树根，你无法判断下面是否还有落脚处。"
    ],
    cache: [
      "角落里散着镰刀、麻绳和破竹片，看起来不像冒险者留下的装备。",
      "一捆被雨水泡烂的农具靠在墙边，其中也许还有能用的东西。",
      "碎裂竹篓压着一只旧布袋。看到它时，你的太阳穴突然抽痛。"
    ]
  };

  const ENEMY_COPY = {
    rat: ["爪声从墙根逼近。", "几双红眼在碎石后同时亮起。", "它嘴边还沾着没干的泥。"],
    skeleton: ["空洞眼眶朝向你的脚步声。", "锈剑刮过墙面，迸出暗红火星。", "它机械地封住了唯一通道。"],
    slime: ["酸味先于它从雾中飘来。", "黏液沿砖缝缓慢聚成人形。", "它经过的地面正在发黑。"],
    ghost: ["风声忽然有了人的轮廓。", "半透明身影与山雾重叠。", "它没有脚，却留下拖行的声音。"],
    mimic: ["箱盖突然裂开一排尖齿。", "你靠近时，锁孔像眼睛一样眨动。", "木箱底部伸出细长的爪。"]
  };

  const AMBIENT_COPY = [
    "远处传来碎石滚落声，很久之后才停下。",
    "你闻到潮湿松针的气味，却找不到风从哪里来。",
    "墙缝里夹着一小片竹篾，触碰时记忆一阵刺痛。",
    "头顶似乎有乌鸦飞过，回声却像怪物低吼。",
    "暗红石墙渗出水珠，像刚下过一场山雨。",
    "你听见模糊的人声呼喊，转过弯后只剩风声。",
    "脚下泥土印着草鞋纹路，其中一枚与你的鞋底完全相同。",
    "一束微光从高处落下，转瞬又被雾吞没。",
    "空气里有稻草和烟火味，这里本不该出现这些气息。",
    "你扶住墙壁，掌心传来的触感更像裸露山岩。",
    "通道深处响起木头断裂的脆响，你下意识停住了脚。",
    "一根麻绳垂在高处，等你看清时却只是扭曲藤蔓。",
    "雾中掠过熟悉的背影，肩上像背着一只竹篓。",
    "某处传来犬吠，近得像在寻找失踪的主人。"
  ];

  const STORY_SCENES = [
    {
      id: "memory-75",
      threshold: 0.75,
      title: "泥土",
      illusion: "伤口每跳一下，暗红砖缝就跟着收紧。你确信迷宫在吮吸闯入者的血，并把他们遗忘的名字砌进墙里；若停下来，下一块砖就会长出你的脸。",
      reality: "疼痛撕开一道短暂的清醒。掌心不是铁锈，而是湿泥，肩头也没有铠甲，只有一条被雨水泡粗的竹篓背带。你模糊想起，这双手每天握的是锄柄，而不是剑。"
    },
    {
      id: "memory-50",
      threshold: 0.5,
      title: "坠落",
      illusion: "迷宫忽然把前路折叠起来，你走过的拐角从背后再次出现。黑暗中有另一个自己踩着相同的脚步，耐心等你体力耗尽，好接过你的身体继续行走。",
      reality: "重复的脚步变成碎石滚动。天刚蒙亮，你背着竹篓沿引水沟上山，山雾把路压得很低；一截湿根在脚下骤然断裂，你伸手只扯下一把带血的苔藓。"
    },
    {
      id: "memory-25",
      threshold: 0.25,
      title: "山谷",
      illusion: "怪物的低吼汇成送葬的钟声，走廊像活物的喉咙一样起伏。你开始相信出口并不通往外面，而通往迷宫保存记忆的最深处。",
      reality: "钟声散去，只剩风穿过谷底岩缝与乌鸦盘旋的叫声。暗红墙壁也不再像砖石，更像被暮色染透的山岩。所谓地下城，或许只是剧痛替你搭起的一场长梦。"
    }
  ];

  const LORE_SCENES = {
    "enemy:rat": {
      title: "地穴鼠",
      illusion: "碎石后亮起成排红眼，尖爪抓挠着墙根。它们像迷宫派出的耳目，啃食每一条被遗忘的路线，也在等你倒下后把名字从骨头上剥走。",
      reality: "红眼缩回记忆里的田埂。你曾在天亮前惊起一窝偷粮的田鼠，竹篓侧袋因此破了口，炒米沿山路撒了一地；谷底的窸窣声，不过是它们循着气味追来。"
    },
    "enemy:skeleton": {
      title: "骷髅守卫",
      illusion: "披着锈甲的白骨抬起长剑，关节里落下陈年的尘土。它生前也曾寻找出口，如今却被迷宫收去血肉，只剩服从一道命令：不许任何人醒来。",
      reality: "锈甲褪成挂满雨珠的枯枝，白骨则是沟边折断的旧稻草人。你上山前曾把它扶正，还把自己的草绳系在木架上；昏沉的眼睛把摇晃枝影拼成了守卫。"
    },
    "enemy:slime": {
      title: "毒史莱姆",
      illusion: "黏液从砖缝渗出，带着腐蚀铁器的酸味。它没有心脏，受伤后却会把毒留在你的血里，仿佛整座迷宫都能借它的身体慢慢追杀你。",
      reality: "怪物的轮廓化成谷底湿苔和翻涌泥水。坠落时擦破的伤口沾满植物汁液，每走一步都火辣发胀；所谓毒素，是身体在提醒你伤势比想象中更重。"
    },
    "enemy:ghost": {
      title: "游荡幽灵",
      illusion: "苍白人影从雾里侧身而过，嘴唇没有动，你却听见它喊出一个陌生又熟悉的乳名。它像一段被抛弃的记忆，只在你靠近时索要身体。",
      reality: "白影原是高处树枝上被风扯动的布条，村里人搜山时把它系作路标。那个乳名不是幽灵的咒语，而是有人隔着山雾一遍遍喊你回家。"
    },
    "enemy:mimic": {
      title: "宝箱怪",
      illusion: "木箱在你俯身时裂开獠牙，贪婪地模仿一切能让旅人放松警惕的东西。迷宫知道你渴望补给，于是把希望也做成了一张嘴。",
      reality: "獠牙合拢成摔裂的竹篓边缘，一只受惊的獾从下面猛然钻出。你认得那片补过三次的竹篾——篓子属于你，只是头脑还不肯承认。"
    },
    "event:chest": {
      title: "封尘宝箱",
      illusion: "尘封木箱像一颗被遗弃的心脏，在墙角发出微弱碰撞声。你觉得里面装着前一位冒险者未能带走的命运，也可能装着迷宫故意留下的诱饵。",
      reality: "箱盖的纹路渐渐变成自家旧工具匣。出门前，你把磨石、干粮和一小卷麻布塞进匣中，再用竹篓背上山；谷底散落的东西被幻觉重新摆成了宝藏。"
    },
    "event:fountain": {
      title: "生命泉",
      illusion: "蓝光从石盆底部缓慢升起，水面映出一个没有伤口的你。传说生命泉会替人抹去痛苦，但也会收走一段记忆作为交换。",
      reality: "甘甜消失后，只剩冰凉而微涩的山泉。你曾沿水声爬进谷底的岩隙，用布角滤去泥沙；这条细流不是魔法，却可能是现实里维持清醒的唯一东西。"
    },
    "event:trap": {
      title: "地刺陷阱",
      illusion: "石板下弹出一排尖刺，像迷宫终于失去耐心。墙后传来齿轮转动声，仿佛有看不见的守门人记录着你的每次失足。",
      reality: "机关声变成碎石沿斜坡滚落的脆响。真正刺穿草鞋的是断枝与荆棘，你坠谷后慌乱爬行，膝盖和小腿早已留下许多自己没来得及察觉的伤口。"
    },
    "event:map": {
      title: "地图残片",
      illusion: "羊皮纸上的线条自行移动，出口符号总在你看清前滑向另一侧。它似乎不是在指路，而是在测量你还愿意相信多少希望。",
      reality: "游移墨线恢复成护林人刻在木牌上的炭痕：水沟、山脊、村道。上山多年的你本该熟悉这些记号，只是撞伤让方向和距离全被揉乱。"
    },
    "event:shrine": {
      title: "古老祭坛",
      illusion: "残破石像张开掌心，要求你用鲜血换取更强健的躯体。烛火映出的影子比你更早伸出手，像早已替你接受契约。",
      reality: "祭坛其实是山路旁供人歇脚的小土地龛，石沿被香火熏黑。你过去总把第一把新米放在那里，求的是风调雨顺，从未有人要求你献出生命。"
    },
    "event:corpse": {
      title: "冒险者遗骸",
      illusion: "斗篷下的骨骸仍死死抱住背包，空洞眼眶映出你伸手的动作。你忽然害怕，自己只是下一具被摆在这里、等待后来者搜刮的尸体。",
      reality: "骨骸缩小成山兽留下的白骨，斗篷是挂在灌木上的破蓑衣。那只布包倒是真的——搜山人常在岔路留下水和草药，也许有人已经知道你在附近。"
    },
    "event:fog": {
      title: "浓雾区域",
      illusion: "灰雾从每一道门后同时涌出，吞没脚印，也吞没你刚记住的墙角。你觉得它是一头没有形体的怪物，专门以方向感为食。",
      reality: "这场雾从清晨起就罩着山腰，水汽贴在睫毛上，让近处岩石也失去轮廓。你正是为了赶在雨前疏通水沟才独自上山，没想到熟路也会在雾里变成陷阱。"
    },
    "event:portal": {
      title: "传送法阵",
      illusion: "紫光沿石缝闭合成环，跨进去的瞬间，胃与影子被留在原地。迷宫把你抛向陌生走廊，像随手移动棋盘上一枚无关紧要的棋子。",
      reality: "紫光是撞伤后闭眼时炸开的斑点，传送则是断断续续的昏迷。你可能在失去记忆的间隙爬过很远，醒来时只记得位置变了，于是替那段空白编出法阵。"
    },
    "event:door": {
      title: "神秘石门",
      illusion: "石门没有锁孔，只在你把手贴上去时传来沉重心跳。门后吹来的风带着外界气味，却也可能是迷宫为你准备的另一层腹腔。",
      reality: "所谓石门，是泥石堵住的旧排水洞口。你用肩膀撞开松动石块，让山风重新穿过裂隙；儿时放牛时，你曾从这条窄洞抄近路回村。"
    },
    "event:roots": {
      title: "盘根裂隙",
      illusion: "湿根像沉睡的蛇群盘满裂口，一触碰就彼此收紧。你认定它们守着迷宫最古老的秘密，甚至听见木质深处传来缓慢呼吸。",
      reality: "根须的触感带回坠落前的一瞬：那截承受你全身重量的老根先弯曲，再发出干脆的断裂声。它不是守门怪物，只是雨后腐朽，而你再熟悉山路也没能看出来。"
    },
    "event:echo": {
      title: "谷底回声",
      illusion: "有人在看不见的走廊尽头模仿你的呼吸，偶尔用不同声音喊出同一个名字。你分不清那是出口的召唤，还是迷宫学会了说话。",
      reality: "回声里夹着铜盆敲击和犬吠，那是村人搜山时约定的信号。声音被岩壁折回许多次才落到这里，方向虽然模糊，却证明现实世界从未停止寻找你。"
    },
    "event:cache": {
      title: "遗落农具",
      illusion: "镰刀、麻绳与碎竹片被摆成奇怪的献祭图案，每件东西都像属于一位死去的冒险者。触碰它们时，迷宫深处传来一声满足的叹息。",
      reality: "镰刃上的缺口是你去年割稻时磕出来的，绳结也是你惯用的双套结。这里没有死去的冒险者，只有一个坠落后沿途遗失东西、努力活下来的农夫。"
    },
    "item:potion": {
      title: "恢复药剂",
      illusion: "红色药液像一小团被封住的火，入口后沿血管驱散寒意。你相信这是炼金术士留下的恩赐，能把任何濒死者重新缝合。",
      reality: "瓶中是妻子天未亮就煮好的草药水，塞口还缠着她剪下的蓝布。你嫌苦，却仍把它放进竹篓；熟悉的味道提醒你，山下有人等你回来吃晚饭。"
    },
    "item:vision": {
      title: "视野拓宽",
      illusion: "一枚幽蓝眼球在掌心睁开，四周墙壁骤然缩远，迷雾从它注视的地方退散。它借给你俯瞰迷宫的视线，也仿佛在反过来观察你的记忆。",
      reality: "冰冷圆面其实是黄铜罗盘，旁边还滚着一盏裂口油灯。你父亲教过你顺着水流与坡向辨路；短暂清醒让那些朴素方法重新压过混乱的幻象。"
    },
    "item:execute": {
      title: "一击必杀",
      illusion: "银白剑光从手中延伸，只需一次挥击，就能把怪物连同影子一并斩断。那股力量过于干净，像迷宫允许你暂时修改它的规则。",
      reality: "神剑恢复成一把磨得很薄的短镰。你用它割开缠住脚踝的藤蔓，也赶走逼近伤者的野兽；真正救命的不是神力，而是多年劳作留下的稳准。"
    },
    "item:teleport": {
      title: "瞬移卷轴",
      illusion: "卷轴碎成紫色火屑，空间像湿纸一样被撕开。下一次睁眼时，熟悉的路已不在身后，只有迷宫冷漠地替你保守移动的秘密。",
      reality: "你看到的是绑在枝头的搜山布条，并在半醒半昏中循着它爬行。撞伤偷走了中间那段时间，于是清醒后的你只好把无法记起的跋涉解释成瞬移。"
    }
  };

  const SPRITE_ATLAS = {
    url: "assets/sprites-atlas.png",
    columns: 5,
    rows: 4,
    frames: {
      player: [0, 0],
      chest: [1, 0],
      exit: [2, 0],
      "item-potion": [3, 0],
      "item-vision": [4, 0],
      "item-execute": [0, 1],
      "item-teleport": [1, 1],
      "enemy-rat": [2, 1],
      "enemy-skeleton": [3, 1],
      "enemy-slime": [4, 1],
      "enemy-ghost": [0, 2],
      "enemy-mimic": [1, 2],
      "enemy-guardian": [2, 2],
      "event-fountain": [3, 2],
      "event-trap": [4, 2],
      "event-map": [0, 3],
      "event-shrine": [1, 3],
      "event-portal": [2, 3],
      "event-corpse": [3, 3],
      "event-door": [4, 3]
    }
  };

  const dom = {
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

  class AssetStore {
    constructor(url, onUpdate) {
      this.image = new Image();
      this.image.onload = onUpdate;
      this.image.onerror = onUpdate;
      this.image.src = url;
    }

    get() {
      const image = this.image;
      return image && image.complete && image.naturalWidth > 0 ? image : null;
    }
  }

  function applyAtlasFrame(element, assetKey) {
    const frame = SPRITE_ATLAS.frames[assetKey] || SPRITE_ATLAS.frames["event-map"];
    const x = frame[0] * (100 / (SPRITE_ATLAS.columns - 1));
    const y = frame[1] * (100 / (SPRITE_ATLAS.rows - 1));
    element.dataset.sprite = assetKey;
    element.style.backgroundPosition = `${x}% ${y}%`;
  }

  function replaceChildrenCompat(element, children) {
    element.innerHTML = "";
    (children || []).forEach((child) => element.appendChild(child));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roomKey(x, y) {
    return `${x},${y}`;
  }

  function parseRoomKey(key) {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  }

  function indexFor(x, y) {
    return y * MAZE_SIZE + x;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < MAZE_SIZE && y < MAZE_SIZE;
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomSeed() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      return window.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function parsePixelValue(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function measureSafeAreaTop() {
    let injectedInset = 0;
    let environmentInset = 0;
    let viewportInset = 0;
    const root = document.documentElement;
    if (root && typeof window.getComputedStyle === "function") {
      const rootStyle = window.getComputedStyle(root);
      if (rootStyle && typeof rootStyle.getPropertyValue === "function") {
        injectedInset = parsePixelValue(rootStyle.getPropertyValue("--safe-area-inset-top"));
      }
    }
    if (document.body && typeof window.getComputedStyle === "function") {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);pointer-events:none";
      document.body.appendChild(probe);
      environmentInset = parsePixelValue(window.getComputedStyle(probe).paddingTop);
      if (probe.parentNode) probe.parentNode.removeChild(probe);
    }
    if (window.visualViewport && Number.isFinite(window.visualViewport.offsetTop)) {
      viewportInset = Math.max(0, window.visualViewport.offsetTop);
    }
    const coarsePointer = typeof window.matchMedia === "function"
      && window.matchMedia("(pointer: coarse)").matches;
    const compactWidth = Number.isFinite(window.innerWidth) && window.innerWidth <= 760;
    const mobileFallback = coarsePointer && compactWidth ? MOBILE_SAFE_TOP_FALLBACK : 0;
    return Math.max(injectedInset, environmentInset, viewportInset, mobileFallback);
  }

  function shuffled(items, rng) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function weightedPick(entries, rng) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let target = rng() * total;
    for (const entry of entries) {
      target -= entry.weight;
      if (target <= 0) return entry.value;
    }
    return entries[entries.length - 1].value;
  }

  function connectRooms(bits, x, y, direction) {
    const definition = DIRECTIONS[direction];
    const nx = x + definition.dx;
    const ny = y + definition.dy;
    if (!inBounds(nx, ny)) return false;
    bits[indexFor(x, y)] |= definition.bit;
    bits[indexFor(nx, ny)] |= definition.opposite;
    return true;
  }

  function getConnectedNeighbors(bits, x, y) {
    const mask = bits[indexFor(x, y)];
    const neighbors = [];
    for (const [name, direction] of DIRECTION_LIST) {
      if ((mask & direction.bit) !== 0) {
        neighbors.push({ name, x: x + direction.dx, y: y + direction.dy });
      }
    }
    return neighbors;
  }

  function shortestPath(bits, start, target) {
    const queue = [start];
    const parents = new Map([[roomKey(start.x, start.y), null]]);
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      if (current.x === target.x && current.y === target.y) break;
      for (const next of getConnectedNeighbors(bits, current.x, current.y)) {
        const key = roomKey(next.x, next.y);
        if (parents.has(key)) continue;
        parents.set(key, current);
        queue.push(next);
      }
    }
    const targetKey = roomKey(target.x, target.y);
    if (!parents.has(targetKey)) return [];
    const path = [];
    let current = target;
    while (current) {
      path.push(current);
      current = parents.get(roomKey(current.x, current.y));
    }
    return path.reverse();
  }

  function chooseEnemyType(rng) {
    const choices = [
      { value: "rat", weight: 7 },
      { value: "skeleton", weight: 7 },
      { value: "slime", weight: 5 },
      { value: "ghost", weight: 4 },
      { value: "mimic", weight: 3 }
    ];
    return weightedPick(choices, rng);
  }

  function createEnemy(type, rng) {
    const definition = ENEMY_DEFS[type];
    const base = definition.minHp + Math.floor(rng() * (definition.maxHp - definition.minHp + 1));
    return {
      kind: "enemy",
      type,
      hp: base,
      revealed: type !== "mimic"
    };
  }

  function generateMaze(seed) {
    const rng = mulberry32(seed);
    const bits = new Array(MAZE_SIZE * MAZE_SIZE).fill(0);
    const center = Math.floor(MAZE_SIZE / 2);
    const visited = new Set([roomKey(center, center)]);
    const active = [{ x: center, y: center }];
    const newestBias = 0.42 + rng() * 0.4;

    // Growing Tree：每张地图随机混合深度优先与随机前沿，减少固定长走廊形态。
    while (active.length) {
      const activeIndex = rng() < newestBias ? active.length - 1 : Math.floor(rng() * active.length);
      const current = active[activeIndex];
      const candidates = shuffled(DIRECTION_LIST, rng)
        .map(([name, direction]) => ({
          name,
          x: current.x + direction.dx,
          y: current.y + direction.dy
        }))
        .filter((candidate) => inBounds(candidate.x, candidate.y) && !visited.has(roomKey(candidate.x, candidate.y)));

      if (!candidates.length) {
        active.splice(activeIndex, 1);
        continue;
      }

      const next = candidates[0];
      connectRooms(bits, current.x, current.y, next.name);
      visited.add(roomKey(next.x, next.y));
      active.push({ x: next.x, y: next.y });
    }

    // 打开大量额外墙段形成环路；优先消除死胡同，不再保证唯一路线。
    const closedWalls = [];
    for (let y = 0; y < MAZE_SIZE; y += 1) {
      for (let x = 0; x < MAZE_SIZE; x += 1) {
        for (const name of ["right", "down"]) {
          const direction = DIRECTIONS[name];
          const nx = x + direction.dx;
          const ny = y + direction.dy;
          if (!inBounds(nx, ny) || (bits[indexFor(x, y)] & direction.bit) !== 0) continue;
          const deadEnd = getConnectedNeighbors(bits, x, y).length === 1
            || getConnectedNeighbors(bits, nx, ny).length === 1;
          closedWalls.push({ x, y, name, deadEnd });
        }
      }
    }
    const orderedWalls = [
      ...shuffled(closedWalls.filter((wall) => wall.deadEnd), rng),
      ...shuffled(closedWalls.filter((wall) => !wall.deadEnd), rng)
    ];
    const loopRate = 0.18 + rng() * 0.1;
    const loopTarget = Math.min(orderedWalls.length, Math.floor(MAZE_SIZE * MAZE_SIZE * loopRate));
    for (let i = 0; i < loopTarget; i += 1) {
      const wall = orderedWalls[i];
      connectRooms(bits, wall.x, wall.y, wall.name);
    }

    const perimeter = [];
    for (let i = 0; i < MAZE_SIZE; i += 1) {
      perimeter.push({ x: i, y: 0 }, { x: i, y: MAZE_SIZE - 1 });
      if (i > 0 && i < MAZE_SIZE - 1) {
        perimeter.push({ x: 0, y: i }, { x: MAZE_SIZE - 1, y: i });
      }
    }

    const exitCount = 1 + Math.floor(rng() * 3);
    const exits = [];
    for (const candidate of shuffled(perimeter, rng)) {
      const farEnoughFromCenter = Math.abs(candidate.x - center) + Math.abs(candidate.y - center) >= Math.floor(MAZE_SIZE * 0.72);
      const separated = exits.every((exit) => Math.abs(exit.x - candidate.x) + Math.abs(exit.y - candidate.y) >= Math.floor(MAZE_SIZE * 0.62));
      if (farEnoughFromCenter && separated) exits.push(candidate);
      if (exits.length === exitCount) break;
    }
    if (!exits.length) exits.push({ x: 0, y: 0 });

    const exitSafeRooms = new Set();
    exits.forEach((exit) => {
      for (let dy = -EXIT_SAFE_RADIUS; dy <= EXIT_SAFE_RADIUS; dy += 1) {
        for (let dx = -EXIT_SAFE_RADIUS; dx <= EXIT_SAFE_RADIUS; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > EXIT_SAFE_RADIUS) continue;
          const x = exit.x + dx;
          const y = exit.y + dy;
          if (inBounds(x, y)) exitSafeRooms.add(roomKey(x, y));
        }
      }
      const approachPath = shortestPath(bits, { x: center, y: center }, exit);
      approachPath.slice(-EXIT_SAFE_PATH_ROOMS).forEach((room) => {
        exitSafeRooms.add(roomKey(room.x, room.y));
      });
    });

    // 出口及最后一段接近路线保持为空，避免越过出口后仍出现怪物或宝箱。
    const occupied = new Set(exitSafeRooms);
    const entities = {};

    const available = shuffled(
      Array.from({ length: MAZE_SIZE * MAZE_SIZE }, (_, index) => ({
        x: index % MAZE_SIZE,
        y: Math.floor(index / MAZE_SIZE)
      })).filter((room) => {
        const distance = Math.abs(room.x - center) + Math.abs(room.y - center);
        return distance > 2 && !occupied.has(roomKey(room.x, room.y));
      }),
      rng
    );

    let cursor = 0;
    const takeRoom = () => available[cursor++];
    const enemyDensity = ENEMY_DENSITY_MIN + rng() * (ENEMY_DENSITY_MAX - ENEMY_DENSITY_MIN);
    const enemyCount = Math.floor(MAZE_SIZE * MAZE_SIZE * enemyDensity);
    for (let i = 0; i < enemyCount; i += 1) {
      const room = takeRoom();
      if (!room) break;
      const type = chooseEnemyType(rng);
      entities[roomKey(room.x, room.y)] = createEnemy(type, rng);
    }

    const eventWeights = [
      { value: "chest", weight: 7 },
      { value: "fountain", weight: 5 },
      { value: "trap", weight: 6 },
      { value: "map", weight: 4 },
      { value: "shrine", weight: 4 },
      { value: "corpse", weight: 5 },
      { value: "fog", weight: 4 },
      { value: "portal", weight: 3 },
      { value: "door", weight: 3 },
      { value: "roots", weight: 4 },
      { value: "echo", weight: 4 },
      { value: "cache", weight: 4 }
    ];
    const eventCount = Math.floor(MAZE_SIZE * MAZE_SIZE * 0.035);
    for (let i = 0; i < eventCount; i += 1) {
      const room = takeRoom();
      if (!room) break;
      entities[roomKey(room.x, room.y)] = {
        kind: "event",
        type: weightedPick(eventWeights, rng)
      };
    }

    const itemCount = Math.floor(MAZE_SIZE * MAZE_SIZE * 0.012);
    for (let i = 0; i < itemCount; i += 1) {
      const room = takeRoom();
      if (!room) break;
      const itemType = weightedPick([
        { value: "potion", weight: 4 },
        { value: "vision", weight: 3 },
        { value: "execute", weight: 2 },
        { value: "teleport", weight: 2 }
      ], rng);
      entities[roomKey(room.x, room.y)] = { kind: "pickup", itemType };
    }

    return {
      seed,
      bits,
      exits,
      entities,
      roomCount: MAZE_SIZE * MAZE_SIZE,
      loopCount: loopTarget
    };
  }

  function createInitialState() {
    const seed = randomSeed();
    const center = Math.floor(MAZE_SIZE / 2);
    const maze = generateMaze(seed);
    return {
      version: SAVE_VERSION,
      active: true,
      totalSteps: 0,
      hp: 100,
      maxHp: 100,
      inventory: { potion: 1, vision: 0, execute: 0, teleport: 0 },
      visionTurns: 0,
      fogTurns: 0,
      poisonTurns: 0,
      exitHintTurns: 0,
      player: { x: center, y: center },
      explored: [],
      path: [{ x: center, y: center, teleport: false }],
      maze,
      logs: [],
      dismissedKey: null,
      discoveredExits: [],
      storyScenes: [],
      loreSeen: [],
      storyTriggerVersion: STORY_TRIGGER_VERSION,
      lastStoryStep: -STORY_COOLDOWN_STEPS,
      pendingStories: [],
      currentStory: null,
      storySequence: 0,
      nextAmbientStep: 7 + Math.floor(mulberry32(seed ^ 0xa5a5a5a5)() * 7),
      stats: {
        enemies: 0,
        chests: 0,
        items: 0,
        events: 0,
        rooms: 1
      },
      startedAt: Date.now()
    };
  }

  class DungeonGame {
    constructor() {
      this.state = null;
      this.pending = null;
      this.assets = new AssetStore(SPRITE_ATLAS.url, () => this.render());
      this.ctx = dom.gameCanvas.getContext("2d");
      this.minimapCtx = dom.minimapCanvas.getContext("2d");
      this.fullMapCtx = dom.fullMapCanvas.getContext("2d");
      this.endMapCtx = dom.endMapCanvas.getContext("2d");
      this.visibleRooms = new Map();
      this.renderQueued = false;
      this.toastTimer = null;
      this.statusTimer = null;
      this.pointerStart = null;
      this.autoPath = [];
      this.autoPathTarget = null;
      this.autoPathTimer = null;
      this.fullMapTransform = null;
      this.storyOnClose = null;
      this.unreadEvents = 0;
      this.lastRenderedLogLength = -1;
      this.lastRenderedLogEntry = null;
      document.querySelectorAll("[data-sprite]").forEach((element) => {
        applyAtlasFrame(element, element.dataset.sprite);
      });
      this.bindEvents();
      this.prepareStartScreen();
      this.resize();
    }

    bindEvents() {
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 120));
      if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
        window.visualViewport.addEventListener("resize", () => this.resize());
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
        this.attemptMove(mapping[event.key]);
      });

      dom.gameCanvas.addEventListener("pointerdown", (event) => {
        this.cancelAutoPath();
        this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
        if (typeof dom.gameCanvas.setPointerCapture === "function") {
          dom.gameCanvas.setPointerCapture(event.pointerId);
        }
      });
      dom.gameCanvas.addEventListener("pointerup", (event) => {
        if (!this.pointerStart || this.pointerStart.id !== event.pointerId) return;
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        this.pointerStart = null;
        const magnitude = Math.hypot(dx, dy);
        if (magnitude < 18) {
          this.handleCanvasTap(event.clientX, event.clientY);
        } else {
          this.moveFromVector(dx, dy, 18);
        }
      });
      dom.gameCanvas.addEventListener("pointercancel", () => {
        this.pointerStart = null;
      });

      dom.itemButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.cancelAutoPath();
          this.useItem(button.dataset.item);
        });
      });

      dom.minimapButton.addEventListener("click", () => {
        this.cancelAutoPath();
        this.openMap(false);
      });
      dom.mapClose.addEventListener("click", () => {
        dom.mapOverlay.hidden = true;
      });
      dom.mapOverlay.addEventListener("click", (event) => {
        if (event.target === dom.mapOverlay) dom.mapOverlay.hidden = true;
      });
      dom.fullMapCanvas.addEventListener("click", (event) => this.handleFullMapTap(event));
      dom.encounterClose.addEventListener("click", () => this.dismissEncounter());
      dom.continueButton.addEventListener("click", () => this.continueGame());
      dom.newGameButton.addEventListener("click", () => this.startNewGame());
      dom.endRestartButton.addEventListener("click", () => this.startNewGame());
      dom.storyContinueButton.addEventListener("click", () => this.hideStory());
      dom.restartButton.addEventListener("click", () => {
        if (!this.state || window.confirm("确定结束当前探索并重新开始吗？")) this.startNewGame();
      });
      dom.eventLog.addEventListener("scroll", () => {
        const nearBottom = dom.eventLog.scrollHeight - dom.eventLog.scrollTop - dom.eventLog.clientHeight < 12;
        if (nearBottom) {
          this.unreadEvents = 0;
          dom.newEventBadge.hidden = true;
        }
      });
      dom.newEventBadge.addEventListener("click", () => {
        dom.eventLog.scrollTop = dom.eventLog.scrollHeight;
        this.unreadEvents = 0;
        dom.newEventBadge.hidden = true;
      });
    }

    moveFromVector(dx, dy, threshold) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      this.cancelAutoPath();
      if (Math.abs(dx) > Math.abs(dy)) {
        this.attemptMove(dx > 0 ? "right" : "left");
      } else {
        this.attemptMove(dy > 0 ? "down" : "up");
      }
    }

    pickCopy(items, key, salt) {
      if (!items || !items.length) return "";
      const index = Math.floor(this.eventRoll(key, salt) * items.length);
      return items[Math.min(items.length - 1, index)];
    }

    addOpeningAtmosphere() {
      const key = roomKey(this.state.player.x, this.state.player.y);
      const firstIndex = Math.floor(this.eventRoll(key, "opening-a") * AMBIENT_COPY.length);
      let secondIndex = Math.floor(this.eventRoll(key, "opening-b") * AMBIENT_COPY.length);
      if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % AMBIENT_COPY.length;
      this.addLog("system", "·", AMBIENT_COPY[firstIndex]);
      this.addLog("system", "·", AMBIENT_COPY[secondIndex]);
    }

    maybeAddAmbientLog() {
      if (!this.state || this.state.totalSteps < this.state.nextAmbientStep) return;
      const key = roomKey(this.state.player.x, this.state.player.y);
      const text = this.pickCopy(AMBIENT_COPY, key, `ambient-${this.state.totalSteps}`);
      this.addLog("system", "·", text);
      const gapRoll = this.eventRoll(key, `ambient-gap-${this.state.totalSteps}`);
      this.state.nextAmbientStep = this.state.totalSteps + 8 + Math.floor(gapRoll * 9);
    }

    handleCanvasTap(clientX, clientY) {
      if (!this.state || !this.state.active) return;
      const rect = dom.gameCanvas.getBoundingClientRect();
      const view = this.getMainViewMetrics(rect.width, rect.height);
      const worldX = (clientX - rect.left - view.camera.x) / view.tileSize;
      const worldY = (clientY - rect.top - view.camera.y) / view.tileSize;
      const target = {
        x: Math.round((worldX - 2.5) / ROOM_SPAN),
        y: Math.round((worldY - 2.5) / ROOM_SPAN)
      };
      this.startAutoPath(target);
    }

    handleFullMapTap(event) {
      if (!this.fullMapTransform || !this.state || !this.state.active) return;
      const rect = dom.fullMapCanvas.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      const target = {
        x: Math.round((pointX - this.fullMapTransform.offsetX) / this.fullMapTransform.scale),
        y: Math.round((pointY - this.fullMapTransform.offsetY) / this.fullMapTransform.scale)
      };
      if (!inBounds(target.x, target.y) || !this.state.explored.includes(roomKey(target.x, target.y))) {
        this.showToast("只能选择已经探索的格子");
        return;
      }
      dom.mapOverlay.hidden = true;
      this.startAutoPath(target);
    }

    findExploredPath(target) {
      if (!inBounds(target.x, target.y)) return [];
      const explored = new Set(this.state.explored);
      const targetKey = roomKey(target.x, target.y);
      if (!explored.has(targetKey)) return [];
      const start = { x: this.state.player.x, y: this.state.player.y };
      const queue = [start];
      const parents = new Map([[roomKey(start.x, start.y), null]]);
      let cursor = 0;
      while (cursor < queue.length) {
        const current = queue[cursor++];
        if (current.x === target.x && current.y === target.y) break;
        for (const next of getConnectedNeighbors(this.state.maze.bits, current.x, current.y)) {
          const nextKey = roomKey(next.x, next.y);
          if (!explored.has(nextKey) || parents.has(nextKey)) continue;
          parents.set(nextKey, current);
          queue.push({ x: next.x, y: next.y });
        }
      }
      if (!parents.has(targetKey)) return [];
      const path = [];
      let current = target;
      while (current) {
        path.push(current);
        current = parents.get(roomKey(current.x, current.y));
      }
      return path.reverse();
    }

    startAutoPath(target) {
      this.cancelAutoPath();
      if (!this.state || !this.state.active || this.pending || !inBounds(target.x, target.y)) return false;
      const targetKey = roomKey(target.x, target.y);
      if (!this.state.explored.includes(targetKey)) {
        this.showStatus("只能自动前往已经探索的区域");
        return false;
      }
      const path = this.findExploredPath(target);
      if (!path.length) {
        this.showStatus("已探索区域之间暂时没有通路");
        return false;
      }
      if (path.length === 1) {
        this.showStatus("你已经在这里");
        return true;
      }
      this.autoPath = path.slice(1);
      this.autoPathTarget = { x: target.x, y: target.y };
      this.showStatus(`自动寻路 · ${this.autoPath.length} 步`);
      this.render();
      this.scheduleAutoPathStep();
      return true;
    }

    scheduleAutoPathStep() {
      clearTimeout(this.autoPathTimer);
      this.autoPathTimer = setTimeout(() => this.runAutoPathStep(), AUTO_PATH_DELAY);
    }

    runAutoPathStep() {
      this.autoPathTimer = null;
      if (!this.autoPath.length || !this.state || !this.state.active || this.pending
        || !dom.storyOverlay.hidden || !dom.endOverlay.hidden || !dom.mapOverlay.hidden) {
        this.cancelAutoPath(Boolean(this.autoPath.length));
        return false;
      }
      const next = this.autoPath.shift();
      const dx = next.x - this.state.player.x;
      const dy = next.y - this.state.player.y;
      const direction = DIRECTION_LIST.find(([, value]) => value.dx === dx && value.dy === dy);
      if (!direction || !this.attemptMove(direction[0], { auto: true })) {
        this.cancelAutoPath(true);
        return false;
      }
      if (this.pending || !dom.storyOverlay.hidden || !this.state.active) {
        this.cancelAutoPath(true);
        return false;
      }
      if (this.autoPath.length) {
        this.scheduleAutoPathStep();
      } else {
        this.autoPathTarget = null;
        this.showStatus("已到达目标位置");
        this.render();
      }
      return true;
    }

    cancelAutoPath(showMessage = false) {
      const wasRunning = this.autoPath.length > 0;
      clearTimeout(this.autoPathTimer);
      this.autoPathTimer = null;
      this.autoPath = [];
      this.autoPathTarget = null;
      if (showMessage && wasRunning) this.showStatus("自动寻路已停止");
    }

    prepareStartScreen() {
      const saved = this.loadSavedState();
      const records = this.loadRecords();
      dom.continueButton.hidden = !saved;
      if (records.length) {
        const best = records[0];
        dom.bestRecord.textContent = `${best.steps} 步 · 探索 ${best.explored || 0} 格`;
      } else {
        dom.bestRecord.textContent = "尚无纪录";
      }
      dom.startOverlay.hidden = false;
      this.setControlsEnabled(false);
    }

    loadSavedState() {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (!value) return null;
        const parsed = JSON.parse(value);
        if (parsed.version !== SAVE_VERSION || !parsed.active || !parsed.maze) return null;
        return parsed;
      } catch (error) {
        console.warn("读取存档失败", error);
        return null;
      }
    }

    loadRecords() {
      try {
        const records = JSON.parse(localStorage.getItem(RECORD_KEY) || "[]");
        return Array.isArray(records)
          ? records.filter((record) => record && Number.isFinite(record.steps))
            .sort((a, b) => b.steps - a.steps || (b.explored || 0) - (a.explored || 0))
          : [];
      } catch (error) {
        return [];
      }
    }

    startNewGame() {
      this.cancelAutoPath();
      this.storyOnClose = null;
      dom.storyOverlay.hidden = true;
      this.state = createInitialState();
      this.pending = null;
      dom.startOverlay.hidden = true;
      dom.endOverlay.hidden = true;
      dom.mapOverlay.hidden = true;
      this.hideEncounter();
      this.addLog("system", "◆", "你在迷宫中心醒来");
      this.addLog("vision", "◉", `当前视野范围为 ${DEFAULT_VISION_RADIUS} 格`);
      this.addLog("system", "⌖", "寻找迷宫外围的出口");
      this.addOpeningAtmosphere();
      this.updateVisibility();
      this.updateUI(true);
      this.setControlsEnabled(true);
      this.save();
      this.render();
      this.showToast("滑动探索未知区域，点击已探索区域自动寻路");
      this.queueRandomStory("intro", "序章 · 醒来", {
        illusion: "某天，你在迷宫深处醒来。你头疼欲裂，但什么都不记得。潮湿石壁向黑暗延伸，暗红墙线像凝固的血管；你只知道必须找到出口，否则连仅剩的自己也会被这里吞掉。",
        reality: "同一个清晨，一个农夫在山村尚未生火时出了门。他背着竹篓，带上镰刀、麻绳和一瓶草药水，要赶在雨前走到山那边。你看不清他的脸，却莫名记得篓带压在肩上的重量。"
      }, "开始探索", STORY_PRIORITY.intro);
      this.tryShowPendingStory();
    }

    continueGame() {
      const saved = this.loadSavedState();
      if (!saved) {
        this.showToast("没有可继续的进度");
        this.startNewGame();
        return;
      }
      this.state = saved;
      this.state.storyScenes = Array.isArray(this.state.storyScenes) ? this.state.storyScenes : [];
      this.state.loreSeen = Array.isArray(this.state.loreSeen) ? this.state.loreSeen : [];
      if (this.state.storyTriggerVersion !== STORY_TRIGGER_VERSION) {
        if (!Number.isFinite(this.state.storyTriggerVersion) || this.state.storyTriggerVersion < 2) {
          this.state.loreSeen = this.state.loreSeen.filter((key) => !key.startsWith("enemy:") && !key.startsWith("item:"));
        }
        this.state.storyTriggerVersion = STORY_TRIGGER_VERSION;
      }
      this.state.lastStoryStep = Number.isFinite(this.state.lastStoryStep)
        ? this.state.lastStoryStep
        : -STORY_COOLDOWN_STEPS;
      this.state.pendingStories = Array.isArray(this.state.pendingStories) ? this.state.pendingStories : [];
      const currentStory = this.state.currentStory;
      this.state.currentStory = currentStory && typeof currentStory.id === "string"
        && typeof currentStory.kicker === "string" && typeof currentStory.text === "string"
        ? currentStory : null;
      this.state.storySequence = Number.isFinite(this.state.storySequence) ? this.state.storySequence : 0;
      this.storyOnClose = null;
      dom.storyOverlay.hidden = true;
      this.state.nextAmbientStep = Number.isFinite(this.state.nextAmbientStep)
        ? this.state.nextAmbientStep
        : this.state.totalSteps + 8;
      this.pending = null;
      dom.startOverlay.hidden = true;
      dom.endOverlay.hidden = true;
      this.hideEncounter();
      this.updateVisibility();
      this.updateUI(true);
      this.setControlsEnabled(true);
      this.save();
      this.render();
      this.showToast("已恢复上次探索");
    }

    save() {
      if (!this.state || !this.state.active) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (error) {
        console.warn("保存进度失败", error);
      }
    }

    resize() {
      this.updateSafeAreaInsets();
      this.resizeCanvas(dom.gameCanvas, this.ctx);
      this.resizeCanvas(dom.minimapCanvas, this.minimapCtx);
      this.render();
      requestAnimationFrame(() => {
        this.resizeCanvas(dom.gameCanvas, this.ctx);
        this.resizeCanvas(dom.minimapCanvas, this.minimapCtx);
        this.render();
      });
    }

    updateSafeAreaInsets() {
      const root = document.documentElement;
      if (!root || !root.style || typeof root.style.setProperty !== "function") return;
      root.style.setProperty("--app-safe-area-top", `${measureSafeAreaTop()}px`);
    }

    resizeCanvas(canvas, context) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setControlsEnabled(enabled) {
      dom.itemButtons.forEach((button) => {
        button.disabled = !enabled;
      });
    }

    getVisionRadius() {
      return this.getVisionConfig().radius;
    }

    getVisionRoomLimit() {
      return this.getVisionConfig().limit;
    }

    getVisionConfig() {
      if (!this.state) return { radius: DEFAULT_VISION_RADIUS, limit: Infinity, enhanced: false };
      if (this.state.visionTurns > 0) return { radius: Infinity, limit: Infinity, enhanced: true };
      if (this.state.fogTurns > 0) return { radius: FOG_VISION_RADIUS, limit: Infinity, enhanced: false };
      return { radius: DEFAULT_VISION_RADIUS, limit: Infinity, enhanced: false };
    }

    collectVisibleRooms(radius, limit = Infinity) {
      const start = this.state.player;
      const queue = [{ x: start.x, y: start.y, distance: 0 }];
      const visible = new Map([[roomKey(start.x, start.y), 0]]);
      let cursor = 0;
      while (cursor < queue.length && visible.size < limit) {
        const current = queue[cursor++];
        if (current.distance >= radius) continue;
        for (const next of getConnectedNeighbors(this.state.maze.bits, current.x, current.y)) {
          const key = roomKey(next.x, next.y);
          if (visible.has(key)) continue;
          const distance = current.distance + 1;
          visible.set(key, distance);
          queue.push({ x: next.x, y: next.y, distance });
          if (visible.size >= limit) break;
        }
      }
      return visible;
    }

    updateVisibility() {
      if (!this.state) return;
      const config = this.getVisionConfig();
      // 视野道具关闭主画面迷雾，但只把玩家身边两格写入永久探索记录。
      // 这样无需每一步遍历整张大型地图，也不会把临时视野写入缩略图。
      const visible = config.enhanced
        ? this.collectVisibleRooms(DEFAULT_VISION_RADIUS)
        : this.collectVisibleRooms(config.radius, config.limit);
      this.visibleRooms = visible;
      const explored = new Set(this.state.explored);
      visible.forEach((_, key) => explored.add(key));
      this.state.explored = [...explored];
      this.state.stats.rooms = Math.max(this.state.stats.rooms, explored.size);
    }

    attemptMove(directionName, options = {}) {
      if (!options.auto) this.cancelAutoPath();
      if (!this.state || !this.state.active || this.pending || !dom.startOverlay.hidden || !dom.storyOverlay.hidden || !dom.endOverlay.hidden || !dom.mapOverlay.hidden) return false;
      const direction = DIRECTIONS[directionName];
      if (!direction) return false;
      const currentMask = this.state.maze.bits[indexFor(this.state.player.x, this.state.player.y)];
      if ((currentMask & direction.bit) === 0) {
        this.showStatus("前方是墙壁");
        return false;
      }
      const target = {
        x: this.state.player.x + direction.dx,
        y: this.state.player.y + direction.dy
      };
      const key = roomKey(target.x, target.y);
      const entity = this.state.maze.entities[key];
      if (entity && entity.kind === "enemy") {
        if (entity.type === "mimic") entity.revealed = true;
        this.openEnemyEncounter(entity, target, key, false);
        this.render();
        return false;
      }
      return this.commitMove(target);
    }

    commitMove(target, options = {}) {
      if (!this.state || !this.state.active) return false;
      const previousKey = roomKey(this.state.player.x, this.state.player.y);
      const targetKey = roomKey(target.x, target.y);
      this.state.player = { x: target.x, y: target.y };
      this.state.totalSteps += 1;
      this.state.path.push({ x: target.x, y: target.y, teleport: Boolean(options.teleport) });
      if (targetKey !== previousKey) this.state.dismissedKey = null;
      this.tickEffects();
      if (!this.state.active) return false;
      this.updateVisibility();
      if (!options.skipTrigger) this.triggerCurrentRoom();
      this.maybeAddAmbientLog();
      this.updateUI();
      this.save();
      this.render();
      return true;
    }

    tickEffects() {
      const state = this.state;
      if (state.visionTurns > 0) {
        state.visionTurns -= 1;
        if (state.visionTurns === 0) {
          this.addLog("vision", "◉", `视野效果结束，地图恢复原始比例，迷雾重新笼罩四周`);
        }
      }
      if (state.fogTurns > 0) {
        state.fogTurns -= 1;
        if (state.fogTurns === 0) this.addLog("vision", "☀", "你走出了浓雾区域");
      }
      if (state.exitHintTurns > 0) state.exitHintTurns -= 1;
      if (state.poisonTurns > 0) {
        state.poisonTurns -= 1;
        state.hp = Math.max(0, state.hp - POISON_DAMAGE_PER_STEP);
        this.addLog("damage", "◆", `毒素发作，损失 ${POISON_DAMAGE_PER_STEP} 点生命${state.poisonTurns ? `（剩余 ${state.poisonTurns} 步）` : ""}`);
        if (state.hp <= 0) this.endGame("毒素耗尽了你的生命");
      }
    }

    triggerCurrentRoom() {
      if (!this.state || !this.state.active) return;
      const key = roomKey(this.state.player.x, this.state.player.y);
      const entity = this.state.maze.entities[key];
      if (entity && key !== this.state.dismissedKey) {
        if (entity.kind === "pickup") {
          this.collectPickup(entity, key);
          return;
        }
        if (entity.kind === "event") {
          this.resolveEvent(entity, key);
          return;
        }
      }
      if (this.isExit(this.state.player.x, this.state.player.y)) this.openExitEncounter();
    }

    isExit(x, y) {
      return this.state.maze.exits.some((exit) => exit.x === x && exit.y === y);
    }

    collectPickup(entity, key) {
      this.addItem(entity.itemType, 1);
      delete this.state.maze.entities[key];
      this.state.stats.items += 1;
      const item = ITEM_DEFS[entity.itemType];
      this.addLog("item", item.icon, `拾取「${item.name}」`);
      this.showToast(`获得 ${item.name}`);
      this.save();
    }

    resolveEvent(entity, key) {
      this.queueFirstLore(`event:${entity.type}`);
      const definition = EVENT_DEFS[entity.type];
      const eventDescription = this.pickCopy(EVENT_COPY[entity.type], key, `event-copy-${entity.type}`);
      if (!entity.seen) {
        entity.seen = true;
        this.state.stats.events += 1;
      }
      switch (entity.type) {
        case "chest":
          this.showEncounter({
            kicker: "随机事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: "打开宝箱不会消耗额外步数。",
            actions: [
              { label: "打开宝箱", onClick: () => this.openChest(key) },
              { label: "暂时离开", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "fountain":
          this.showEncounter({
            kicker: "随机事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: `饮用后恢复 25 点生命，当前为 ${this.state.hp} / ${this.state.maxHp}。`,
            actions: [
              { label: "饮用泉水", onClick: () => this.useFountain(key) },
              { label: "离开", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "trap": {
          const damage = 8 + Math.floor(this.eventRoll(key, "trap") * 8);
          this.state.hp = Math.max(1, this.state.hp - damage);
          delete this.state.maze.entities[key];
          this.addLog("damage", definition.icon, `触发地刺陷阱，损失 ${damage} 点生命`);
          this.showToast(`地刺陷阱：-${damage} HP`);
          break;
        }
        case "map":
          this.state.exitHintTurns = Math.max(this.state.exitHintTurns, 30);
          delete this.state.maze.entities[key];
          this.addLog("vision", definition.icon, "读懂地图残片，出口箭头强化 30 步");
          this.showToast("出口箭头已强化");
          break;
        case "shrine":
          this.showEncounter({
            kicker: "选择事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: this.state.hp > 12 ? "消耗 12 点生命，生命上限永久增加 15。" : "当前生命不足，无法献祭。",
            actions: [
              { label: "献祭生命", disabled: this.state.hp <= 12, onClick: () => this.useShrine(key) },
              { label: "拒绝", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "corpse":
          this.showEncounter({
            kicker: "风险事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: "约三分之二概率获得道具，其余情况会遭遇伏击。",
            actions: [
              { label: "搜索背包", onClick: () => this.searchCorpse(key) },
              { label: "保持警惕", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "fog":
          this.state.fogTurns = Math.max(this.state.fogTurns, 15);
          delete this.state.maze.entities[key];
          this.updateVisibility();
          this.addLog("vision", definition.icon, "浓雾笼罩四周，视野降为 1 格，持续 15 步");
          this.showToast("视野降为 1 格");
          break;
        case "portal":
          this.showEncounter({
            kicker: "选择事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: "传送会计为一步，并在路线图上以虚线标记。",
            actions: [
              { label: "踏入法阵", onClick: () => this.usePortal(key) },
              { label: "离开", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "door":
          this.showEncounter({
            kicker: "选择事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: "打开石门会连接一个原本不相通的相邻区域。",
            actions: [
              { label: "推开石门", onClick: () => this.openStoneDoor(key) },
              { label: "离开", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "roots":
          this.showEncounter({
            kicker: "地形事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: "强行穿过可能受伤，也可能在树根下发现被遮住的补给。",
            actions: [
              { label: "踩稳穿过", onClick: () => this.crossRoots(key) },
              { label: "暂时绕开", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        case "echo": {
          const echoes = [
            "回声里有人喊着你的名字，声音来自迷宫边缘。",
            "乌鸦叫声与村人的呼喊重叠了一瞬。",
            "风穿过高处岩缝，替你指出了一个大致方向。"
          ];
          const message = this.pickCopy(echoes, key, "echo-result");
          this.state.exitHintTurns = Math.max(this.state.exitHintTurns, 16);
          delete this.state.maze.entities[key];
          this.addLog("vision", definition.icon, `${definition.name}：${message}`);
          this.showToast("回声带来了出口线索");
          break;
        }
        case "cache":
          this.showEncounter({
            kicker: "记忆事件",
            title: definition.name,
            icon: definition.asset,
            description: eventDescription,
            outcome: "翻找不会消耗额外步数，但不一定能找到可用物品。",
            actions: [
              { label: "翻找布袋", onClick: () => this.searchFarmCache(key) },
              { label: "保持原样", onClick: () => this.leaveEvent(key) }
            ],
            closable: true,
            key
          });
          break;
        default:
          delete this.state.maze.entities[key];
      }
      this.updateUI();
      this.save();
      this.render();
    }

    eventRoll(key, salt) {
      const input = `${this.state.maze.seed}:${key}:${salt}`;
      return mulberry32(hashString(input))();
    }

    randomItemFor(key, salt = "item") {
      const roll = this.eventRoll(key, salt);
      if (roll < 0.38) return "potion";
      if (roll < 0.66) return "vision";
      if (roll < 0.83) return "execute";
      return "teleport";
    }

    openChest(key) {
      const roll = this.eventRoll(key, "chest");
      delete this.state.maze.entities[key];
      this.state.stats.chests += 1;
      if (roll < 0.76) {
        const itemType = this.randomItemFor(key, "chest-item");
        this.addItem(itemType, 1);
        this.state.stats.items += 1;
        this.addLog("item", "▣", `打开宝箱，获得「${ITEM_DEFS[itemType].name}」`);
        this.showToast(`宝箱：${ITEM_DEFS[itemType].name}`);
      } else if (roll < 0.94) {
        const heal = Math.min(20, this.state.maxHp - this.state.hp);
        this.state.hp += heal;
        this.addLog("heal", "✚", heal > 0 ? `宝箱中的补给恢复 ${heal} 点生命` : "宝箱中只有已经失效的补给");
        this.showToast(heal > 0 ? `恢复 ${heal} HP` : "补给已经失效");
      } else {
        this.addLog("system", "□", "打开宝箱，里面空空如也");
        this.showToast("这是一个空箱子");
      }
      this.finishEncounter();
    }

    crossRoots(key) {
      const roll = this.eventRoll(key, "roots-result");
      delete this.state.maze.entities[key];
      if (roll < 0.48) {
        const damage = 5 + Math.floor(this.eventRoll(key, "roots-damage") * 8);
        this.state.hp = Math.max(1, this.state.hp - damage);
        this.addLog("damage", "⌁", `脚下树根突然滑动，你撞上碎石，损失 ${damage} 点生命`);
        this.showToast(`盘根裂隙：-${damage} HP`);
      } else if (roll < 0.82) {
        const itemType = this.randomItemFor(key, "roots-item");
        this.addItem(itemType, 1);
        this.state.stats.items += 1;
        this.addLog("item", "⌁", `你在树根下面找到「${ITEM_DEFS[itemType].name}」`);
        this.showToast(`找到 ${ITEM_DEFS[itemType].name}`);
      } else {
        this.state.exitHintTurns = Math.max(this.state.exitHintTurns, 12);
        this.addLog("vision", "⌁", "树根朝着风来的方向生长，为你留下出口线索");
        this.showToast("获得出口方向线索");
      }
      this.finishEncounter();
    }

    searchFarmCache(key) {
      const roll = this.eventRoll(key, "farm-cache-result");
      delete this.state.maze.entities[key];
      if (roll < 0.56) {
        const itemType = this.randomItemFor(key, "farm-cache-item");
        this.addItem(itemType, 1);
        this.state.stats.items += 1;
        this.addLog("item", "◇", `旧布袋里还留着「${ITEM_DEFS[itemType].name}」`);
        this.showToast(`找到 ${ITEM_DEFS[itemType].name}`);
      } else if (roll < 0.82) {
        const healed = Math.min(14, this.state.maxHp - this.state.hp);
        this.state.hp += healed;
        this.addLog("heal", "◇", healed > 0 ? `干粮让你恢复 ${healed} 点生命` : "布袋里的干粮提醒你曾来过这里");
        this.showToast(healed > 0 ? `恢复 ${healed} HP` : "只找到少量干粮");
      } else {
        this.addLog("system", "◇", "布袋里只有一张写着农时的湿纸，你却认得上面的字迹");
        this.showToast("一段熟悉的字迹唤醒了记忆");
      }
      this.finishEncounter();
    }

    useFountain(key) {
      const healed = Math.min(25, this.state.maxHp - this.state.hp);
      this.state.hp += healed;
      delete this.state.maze.entities[key];
      this.addLog("heal", "✚", healed > 0 ? `饮用生命泉，恢复 ${healed} 点生命` : "生命泉让你精神一振，但生命已满");
      this.showToast(healed > 0 ? `恢复 ${healed} HP` : "生命值已满");
      this.finishEncounter();
    }

    useShrine(key) {
      if (this.state.hp <= 12) return;
      this.state.hp -= 12;
      this.state.maxHp += 15;
      this.state.hp += 15;
      delete this.state.maze.entities[key];
      this.addLog("system", "◇", "完成献祭，生命上限增加 15");
      this.showToast("生命上限 +15");
      this.finishEncounter();
    }

    searchCorpse(key) {
      const roll = this.eventRoll(key, "corpse");
      if (roll < 0.66) {
        const itemType = this.randomItemFor(key, "corpse-item");
        delete this.state.maze.entities[key];
        this.addItem(itemType, 1);
        this.state.stats.items += 1;
        this.addLog("item", "☠", `搜索遗骸，找到「${ITEM_DEFS[itemType].name}」`);
        this.showToast(`找到 ${ITEM_DEFS[itemType].name}`);
        this.finishEncounter();
        return;
      }
      const rng = mulberry32(hashString(`${this.state.maze.seed}:${key}:ambush`));
      const enemyType = roll > 0.9 ? "ghost" : "rat";
      const enemy = createEnemy(enemyType, rng);
      this.state.maze.entities[key] = enemy;
      this.hideEncounter();
      this.addLog("combat", "⚔", `${ENEMY_DEFS[enemyType].name}从阴影中发动伏击`);
      this.openEnemyEncounter(enemy, { x: this.state.player.x, y: this.state.player.y }, key, true);
    }

    usePortal(key) {
      delete this.state.maze.entities[key];
      this.finishEncounter(false);
      this.teleportPlayer("传送法阵");
    }

    openStoneDoor(key) {
      const { x, y } = this.state.player;
      const mask = this.state.maze.bits[indexFor(x, y)];
      const candidates = DIRECTION_LIST.filter(([, direction]) => {
        const nx = x + direction.dx;
        const ny = y + direction.dy;
        return inBounds(nx, ny) && (mask & direction.bit) === 0;
      });
      delete this.state.maze.entities[key];
      if (candidates.length) {
        const index = Math.floor(this.eventRoll(key, "door") * candidates.length);
        connectRooms(this.state.maze.bits, x, y, candidates[index][0]);
        this.state.maze.loopCount = (this.state.maze.loopCount || 0) + 1;
        this.addLog("system", "▥", "石门开启，一条新的捷径出现了");
        this.showToast("新捷径已打开");
      } else {
        this.state.exitHintTurns = Math.max(this.state.exitHintTurns, 20);
        this.addLog("vision", "⌖", "石门后没有通路，但墙上刻着出口线索");
        this.showToast("获得出口线索");
      }
      this.updateVisibility();
      this.finishEncounter();
    }

    leaveEvent(key) {
      this.state.dismissedKey = key;
      this.hideEncounter();
      this.pending = null;
      this.updateUI();
      this.save();
      this.render();
    }

    getCombatOutcome(enemy, surprise, useExecute = false) {
      const hpAfterCombat = Math.max(0, this.state.hp - (useExecute ? 0 : enemy.hp));
      const defeated = hpAfterCombat > 0;
      const poisonTurnsAfterCombat = defeated && !useExecute && enemy.type === "slime"
        ? Math.max(this.state.poisonTurns, SLIME_POISON_DURATION)
        : this.state.poisonTurns;
      // 普通迎战获胜后会进入目标房间并结算一步毒伤；原地伏击不额外走步。
      const advancesStep = defeated && !surprise;
      const poisonDamage = advancesStep && poisonTurnsAfterCombat > 0 ? POISON_DAMAGE_PER_STEP : 0;
      const hpAfterAction = Math.max(0, hpAfterCombat - poisonDamage);
      return {
        defeated,
        hpAfterCombat,
        poisonTurnsAfterCombat,
        poisonDamage,
        hpAfterAction,
        poisonTurnsAfterAction: Math.max(0, poisonTurnsAfterCombat - (advancesStep ? 1 : 0)),
        survives: defeated && hpAfterAction > 0
      };
    }

    openEnemyEncounter(enemy, target, key, surprise, logEncounter = true) {
      const definition = ENEMY_DEFS[enemy.type];
      this.pending = { type: "enemy", enemy, target, key, surprise };
      const combat = this.getCombatOutcome(enemy, surprise);
      const poisonText = combat.poisonTurnsAfterAction > 0 ? `；之后仍中毒 ${combat.poisonTurnsAfterAction} 步` : "";
      let outcome = "你的生命不足以击败它，直接战斗将结束本局";
      if (combat.defeated && !combat.survives) {
        outcome = `虽能击败敌人并剩余 ${combat.hpAfterCombat} HP，但进入房间时的 ${combat.poisonDamage} 点毒伤会立即结束本局。`;
      } else if (combat.survives) {
        outcome = `本次行动后预计剩余 ${combat.hpAfterAction} HP${combat.poisonDamage ? `（已计入本步 ${combat.poisonDamage} 点毒伤）` : ""}${poisonText}`;
      }
      const actions = [
        {
          label: combat.survives ? "迎战" : "仍然迎战",
          onClick: () => this.fightEnemy(false)
        }
      ];
      if (this.state.inventory.execute > 0) {
        const executeOutcome = this.getCombatOutcome(enemy, surprise, true);
        actions.push({
          label: executeOutcome.survives ? "使用一击必杀" : "一击必杀（毒伤致命）",
          onClick: () => this.fightEnemy(true)
        });
      } else if (!surprise) {
        actions.push({ label: "后退", onClick: () => this.dismissEncounter() });
      }
      this.showEncounter({
        kicker: surprise ? "遭遇伏击" : "发现敌人",
        title: `${definition.name} · ${enemy.hp} HP`,
        icon: definition.asset,
        description: `${definition.description} ${this.pickCopy(ENEMY_COPY[enemy.type], key, `enemy-copy-${enemy.type}`)}`,
        outcome,
        actions,
        closable: !surprise,
        key
      });
      if (logEncounter) this.addLog("combat", definition.icon, `发现${definition.name}，血量 ${enemy.hp}`);
      this.save();
    }

    fightEnemy(useExecute) {
      if (!this.pending || this.pending.type !== "enemy") return;
      const { enemy, target, key, surprise } = this.pending;
      const definition = ENEMY_DEFS[enemy.type];
      const combat = this.getCombatOutcome(enemy, surprise, useExecute);
      if (useExecute) {
        if (this.state.inventory.execute <= 0) return;
        this.state.inventory.execute -= 1;
        const droppedChest = this.placeEnemyChestDrop(enemy, key);
        this.state.stats.enemies += 1;
        this.addLog("combat", "⚔", `一击消灭${definition.name}，生命未受损${droppedChest ? "，并发现掉落宝箱" : ""}`);
        this.hideEncounter();
        this.pending = null;
        this.finishEnemyVictory(enemy, target, surprise, droppedChest, droppedChest ? "一击必杀 · 掉落宝箱" : "一击必杀");
        return;
      }

      if (!combat.defeated) {
        this.state.hp = 0;
        this.addLog("damage", "☠", `${definition.name}终结了本次探索`);
        this.hideEncounter();
        this.pending = null;
        this.updateUI();
        this.render();
        this.endGame(`你没能击败${definition.name}`);
        return;
      }

      this.state.hp = combat.hpAfterCombat;
      const droppedChest = this.placeEnemyChestDrop(enemy, key);
      this.state.stats.enemies += 1;
      this.state.poisonTurns = combat.poisonTurnsAfterCombat;
      this.addLog("combat", definition.icon, `击败${definition.name}，剩余 ${this.state.hp} HP${droppedChest ? "，并发现掉落宝箱" : ""}`);
      this.hideEncounter();
      this.pending = null;
      this.finishEnemyVictory(
        enemy,
        target,
        surprise,
        droppedChest,
        droppedChest ? `击败 ${definition.name} · 掉落宝箱` : `击败 ${definition.name}`
      );
    }

    finishEnemyVictory(enemy, target, surprise, droppedChest, toastText) {
      this.queueFirstLore(`enemy:${enemy.type}`);
      if (!surprise) this.commitMove(target, { skipTrigger: !droppedChest });
      else if (droppedChest) {
        this.finishEncounter(false);
        this.triggerCurrentRoom();
      } else this.finishEncounter();
      this.showToast(toastText);
    }

    placeEnemyChestDrop(enemy, key) {
      const dropped = this.eventRoll(key, `enemy-chest-${enemy.type}`) < ENEMY_CHEST_DROP_RATE;
      if (dropped) {
        this.state.maze.entities[key] = { kind: "event", type: "chest", dropped: true };
        return true;
      }
      delete this.state.maze.entities[key];
      return false;
    }

    dismissEncounter() {
      if (!this.pending) {
        this.hideEncounter();
        return;
      }
      if (this.pending.surprise) return;
      if (this.pending.type === "event") this.state.dismissedKey = this.pending.key;
      this.pending = null;
      this.hideEncounter();
      this.save();
      this.render();
    }

    finishEncounter(save = true) {
      this.pending = null;
      this.hideEncounter();
      this.updateVisibility();
      this.updateUI();
      if (save) this.save();
      this.render();
    }

    openExitEncounter() {
      const exitNumber = this.state.maze.exits.findIndex((exit) => exit.x === this.state.player.x && exit.y === this.state.player.y) + 1;
      const currentExitKey = roomKey(this.state.player.x, this.state.player.y);
      this.state.discoveredExits = this.state.discoveredExits || [];
      this.showEncounter({
        kicker: "发现出口",
        title: `迷宫出口 ${exitNumber}`,
        icon: "exit",
        description: `这是迷宫的第 ${exitNumber} 个出口。选择离开会结束本局，也可以继续探索其他出口。`,
        outcome: "离开后将展示整张大型迷宫和你的完整路线。",
        actions: [
          { label: "离开迷宫", onClick: () => this.endGame("你走出了迷宫", true) },
          { label: "继续探索", onClick: () => this.leaveEvent(roomKey(this.state.player.x, this.state.player.y)) }
        ],
        closable: true,
        key: currentExitKey
      });
      if (!this.state.discoveredExits.includes(currentExitKey)) {
        this.state.discoveredExits.push(currentExitKey);
        this.addLog("system", "▣", `发现迷宫出口 ${exitNumber}`);
        this.updateUI();
      }
    }

    useItem(itemType) {
      if (!this.state || !this.state.active) return;
      const count = this.state.inventory[itemType] || 0;
      if (count <= 0) {
        this.showToast(`尚未获得${ITEM_DEFS[itemType].name}`);
        return;
      }
      if (itemType === "execute" && (!this.pending || this.pending.type !== "enemy")) {
        this.showToast("一击必杀只能在遇敌时使用");
        return;
      }
      if (itemType === "potion") {
        if (this.state.hp >= this.state.maxHp) {
          this.showToast("生命值已满");
          return;
        }
      }
      if (itemType === "execute") {
        this.fightEnemy(true);
        return;
      }
      if (itemType === "potion") {
        this.state.inventory.potion -= 1;
        const healed = Math.min(30, this.state.maxHp - this.state.hp);
        this.state.hp += healed;
        this.addLog("heal", "✚", `使用恢复药剂，恢复 ${healed} 点生命`);
        this.showToast(`恢复 ${healed} HP`);
      } else if (itemType === "vision") {
        this.state.inventory.vision -= 1;
        this.state.visionTurns = clamp(this.state.visionTurns + VISION_DURATION, VISION_DURATION, VISION_DURATION * 2);
        this.state.fogTurns = 0;
        this.updateVisibility();
        this.addLog("vision", "◉", `迷雾暂时关闭，主地图缩小 50%，持续 ${this.state.visionTurns} 步`);
        this.showToast("迷雾关闭 · 地图缩小 50%");
      } else if (itemType === "teleport") {
        this.state.inventory.teleport -= 1;
        this.teleportPlayer("瞬移卷轴");
        return;
      }
      this.updateUI();
      this.save();
      this.render();
      if (this.pending && this.pending.type === "enemy") {
        const pending = this.pending;
        this.openEnemyEncounter(pending.enemy, pending.target, pending.key, pending.surprise, false);
      }
    }

    teleportPlayer(source) {
      const candidates = [];
      for (let y = 0; y < MAZE_SIZE; y += 1) {
        for (let x = 0; x < MAZE_SIZE; x += 1) {
          const key = roomKey(x, y);
          const distance = Math.abs(x - this.state.player.x) + Math.abs(y - this.state.player.y);
          const entity = this.state.maze.entities[key];
          if (distance < 6 || this.isExit(x, y) || entity) continue;
          candidates.push({ x, y });
        }
      }
      if (!candidates.length) {
        this.state.inventory.teleport += source === "瞬移卷轴" ? 1 : 0;
        this.showToast("没有找到安全的瞬移位置");
        return;
      }
      const seed = hashString(`${this.state.maze.seed}:${this.state.totalSteps}:${source}`);
      const rng = mulberry32(seed);
      const target = candidates[Math.floor(rng() * candidates.length)];
      this.pending = null;
      this.hideEncounter();
      this.addLog("vision", "✦", `${source}将你送到迷宫中的安全位置`);
      this.commitMove(target, { teleport: true });
      this.showToast("瞬移完成");
    }

    addItem(itemType, amount) {
      this.state.inventory[itemType] = (this.state.inventory[itemType] || 0) + amount;
      this.queueFirstLore(`item:${itemType}`);
    }

    showEncounter({ kicker, title, icon, description, outcome, actions, closable, key }) {
      this.cancelAutoPath();
      this.pending = this.pending || { type: "event", key, surprise: false };
      if (this.pending.type !== "enemy") this.pending = { type: "event", key, surprise: false };
      dom.encounterKicker.textContent = kicker;
      dom.encounterTitle.textContent = title;
      dom.encounterDescription.textContent = description;
      dom.encounterOutcome.textContent = outcome || "";
      applyAtlasFrame(dom.encounterIcon, icon);
      dom.encounterClose.hidden = !closable;
      replaceChildrenCompat(dom.encounterActions);
      actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.label;
        button.disabled = Boolean(action.disabled);
        button.addEventListener("click", action.onClick, { once: true });
        dom.encounterActions.appendChild(button);
      });
      dom.encounterCard.hidden = false;
    }

    hideEncounter() {
      dom.encounterCard.hidden = true;
      replaceChildrenCompat(dom.encounterActions);
    }

    addLog(category, icon, text) {
      if (!this.state) return;
      this.state.logs.push({ category, icon, text, step: this.state.totalSteps });
      if (this.state.logs.length > MAX_LOGS) this.state.logs.splice(0, this.state.logs.length - MAX_LOGS);
      this.updateLog();
    }

    updateLog(forceBottom = false) {
      if (!this.state) return;
      const latestEntry = this.state.logs[this.state.logs.length - 1] || null;
      // 达到 200 条上限后长度不变，但新日志对象仍会变化，不能只比较数组长度。
      if (!forceBottom && this.lastRenderedLogLength === this.state.logs.length
        && this.lastRenderedLogEntry === latestEntry) return;
      const nearBottom = dom.eventLog.scrollHeight - dom.eventLog.scrollTop - dom.eventLog.clientHeight < 14;
      replaceChildrenCompat(dom.eventLog);
      this.state.logs.forEach((entry) => {
        const row = document.createElement("div");
        row.className = `event-entry ${entry.category}`;
        row.title = `第 ${entry.step} 步`;
        const icon = document.createElement("span");
        icon.className = "event-icon";
        icon.textContent = entry.icon;
        const step = document.createElement("span");
        step.className = "event-step";
        step.textContent = `第${entry.step}步`;
        const copy = document.createElement("span");
        copy.textContent = entry.text;
        row.appendChild(icon);
        row.appendChild(step);
        row.appendChild(copy);
        dom.eventLog.appendChild(row);
      });
      this.lastRenderedLogLength = this.state.logs.length;
      this.lastRenderedLogEntry = latestEntry;
      requestAnimationFrame(() => {
        if (nearBottom || forceBottom) {
          dom.eventLog.scrollTop = dom.eventLog.scrollHeight;
          this.unreadEvents = 0;
          dom.newEventBadge.hidden = true;
        } else {
          this.unreadEvents += 1;
          dom.newEventBadge.textContent = `${this.unreadEvents} 条新事件`;
          dom.newEventBadge.hidden = false;
        }
      });
    }

    updateUI(forceLog = false) {
      if (!this.state) return;
      dom.floorValue.textContent = `${this.state.discoveredExits ? this.state.discoveredExits.length : 0}/${this.state.maze.exits.length}`;
      dom.stepsValue.textContent = this.state.totalSteps;
      dom.healthText.textContent = `${this.state.hp} / ${this.state.maxHp}`;
      const healthPercent = clamp((this.state.hp / this.state.maxHp) * 100, 0, 100);
      dom.healthFill.style.width = `${healthPercent}%`;
      dom.healthFill.style.background = healthPercent <= 28
        ? "linear-gradient(90deg, #71111f, #e03846)"
        : "linear-gradient(90deg, #9f1e2d, #f05252)";
      dom.healthTrack.setAttribute("aria-valuemax", String(this.state.maxHp));
      dom.healthTrack.setAttribute("aria-valuenow", String(this.state.hp));

      Object.keys(ITEM_DEFS).forEach((itemType) => {
        const count = this.state.inventory[itemType] || 0;
        dom.counts[itemType].textContent = count;
        const button = dom.itemButtons.find((candidate) => candidate.dataset.item === itemType);
        button.classList.toggle("empty", count <= 0);
      });
      dom.timerVision.hidden = this.state.visionTurns <= 0;
      dom.timerVision.textContent = `${this.state.visionTurns}步`;

      const statuses = [];
      if (this.autoPath.length > 0) statuses.push(`自动寻路 · 剩余 ${this.autoPath.length} 步`);
      if (this.state.visionTurns > 0) statuses.push(`迷雾关闭 · 50% · ${this.state.visionTurns}步`);
      else if (this.state.fogTurns > 0) statuses.push(`浓雾 · ${this.state.fogTurns}步`);
      if (this.state.poisonTurns > 0) statuses.push(`中毒 · ${this.state.poisonTurns}步`);
      if (this.state.exitHintTurns > 0) statuses.push(`出口指引 · ${this.state.exitHintTurns}步`);
      dom.statusChip.textContent = statuses.join("　");
      dom.statusChip.classList.toggle("visible", statuses.length > 0);

      if (forceLog) this.lastRenderedLogLength = -1;
      this.updateLog(forceLog);
      this.checkStoryProgress();
      this.tryShowPendingStory();
    }

    checkStoryProgress() {
      if (!this.state || !this.state.active || this.state.hp <= 0 || this.state.currentStory || !dom.storyOverlay.hidden) return;
      this.state.storyScenes = Array.isArray(this.state.storyScenes) ? this.state.storyScenes : [];
      const healthRatio = this.state.hp / Math.max(1, this.state.maxHp);
      const eligible = STORY_SCENES.filter((scene) => (
        healthRatio <= scene.threshold && !this.state.storyScenes.includes(scene.id)
      ));
      if (!eligible.length) return;
      const scene = eligible[eligible.length - 1];
      eligible.forEach((item) => {
        if (!this.state.storyScenes.includes(item.id)) this.state.storyScenes.push(item.id);
      });
      this.queueRandomStory(scene.id, `记忆残片 · ${scene.title}`, scene, "继续前行", STORY_PRIORITY.health);
      this.save();
    }

    pickStoryVariant(sceneKey, story) {
      const playerKey = roomKey(this.state.player.x, this.state.player.y);
      return this.eventRoll(playerKey, `story-variant-${sceneKey}`) < 0.5
        ? { key: "illusion", text: story.illusion }
        : { key: "reality", text: story.reality };
    }

    queueRandomStory(sceneKey, kicker, story, buttonLabel = "继续", priority = STORY_PRIORITY.event) {
      const variant = this.pickStoryVariant(sceneKey, story);
      this.scheduleStory({
        id: `${sceneKey}-${variant.key}`,
        kicker,
        text: variant.text,
        buttonLabel
      }, priority);
    }

    queueFirstLore(loreKey) {
      if (!this.state || !this.state.active) return false;
      const lore = LORE_SCENES[loreKey];
      if (!lore) return false;
      this.state.loreSeen = Array.isArray(this.state.loreSeen) ? this.state.loreSeen : [];
      if (this.state.loreSeen.includes(loreKey)) return false;
      this.state.loreSeen.push(loreKey);
      const sceneId = loreKey.replace(":", "-");
      const category = loreKey.split(":")[0];
      this.queueRandomStory(
        `lore-${sceneId}`,
        `残缺片段 · ${lore.title}`,
        lore,
        "继续",
        STORY_PRIORITY[category] || STORY_PRIORITY.item
      );
      this.save();
      return true;
    }

    scheduleStory(scene, priority) {
      if (!this.state || !this.state.active) return false;
      this.state.pendingStories = Array.isArray(this.state.pendingStories) ? this.state.pendingStories : [];
      if (this.state.pendingStories.some((entry) => entry.scene.id === scene.id)) return false;
      this.state.storySequence = Number.isFinite(this.state.storySequence) ? this.state.storySequence : 0;
      this.state.pendingStories.push({
        scene,
        priority,
        triggerStep: this.state.totalSteps,
        order: this.state.storySequence
      });
      this.state.storySequence += 1;
      this.save();
      return true;
    }

    tryShowPendingStory() {
      if (!this.state || !this.state.active || !dom.storyOverlay.hidden || !dom.startOverlay.hidden || !dom.endOverlay.hidden) return false;
      // 恢复的是同一次未读演出，不重新抽签，也不重新消耗 30 步演出额度。
      if (this.state.currentStory) return this.showStory(this.state.currentStory);
      this.state.pendingStories = Array.isArray(this.state.pendingStories) ? this.state.pendingStories : [];
      if (!this.state.pendingStories.length) return false;
      const lastStep = Number.isFinite(this.state.lastStoryStep) ? this.state.lastStoryStep : -STORY_COOLDOWN_STEPS;
      if (this.state.totalSteps - lastStep < STORY_COOLDOWN_STEPS) return false;
      this.state.pendingStories.sort((a, b) => (
        b.priority - a.priority || a.triggerStep - b.triggerStep || a.order - b.order
      ));
      const entry = this.state.pendingStories.shift();
      this.state.lastStoryStep = this.state.totalSteps;
      const shown = this.showStory(entry.scene);
      if (!shown) {
        this.state.pendingStories.unshift(entry);
        this.state.lastStoryStep = lastStep;
        return false;
      }
      this.save();
      return true;
    }

    showStory({ id, kicker, text, buttonLabel = "继续", onClose = null, markIds = [] }) {
      if (!dom.storyOverlay.hidden) return false;
      this.cancelAutoPath();
      if (this.state && this.state.active) {
        this.state.currentStory = { id, kicker, text, buttonLabel, markIds: Array.isArray(markIds) ? markIds : [] };
      }
      dom.storyKicker.textContent = kicker;
      dom.storyText.textContent = text;
      dom.storyContinueButton.textContent = buttonLabel;
      this.storyOnClose = onClose;
      dom.storyOverlay.hidden = false;
      dom.storyOverlay.classList.remove("visible");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => dom.storyOverlay.classList.add("visible"));
      });
      this.save();
      return true;
    }

    hideStory() {
      if (dom.storyOverlay.hidden) return;
      dom.storyOverlay.classList.remove("visible");
      dom.storyOverlay.hidden = true;
      if (this.state && this.state.active && this.state.currentStory) {
        const scene = this.state.currentStory;
        this.state.storyScenes = Array.isArray(this.state.storyScenes) ? this.state.storyScenes : [];
        [scene.id].concat(scene.markIds || []).forEach((sceneId) => {
          if (sceneId && !this.state.storyScenes.includes(sceneId)) this.state.storyScenes.push(sceneId);
        });
        this.state.currentStory = null;
        this.save();
      }
      const onClose = this.storyOnClose;
      this.storyOnClose = null;
      if (typeof onClose === "function") onClose();
    }

    showStatus(message) {
      dom.statusChip.textContent = message;
      dom.statusChip.classList.add("visible");
      clearTimeout(this.statusTimer);
      this.statusTimer = setTimeout(() => this.updateUI(), 900);
    }

    showToast(message) {
      dom.toast.textContent = message;
      dom.toast.classList.add("visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => dom.toast.classList.remove("visible"), 1500);
    }

    render() {
      if (this.renderQueued) return;
      this.renderQueued = true;
      requestAnimationFrame(() => {
        this.renderQueued = false;
        this.renderGameCanvas();
        this.renderMinimap();
      });
    }

    getMainViewMetrics(width, height) {
      const defaultTileSize = clamp(Math.min(width / 18, height / 17), 17, 31);
      const playerWorld = this.roomWorldCenter(this.state.player.x, this.state.player.y);
      const enhanced = this.state.visionTurns > 0;
      const tileSize = enhanced ? defaultTileSize * VISION_ZOOM_SCALE : defaultTileSize;

      return {
        tileSize,
        enhanced,
        camera: {
          x: width / 2 - playerWorld.x * tileSize,
          y: height / 2 - playerWorld.y * tileSize
        }
      };
    }

    getViewportRoomBounds(width, height, tileSize, camera) {
      const minWorldX = -camera.x / tileSize;
      const maxWorldX = (width - camera.x) / tileSize;
      const minWorldY = -camera.y / tileSize;
      const maxWorldY = (height - camera.y) / tileSize;
      return {
        minX: Math.max(0, Math.floor(minWorldX / ROOM_SPAN) - WALL_RENDER_MARGIN_ROOMS),
        maxX: Math.min(MAZE_SIZE - 1, Math.ceil(maxWorldX / ROOM_SPAN) + WALL_RENDER_MARGIN_ROOMS),
        minY: Math.max(0, Math.floor(minWorldY / ROOM_SPAN) - WALL_RENDER_MARGIN_ROOMS),
        maxY: Math.min(MAZE_SIZE - 1, Math.ceil(maxWorldY / ROOM_SPAN) + WALL_RENDER_MARGIN_ROOMS)
      };
    }

    drawMazeWalls(ctx, bounds, tileSize) {
      const segments = this.collectMazeWallSegments(bounds);
      if (!segments.length) return;
      const strokeSegments = () => {
        ctx.beginPath();
        segments.forEach((segment) => {
          ctx.moveTo(segment.x1 * tileSize, segment.y1 * tileSize);
          ctx.lineTo(segment.x2 * tileSize, segment.y2 * tileSize);
        });
        ctx.stroke();
      };
      ctx.save();
      ctx.globalAlpha = WALL_RENDER_ALPHA;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.strokeStyle = "#5b2228";
      ctx.lineWidth = Math.max(1.8, tileSize * 0.34);
      ctx.shadowColor = "rgba(181, 54, 62, 0.34)";
      ctx.shadowBlur = Math.max(2, tileSize * 0.16);
      strokeSegments();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#bd555c";
      ctx.lineWidth = Math.max(0.8, tileSize * 0.09);
      strokeSegments();
      ctx.restore();
    }

    isBaseMazeFloorCell(worldX, worldY) {
      const worldLimit = MAZE_SIZE * ROOM_SPAN;
      if (worldX < 0 || worldY < 0 || worldX >= worldLimit || worldY >= worldLimit) return false;
      const modX = worldX % ROOM_SPAN;
      const modY = worldY % ROOM_SPAN;
      const roomX = Math.floor(worldX / ROOM_SPAN);
      const roomY = Math.floor(worldY / ROOM_SPAN);
      if (modX >= 1 && modX <= ROOM_FLOOR_SIZE && modY >= 1 && modY <= ROOM_FLOOR_SIZE) {
        return inBounds(roomX, roomY);
      }
      if (modX === 0 && modY >= 1 && modY <= ROOM_FLOOR_SIZE) {
        const leftRoomX = roomX - 1;
        return inBounds(leftRoomX, roomY)
          && inBounds(roomX, roomY)
          && (this.state.maze.bits[indexFor(leftRoomX, roomY)] & DIRECTIONS.right.bit) !== 0;
      }
      if (modY === 0 && modX >= 1 && modX <= ROOM_FLOOR_SIZE) {
        const upperRoomY = roomY - 1;
        return inBounds(roomX, upperRoomY)
          && inBounds(roomX, roomY)
          && (this.state.maze.bits[indexFor(roomX, upperRoomY)] & DIRECTIONS.down.bit) !== 0;
      }
      return false;
    }

    isRemovableWallPillar(worldX, worldY) {
      if (worldX % ROOM_SPAN !== 0 || worldY % ROOM_SPAN !== 0) return false;
      return this.isBaseMazeFloorCell(worldX - 1, worldY)
        && this.isBaseMazeFloorCell(worldX + 1, worldY)
        && this.isBaseMazeFloorCell(worldX, worldY - 1)
        && this.isBaseMazeFloorCell(worldX, worldY + 1);
    }

    isMazeFloorCell(worldX, worldY) {
      return this.isBaseMazeFloorCell(worldX, worldY) || this.isRemovableWallPillar(worldX, worldY);
    }

    collectMazeWallSegments(bounds) {
      const segments = [];
      const worldLimit = MAZE_SIZE * ROOM_SPAN - 1;
      const minWorldX = Math.max(0, bounds.minX * ROOM_SPAN);
      const maxWorldX = Math.min(worldLimit, (bounds.maxX + 1) * ROOM_SPAN);
      const minWorldY = Math.max(0, bounds.minY * ROOM_SPAN);
      const maxWorldY = Math.min(worldLimit, (bounds.maxY + 1) * ROOM_SPAN);
      const add = (x1, y1, x2, y2) => segments.push({ x1, y1, x2, y2 });
      for (let worldY = minWorldY; worldY <= maxWorldY; worldY += 1) {
        for (let worldX = minWorldX; worldX <= maxWorldX; worldX += 1) {
          if (!this.isMazeFloorCell(worldX, worldY)) continue;
          if (!this.isMazeFloorCell(worldX, worldY - 1)) add(worldX, worldY, worldX + 1, worldY);
          if (!this.isMazeFloorCell(worldX + 1, worldY)) add(worldX + 1, worldY, worldX + 1, worldY + 1);
          if (!this.isMazeFloorCell(worldX, worldY + 1)) add(worldX + 1, worldY + 1, worldX, worldY + 1);
          if (!this.isMazeFloorCell(worldX - 1, worldY)) add(worldX, worldY + 1, worldX, worldY);
        }
      }
      return segments;
    }

    renderGameCanvas() {
      const canvas = dom.gameCanvas;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (!this.ctx || width <= 0 || height <= 0) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, width, height);
      const background = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      background.addColorStop(0, "#111922");
      background.addColorStop(0.55, "#080c12");
      background.addColorStop(1, "#030508");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      this.drawWallTexture(ctx, width, height);
      if (!this.state) return;

      const view = this.getMainViewMetrics(width, height);
      const { tileSize, camera, enhanced } = view;
      const explored = new Set(this.state.explored);
      const wallBounds = this.getViewportRoomBounds(width, height, tileSize, camera);

      ctx.save();
      ctx.translate(camera.x, camera.y);

      for (let y = wallBounds.minY; y <= wallBounds.maxY; y += 1) {
        for (let x = wallBounds.minX; x <= wallBounds.maxX; x += 1) {
          const key = roomKey(x, y);
          const visible = enhanced || this.visibleRooms.has(key);
          const drawable = visible || (!enhanced && explored.has(key));
          if (!drawable) continue;
          this.drawRoom(ctx, x, y, tileSize, visible ? 1 : 0.16);
          const mask = this.state.maze.bits[indexFor(x, y)];
          if ((mask & DIRECTIONS.right.bit) !== 0 && x + 1 < MAZE_SIZE) {
            const nextKey = roomKey(x + 1, y);
            const nextVisible = enhanced || this.visibleRooms.has(nextKey);
            const nextDrawable = nextVisible || (!enhanced && explored.has(nextKey));
            const alpha = nextDrawable ? (visible || nextVisible ? 1 : 0.16) : visible ? 0.3 : 0;
            if (alpha > 0) this.drawCorridor(ctx, x, y, "right", tileSize, alpha);
          }
          if ((mask & DIRECTIONS.down.bit) !== 0 && y + 1 < MAZE_SIZE) {
            const nextKey = roomKey(x, y + 1);
            const nextVisible = enhanced || this.visibleRooms.has(nextKey);
            const nextDrawable = nextVisible || (!enhanced && explored.has(nextKey));
            const alpha = nextDrawable ? (visible || nextVisible ? 1 : 0.16) : visible ? 0.3 : 0;
            if (alpha > 0) this.drawCorridor(ctx, x, y, "down", tileSize, alpha);
          }
        }
      }
      this.drawOpenIntersections(ctx, wallBounds, tileSize, enhanced, explored);

      // 合并房间与通道后只绘制可行走区域的统一外边界，避免共享墙重复叠亮。
      // 完整墙线仍预先存在，未知区域继续只由屏幕空间迷雾遮挡。
      this.drawMazeWalls(ctx, wallBounds, tileSize);

      for (const [key, entity] of Object.entries(this.state.maze.entities)) {
        const { x, y } = parseRoomKey(key);
        if (x < wallBounds.minX || x > wallBounds.maxX || y < wallBounds.minY || y > wallBounds.maxY) continue;
        const visible = enhanced || this.visibleRooms.has(key);
        if (!visible) continue;
        const visibleDistance = this.visibleRooms.get(key);
        if (entity.kind === "enemy" && entity.type === "ghost" && (visibleDistance === undefined ? Infinity : visibleDistance) > 1) continue;
        this.drawEntity(ctx, entity, x, y, tileSize, 1);
      }

      this.state.maze.exits.forEach((exit) => {
        const key = roomKey(exit.x, exit.y);
        if (exit.x < wallBounds.minX || exit.x > wallBounds.maxX || exit.y < wallBounds.minY || exit.y > wallBounds.maxY) return;
        if (!enhanced && !explored.has(key) && this.state.exitHintTurns <= 0) return;
        this.drawSprite(ctx, "exit", exit.x, exit.y, tileSize, enhanced || explored.has(key) ? 1 : 0.45);
      });

      this.drawAutoPath(ctx, tileSize);
      this.drawSprite(ctx, "player", this.state.player.x, this.state.player.y, tileSize, 1, true);
      if (!enhanced) this.drawWorldFogCells(ctx, wallBounds, tileSize, false, explored);
      ctx.restore();

      if (!enhanced) this.drawFogOverlay(ctx, width, height, false);
    }

    drawAutoPath(ctx, tileSize) {
      if (!this.autoPathTarget || !this.autoPath.length) return;
      const points = [{ x: this.state.player.x, y: this.state.player.y }].concat(this.autoPath);
      ctx.save();
      ctx.setLineDash([Math.max(2, tileSize * 0.22), Math.max(2, tileSize * 0.2)]);
      ctx.strokeStyle = "rgba(255, 200, 92, 0.72)";
      ctx.lineWidth = Math.max(1.2, tileSize * 0.08);
      ctx.beginPath();
      points.forEach((point, index) => {
        const world = this.roomWorldCenter(point.x, point.y);
        if (index === 0) ctx.moveTo(world.x * tileSize, world.y * tileSize);
        else ctx.lineTo(world.x * tileSize, world.y * tileSize);
      });
      ctx.stroke();
      const targetWorld = this.roomWorldCenter(this.autoPathTarget.x, this.autoPathTarget.y);
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ffc85c";
      ctx.lineWidth = Math.max(1.4, tileSize * 0.1);
      ctx.beginPath();
      ctx.arc(targetWorld.x * tileSize, targetWorld.y * tileSize, tileSize * 0.58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawWorldFogCells(ctx, bounds, tileSize, enhanced, explored) {
      if (enhanced) return;
      const cellSize = ROOM_SPAN * tileSize;
      ctx.save();
      ctx.fillStyle = "#010306";
      for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
        for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
          const key = roomKey(x, y);
          if (this.visibleRooms.has(key)) continue;
          const remembered = !enhanced && explored.has(key);
          const baseAlpha = remembered ? 0.5 : enhanced ? 0.88 : 0.82;
          const variation = (hashString(`fog-${key}`) % 5) * 0.01;
          ctx.globalAlpha = Math.min(0.94, baseAlpha + variation);
          ctx.fillRect(
            x * cellSize - 0.5,
            y * cellSize - 0.5,
            cellSize + 1,
            cellSize + 1
          );
        }
      }
      ctx.restore();
    }

    drawFogOverlay(ctx, width, height, enhanced) {
      if (enhanced) return;
      const shortestSide = Math.min(width, height);
      const longestSide = Math.max(width, height);
      const innerRadius = shortestSide * (enhanced ? 0.43 : 0.17);
      const outerRadius = enhanced ? longestSide * 0.68 : shortestSide * 0.47;
      const fog = ctx.createRadialGradient(
        width / 2,
        height / 2,
        innerRadius,
        width / 2,
        height / 2,
        outerRadius
      );
      fog.addColorStop(0, "rgba(1, 3, 6, 0.015)");
      fog.addColorStop(0.42, enhanced ? "rgba(2, 5, 8, 0.06)" : "rgba(2, 5, 8, 0.22)");
      fog.addColorStop(0.72, enhanced ? "rgba(2, 4, 7, 0.34)" : "rgba(2, 4, 7, 0.74)");
      fog.addColorStop(1, enhanced ? "rgba(1, 2, 4, 0.9)" : "rgba(1, 2, 4, 0.955)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, width, height);

      const haze = ctx.createLinearGradient(0, 0, 0, height);
      haze.addColorStop(0, enhanced ? "rgba(80, 101, 112, 0.16)" : "rgba(80, 101, 112, 0.26)");
      haze.addColorStop(0.24, "rgba(32, 47, 56, 0)");
      haze.addColorStop(0.72, "rgba(32, 47, 56, 0)");
      haze.addColorStop(1, enhanced ? "rgba(70, 87, 96, 0.12)" : "rgba(70, 87, 96, 0.22)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);
    }

    drawWallTexture(ctx, width, height) {
      ctx.save();
      // 背景只保留不规则石屑，不再绘制屏幕坐标砖缝，避免与世界坐标墙体产生错位感。
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#566370";
      for (let y = 17; y < height; y += 43) {
        for (let x = 13; x < width; x += 47) {
          if (hashString(`texture-${x}-${y}`) % 4 !== 0) continue;
          const size = 1 + (hashString(`texture-size-${x}-${y}`) % 3);
          ctx.fillRect(x, y, size, size);
        }
      }
      ctx.restore();
    }

    roomWorldCenter(x, y) {
      return { x: x * ROOM_SPAN + 2.5, y: y * ROOM_SPAN + 2.5 };
    }

    drawRoom(ctx, x, y, tileSize, alpha) {
      const startX = (x * ROOM_SPAN + 1) * tileSize;
      const startY = (y * ROOM_SPAN + 1) * tileSize;
      const size = ROOM_FLOOR_SIZE * tileSize;
      this.drawFloorBlock(ctx, startX, startY, size, size, tileSize, alpha, x, y);
    }

    drawCorridor(ctx, x, y, direction, tileSize, alpha) {
      if (direction === "right") {
        const startX = (x * ROOM_SPAN + 4) * tileSize;
        const startY = (y * ROOM_SPAN + 1) * tileSize;
        this.drawFloorBlock(ctx, startX, startY, tileSize, ROOM_FLOOR_SIZE * tileSize, tileSize, alpha, x + 17, y);
      } else {
        const startX = (x * ROOM_SPAN + 1) * tileSize;
        const startY = (y * ROOM_SPAN + 4) * tileSize;
        this.drawFloorBlock(ctx, startX, startY, ROOM_FLOOR_SIZE * tileSize, tileSize, tileSize, alpha, x, y + 17);
      }
    }

    drawOpenIntersections(ctx, bounds, tileSize, enhanced, explored) {
      const minPivotX = Math.max(1, bounds.minX);
      const maxPivotX = Math.min(MAZE_SIZE - 1, bounds.maxX + 1);
      const minPivotY = Math.max(1, bounds.minY);
      const maxPivotY = Math.min(MAZE_SIZE - 1, bounds.maxY + 1);
      for (let pivotY = minPivotY; pivotY <= maxPivotY; pivotY += 1) {
        for (let pivotX = minPivotX; pivotX <= maxPivotX; pivotX += 1) {
          const worldX = pivotX * ROOM_SPAN;
          const worldY = pivotY * ROOM_SPAN;
          if (!this.isRemovableWallPillar(worldX, worldY)) continue;
          const adjacentRooms = [
            roomKey(pivotX - 1, pivotY - 1), roomKey(pivotX, pivotY - 1),
            roomKey(pivotX - 1, pivotY), roomKey(pivotX, pivotY)
          ];
          const visible = enhanced || adjacentRooms.some((key) => this.visibleRooms.has(key));
          const remembered = adjacentRooms.some((key) => explored.has(key));
          if (!visible && !remembered) continue;
          this.drawFloorBlock(
            ctx,
            worldX * tileSize,
            worldY * tileSize,
            tileSize,
            tileSize,
            tileSize,
            visible ? 1 : 0.16,
            pivotX + 101,
            pivotY + 101
          );
        }
      }
    }

    drawFloorBlock(ctx, x, y, width, height, tileSize, alpha, seedX, seedY) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const gradient = ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, "#263744");
      gradient.addColorStop(1, "#14212b");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = "rgba(178, 194, 204, 0.22)";
      ctx.lineWidth = Math.max(0.6, tileSize * 0.035);
      for (let gx = x; gx <= x + width + 0.1; gx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx, y + height);
        ctx.stroke();
      }
      for (let gy = y; gy <= y + height + 0.1; gy += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + width, gy);
        ctx.stroke();
      }
      const noise = hashString(`${seedX},${seedY}`) % 5;
      if (noise === 0 && width >= tileSize * 2 && height >= tileSize * 2) {
        ctx.fillStyle = "rgba(80, 116, 82, 0.12)";
        ctx.fillRect(x + tileSize * 0.25, y + tileSize * 1.7, tileSize * 0.6, tileSize * 0.18);
      }
      ctx.restore();
    }

    drawEntity(ctx, entity, x, y, tileSize, alpha) {
      if (entity.kind === "pickup") {
        this.drawSprite(ctx, ITEM_DEFS[entity.itemType].asset, x, y, tileSize, alpha);
        return;
      }
      if (entity.kind === "event") {
        this.drawSprite(ctx, EVENT_DEFS[entity.type].asset, x, y, tileSize, alpha);
        return;
      }
      if (entity.kind === "enemy") {
        const asset = entity.type === "mimic" && !entity.revealed ? "chest" : ENEMY_DEFS[entity.type].asset;
        this.drawSprite(ctx, asset, x, y, tileSize, alpha);
        if (alpha >= 0.9 && !(entity.type === "mimic" && !entity.revealed)) {
          const world = this.roomWorldCenter(x, y);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "rgba(4, 5, 8, 0.84)";
          ctx.fillRect(world.x * tileSize - tileSize * 0.72, world.y * tileSize - tileSize * 1.4, tileSize * 1.44, tileSize * 0.52);
          ctx.fillStyle = "#ff6262";
          ctx.font = `700 ${Math.max(9, tileSize * 0.38)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${entity.hp} HP`, world.x * tileSize, world.y * tileSize - tileSize * 1.14);
          ctx.restore();
        }
      }
    }

    drawSprite(ctx, assetKey, roomX, roomY, tileSize, alpha, player = false) {
      const image = this.assets.get();
      const frame = SPRITE_ATLAS.frames[assetKey] || SPRITE_ATLAS.frames["event-map"];
      const world = this.roomWorldCenter(roomX, roomY);
      const centerX = world.x * tileSize;
      const centerY = world.y * tileSize;
      const size = tileSize * (player ? 2.25 : 2.05);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (player) {
        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size * 0.72);
        glow.addColorStop(0, "rgba(97, 217, 242, 0.34)");
        glow.addColorStop(1, "rgba(97, 217, 242, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
      if (image) {
        const sourceWidth = image.naturalWidth / SPRITE_ATLAS.columns;
        const sourceHeight = image.naturalHeight / SPRITE_ATLAS.rows;
        ctx.drawImage(
          image,
          frame[0] * sourceWidth,
          frame[1] * sourceHeight,
          sourceWidth,
          sourceHeight,
          centerX - size / 2,
          centerY - size / 2,
          size,
          size
        );
      } else {
        ctx.fillStyle = player ? "#61d9f2" : "#d8ae5b";
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    renderMinimap() {
      if (!this.state) return;
      const rect = dom.minimapCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.drawMap(this.minimapCtx, rect.width, rect.height, false, true);
    }

    openMap(revealAll) {
      if (!this.state) return;
      dom.mapOverlay.hidden = false;
      requestAnimationFrame(() => {
        this.resizeCanvas(dom.fullMapCanvas, this.fullMapCtx);
        const rect = dom.fullMapCanvas.getBoundingClientRect();
        this.fullMapTransform = this.drawMap(this.fullMapCtx, rect.width, rect.height, revealAll, false);
      });
    }

    getExitHintDirection(exit) {
      const dx = exit.x - this.state.player.x;
      const dy = exit.y - this.state.player.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        return { key: dx >= 0 ? "east" : "west", ux: dx >= 0 ? 1 : -1, uy: 0 };
      }
      return { key: dy >= 0 ? "south" : "north", ux: 0, uy: dy >= 0 ? 1 : -1 };
    }

    drawMap(ctx, width, height, revealAll, compact) {
      if (!this.state || width <= 0 || height <= 0) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#040609";
      ctx.fillRect(0, 0, width, height);
      const padding = compact ? 6 : 14;
      const explored = new Set(this.state.explored);
      let viewMinX = 0;
      let viewMaxX = MAZE_SIZE - 1;
      let viewMinY = 0;
      let viewMaxY = MAZE_SIZE - 1;

      if (!revealAll && explored.size) {
        viewMinX = MAZE_SIZE - 1;
        viewMaxX = 0;
        viewMinY = MAZE_SIZE - 1;
        viewMaxY = 0;
        explored.forEach((key) => {
          const room = parseRoomKey(key);
          viewMinX = Math.min(viewMinX, room.x);
          viewMaxX = Math.max(viewMaxX, room.x);
          viewMinY = Math.min(viewMinY, room.y);
          viewMaxY = Math.max(viewMaxY, room.y);
        });
        const expandRange = (min, max) => {
          const minimumSpan = Math.min(compact ? 18 : 26, MAZE_SIZE - 1);
          const edgePadding = compact ? 2 : 3;
          let rangeMin = min - edgePadding;
          let rangeMax = max + edgePadding;
          if (rangeMax - rangeMin < minimumSpan) {
            const center = (rangeMin + rangeMax) / 2;
            rangeMin = center - minimumSpan / 2;
            rangeMax = center + minimumSpan / 2;
          }
          if (rangeMin < 0) {
            rangeMax -= rangeMin;
            rangeMin = 0;
          }
          if (rangeMax > MAZE_SIZE - 1) {
            rangeMin -= rangeMax - (MAZE_SIZE - 1);
            rangeMax = MAZE_SIZE - 1;
          }
          return [Math.max(0, rangeMin), Math.min(MAZE_SIZE - 1, rangeMax)];
        };
        [viewMinX, viewMaxX] = expandRange(viewMinX, viewMaxX);
        [viewMinY, viewMaxY] = expandRange(viewMinY, viewMaxY);
      }

      const viewSpanX = Math.max(1, viewMaxX - viewMinX);
      const viewSpanY = Math.max(1, viewMaxY - viewMinY);
      const scale = (Math.min(width, height) - padding * 2) / Math.max(viewSpanX, viewSpanY);
      const offsetX = (width - scale * viewSpanX) / 2 - viewMinX * scale;
      const offsetY = (height - scale * viewSpanY) / 2 - viewMinY * scale;
      const canDraw = (x, y) => revealAll || explored.has(roomKey(x, y));
      const outerWallWidth = compact ? clamp(scale * 0.45, 1, 2.1) : clamp(scale * 0.58, 2.4, 4.5);
      const innerPathWidth = compact ? clamp(scale * 0.34, 0.72, 1.75) : clamp(scale * 0.42, 1.8, 3.5);

      ctx.save();
      ctx.lineCap = "square";
      ctx.lineJoin = "round";
      const strokeConnections = (strokeStyle, lineWidth) => {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        for (let y = Math.floor(viewMinY); y <= Math.ceil(viewMaxY); y += 1) {
          for (let x = Math.floor(viewMinX); x <= Math.ceil(viewMaxX); x += 1) {
            if (!canDraw(x, y)) continue;
            const mask = this.state.maze.bits[indexFor(x, y)];
            const sx = offsetX + x * scale;
            const sy = offsetY + y * scale;
            for (const direction of [DIRECTIONS.right, DIRECTIONS.down]) {
              const nx = x + direction.dx;
              const ny = y + direction.dy;
              if ((mask & direction.bit) === 0 || !inBounds(nx, ny) || !canDraw(nx, ny)) continue;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(offsetX + nx * scale, offsetY + ny * scale);
              ctx.stroke();
            }
          }
        }
      };

      // 缩略图以灰蓝探索网络为主，暗红只保留成很窄的墙影，避免整幅图变成红色网格。
      strokeConnections(revealAll ? "rgba(71, 38, 43, 0.74)" : "rgba(87, 49, 55, 0.78)", outerWallWidth);
      strokeConnections(revealAll ? "#2a3b46" : "#3a505d", innerPathWidth);

      for (let y = Math.floor(viewMinY); y <= Math.ceil(viewMaxY); y += 1) {
        for (let x = Math.floor(viewMinX); x <= Math.ceil(viewMaxX); x += 1) {
          if (!canDraw(x, y)) continue;
          const sx = offsetX + x * scale;
          const sy = offsetY + y * scale;
          const outerSize = compact ? clamp(scale * 0.46, 0.95, 2.1) : clamp(scale * 0.58, 2.3, 4.4);
          const innerSize = compact ? clamp(scale * 0.34, 0.7, 1.72) : clamp(scale * 0.42, 1.75, 3.4);
          ctx.fillStyle = revealAll ? "#47262b" : "#573137";
          ctx.fillRect(sx - outerSize / 2, sy - outerSize / 2, outerSize, outerSize);
          ctx.fillStyle = revealAll ? "#2a3b46" : "#3a505d";
          ctx.fillRect(sx - innerSize / 2, sy - innerSize / 2, innerSize, innerSize);
        }
      }

      if (this.state.path.length > 1) {
        ctx.lineWidth = compact ? clamp(scale * 0.3, 0.65, 1.6) : clamp(scale * 0.42, 1.8, 2.8);
        ctx.strokeStyle = "rgba(226, 179, 81, 0.86)";
        ctx.beginPath();
        let started = false;
        this.state.path.forEach((point) => {
          const px = offsetX + point.x * scale;
          const py = offsetY + point.y * scale;
          if (!canDraw(point.x, point.y)) {
            started = false;
            return;
          }
          if (!started || point.teleport) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();

        for (let i = 1; i < this.state.path.length; i += 1) {
          const point = this.state.path[i];
          const previous = this.state.path[i - 1];
          if (!point.teleport || !canDraw(point.x, point.y) || !canDraw(previous.x, previous.y)) continue;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "rgba(97,217,242,0.75)";
          ctx.beginPath();
          ctx.moveTo(offsetX + previous.x * scale, offsetY + previous.y * scale);
          ctx.lineTo(offsetX + point.x * scale, offsetY + point.y * scale);
          ctx.stroke();
          ctx.restore();
        }
      }

      const compactHints = compact
        ? this.state.maze.exits.map((exit) => this.getExitHintDirection(exit))
        : [];
      const hintTotals = {};
      const hintUsed = {};
      compactHints.forEach((hint) => {
        hintTotals[hint.key] = (hintTotals[hint.key] || 0) + 1;
      });

      this.state.maze.exits.forEach((exit, exitIndex) => {
        const discovered = explored.has(roomKey(exit.x, exit.y));
        if (!compact && !revealAll && !discovered && this.state.exitHintTurns <= 0) return;
        const arrowSize = compact ? clamp(scale * 2.2, 3.5, 5) : clamp(scale * 1.1, 5.5, 7.2);
        const rawX = offsetX + exit.x * scale;
        const rawY = offsetY + exit.y * scale;
        let px = rawX;
        let py = rawY;
        let ux;
        let uy;
        if (compact) {
          const hint = compactHints[exitIndex];
          const slot = hintUsed[hint.key] || 0;
          const total = hintTotals[hint.key];
          const shift = (slot - (total - 1) / 2) * arrowSize * 2.1;
          hintUsed[hint.key] = slot + 1;
          ux = hint.ux;
          uy = hint.uy;
          if (hint.key === "north" || hint.key === "south") {
            px = width / 2 + shift;
            py = hint.key === "north" ? padding + arrowSize : height - padding - arrowSize;
          } else {
            px = hint.key === "west" ? padding + arrowSize : width - padding - arrowSize;
            py = height / 2 + shift;
          }
        } else {
          ux = exit.x - this.state.player.x;
          uy = exit.y - this.state.player.y;
          const length = Math.hypot(ux, uy) || 1;
          ux /= length;
          uy /= length;
        }
        const perpendicularX = -uy;
        const perpendicularY = ux;
        const baseX = px - ux * arrowSize * 0.48;
        const baseY = py - uy * arrowSize * 0.48;
        ctx.globalAlpha = discovered || revealAll || this.state.exitHintTurns > 0 ? 1 : 0.76;
        ctx.fillStyle = "#ffc85c";
        ctx.shadowColor = "#b28bff";
        ctx.shadowBlur = compact ? 5 : 9;
        ctx.beginPath();
        ctx.moveTo(px + ux * arrowSize, py + uy * arrowSize);
        ctx.lineTo(baseX + perpendicularX * arrowSize * 0.55, baseY + perpendicularY * arrowSize * 0.55);
        ctx.lineTo(baseX - perpendicularX * arrowSize * 0.55, baseY - perpendicularY * arrowSize * 0.55);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#61d9f2";
      ctx.shadowBlur = compact ? 5 : 9;
      ctx.beginPath();
      ctx.arc(
        offsetX + this.state.player.x * scale,
        offsetY + this.state.player.y * scale,
        compact ? clamp(scale * 0.72, 1.6, 2.6) : clamp(scale * 0.64, 3.2, 4.2),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
      return { scale, offsetX, offsetY, viewMinX, viewMaxX, viewMinY, viewMaxY };
    }

    endGame(reason, escaped = false) {
      if (!this.state || !this.state.active) return;
      this.cancelAutoPath();
      this.state.active = false;
      this.pending = null;
      this.hideEncounter();
      this.state.pendingStories = [];
      this.state.currentStory = null;
      this.storyOnClose = null;
      dom.storyOverlay.hidden = true;
      this.setControlsEnabled(false);
      localStorage.removeItem(STORAGE_KEY);
      const record = {
        steps: this.state.totalSteps,
        enemies: this.state.stats.enemies,
        chests: this.state.stats.chests,
        explored: this.state.stats.rooms,
        escaped,
        endedAt: Date.now()
      };
      const records = this.loadRecords();
      records.push(record);
      records.sort((a, b) => b.steps - a.steps || (b.explored || 0) - (a.explored || 0));
      localStorage.setItem(RECORD_KEY, JSON.stringify(records.slice(0, 20)));

      dom.endTitle.textContent = escaped ? "你在天光中醒来" : "你从坠落感中惊醒";
      dom.endReveal.textContent = escaped
        ? "你走出的只是昏迷中的幻觉迷宫；醒来之后，沿搜救绳回到村庄，才是这条真实路线的终点。"
        : "幻觉中的死亡让你及时醒来；现实里的你仍在山谷中，循着水声与呼喊回到村庄，才是这条真实路线的终点。";
      dom.endStats.innerHTML = "";
      [
        ["探索格数", record.explored],
        ["总步数", record.steps],
        ["击败敌人", record.enemies],
        ["开启宝箱", record.chests]
      ].forEach(([label, value]) => {
        const item = document.createElement("div");
        item.className = "end-stat";
        const name = document.createElement("span");
        name.textContent = label;
        const number = document.createElement("strong");
        number.textContent = value;
        item.appendChild(name);
        item.appendChild(number);
        dom.endStats.appendChild(item);
      });
      const presentEndSummary = () => {
        dom.endOverlay.hidden = false;
        requestAnimationFrame(() => {
          this.resizeCanvas(dom.endMapCanvas, this.endMapCtx);
          const rect = dom.endMapCanvas.getBoundingClientRect();
          this.drawMap(this.endMapCtx, rect.width, rect.height, true, false);
        });
      };
      const shown = this.showStory({
        id: escaped ? "ending-escaped" : "ending-fallen",
        kicker: escaped ? "梦醒 · 天光" : "梦醒 · 坠落感",
        text: escaped
          ? "你越过最后一道暗红墙线，整座迷宫在天光中碎裂。醒来时，你正趴在谷底旧排水洞边，手中紧握着村人垂下的搜救绳；记忆也终于归位——清晨，你为查看暴雨堵塞的引水沟独自上山，因踩断湿根而坠落。你被拉出山谷，沿熟悉的村道走到那盏始终为你亮着的灯前。迷宫出口只是醒来，回到家才是真正的终点。"
          : `${reason}。暗红走廊骤然碎裂，坠落感把你从幻境中惊醒。你仍在谷底，手脚尚能回应；想起自己为查看引水沟上山、踩断湿根后坠落，你用短镰割开藤蔓，沿水声寻找缓坡，又循着铜盆声和犬吠走向搜山的人。夜色落下前，你终于回到村口——梦中的死亡不是终点，而是现实归途的开始。`,
        buttonLabel: "查看本局",
        onClose: presentEndSummary
      });
      if (!shown) presentEndSummary();
    }
  }

  const game = new DungeonGame();
  window.__dungeonGame = game;
})();

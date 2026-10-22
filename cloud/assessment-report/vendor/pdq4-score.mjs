/** PDQ-4+ 计分。题号、划界、冲动/品行合成、掩饰与怀疑与 mindtest pdq/js/score.js、data.js 一致。 */
export const QUESTION_COUNT = 126;
export const PDQ4_VERSION = "pdq4-plus-cn-v1";
export const PDQ4_CONSENT_VERSION = "consent-assessment-pdq4-1";
export const PDQ4_ID = "pdq4";
export const PDQ4_SCREEN_TEXT = "这是筛查，不是诊断，也不能代替面谈。达到划界只说明问卷上的一种相处方式，不能据此给自己下人格障碍的诊断。";
export const PDQ4_READER_GAP = "阅读页若尚未重绘 PDQ-4，筛查说明在 interpretation、sections 与 textFallback。";
export const IMPULSE_ITEMS = [106,107,108,109,110,111];
export const CONDUCT_ITEMS = [112,113,114,115,116,117,118,119,120,121,122,123,124,125,126];
export const TOO_GOOD_REVERSE = [12,25,38];
export const TOO_GOOD_YES = [51];
export const SUSPECT_YES = [64,76];
export const SCALES = [
  {
    "id": "par",
    "name": "偏执型",
    "cluster": "A",
    "items": [
      11,
      24,
      37,
      50,
      62,
      85,
      96
    ],
    "cutoff": 4,
    "about": "不信任别人，容易把中性的举动看成针对自己。",
    "portrait": "达到划界时，常见的是广泛猜疑：别人并无恶意、甚至是好意，也会被理解成敌意、利用或歧视。容易觉得周围有针对自己的安排，嫉妒或被嫉妒的感觉比较强，也容易争辩、记仇，不肯原谅。"
  },
  {
    "id": "szd",
    "name": "分裂样",
    "cluster": "A",
    "items": [
      9,
      22,
      34,
      47,
      60,
      71,
      95
    ],
    "cutoff": 4,
    "about": "主动与人保持距离，情感比较平、比较冷。",
    "portrait": "达到划界时，常见的是喜欢独处，对亲密关系缺少兴趣，和家人朋友在一起也未必觉得愉快。除了至亲，很少有亲近的人，也不太在意别人的称赞或批评。"
  },
  {
    "id": "szt",
    "name": "分裂型",
    "cluster": "A",
    "items": [
      10,
      23,
      36,
      48,
      60,
      61,
      72,
      74,
      86
    ],
    "cutoff": 5,
    "about": "想法或感受比较奇特，跟人靠近时容易紧张。",
    "portrait": "达到划界时，可能出现与常人不同的信念或知觉，例如觉得自己能预知、能接收别人感觉不到的信息。说话让人跟不上，外表或行为显得古怪，和人单独相处或置身人群时会紧张。第 60 题同时计入分裂样。"
  },
  {
    "id": "ant",
    "name": "反社会型",
    "cluster": "B",
    "items": [
      8,
      20,
      33,
      46,
      59,
      75,
      94
    ],
    "extra": "conduct",
    "cutoff": 3,
    "about": "漠视别人的处境和规则，行为不计后果。",
    "portrait": "达到划界时，常见的是不顾规则和别人的感受，说谎、冲动、打架或冒险，出了问题也较少内疚。15 岁前的行为要另外合成 1 分：15 项里至少 3 项答「是」，这一分才记上。"
  },
  {
    "id": "bor",
    "name": "边缘型",
    "cluster": "B",
    "items": [
      6,
      19,
      32,
      45,
      58,
      69,
      78,
      93
    ],
    "extra": "impulse",
    "cutoff": 5,
    "about": "关系、心情和自我感都容易大起大落。",
    "portrait": "达到划界时，关系常常在极度靠近和极度怨恨之间摆动，害怕被离开，心情转得很快，空虚感明显，生气难以收回，紧张时可能多疑或一时断片，也可能伤害过自己。冲动行为要另外合成 1 分：6 个小项里至少 2 项答「是」，这一分才记上。"
  },
  {
    "id": "his",
    "name": "表演型",
    "alias": "癔症型",
    "cluster": "B",
    "items": [
      4,
      17,
      30,
      43,
      55,
      67,
      80,
      90
    ],
    "cutoff": 5,
    "about": "需要被看见，情绪外露，也容易受场面影响。",
    "portrait": "达到划界时，表达往往比实际感受更满、更快，很在意自己是否被注意和称赞，也容易用外貌或场面来获得注意。受暗示，关系热得快，说话多但要点容易散。原问卷也称这一型为癔症型。"
  },
  {
    "id": "nar",
    "name": "自恋型",
    "cluster": "B",
    "items": [
      5,
      18,
      31,
      44,
      57,
      68,
      73,
      79,
      92
    ],
    "cutoff": 5,
    "about": "需要被特别看待，受挫时容易羞耻或生气。",
    "portrait": "达到划界时，会觉得自己的成绩、重要程度被低估，渴望持续的称赞和特殊对待，也容易觉得只有少数人配得上理解自己。被怠慢或批评时反应强，嫉妒和被嫉妒都常见，别人则可能觉得傲慢。"
  },
  {
    "id": "avo",
    "name": "回避型",
    "cluster": "C",
    "items": [
      1,
      13,
      26,
      39,
      52,
      83,
      87
    ],
    "cutoff": 4,
    "about": "怕被否定，所以先退出可能被评价的场合。",
    "portrait": "达到划界时，很容易被批评、拒绝或取笑伤到，除非确信对方喜欢自己，否则不愿靠近。怕在陌生人面前发窘，会躲开需要跟人打交道的工作，在亲近的人面前也收着自己的感受。"
  },
  {
    "id": "dep",
    "name": "依赖型",
    "cluster": "C",
    "items": [
      2,
      15,
      27,
      40,
      53,
      65,
      82,
      88
    ],
    "cutoff": 5,
    "about": "把决定和照顾交给别人，害怕独自撑住。",
    "portrait": "达到划界时，日常决定也要别人再三保证，重要的事交给家人和朋友。害怕表达不同意见会失去支持，一个人时容易觉得无助，一段亲近关系结束就急着找下一段，也怕被留下后要自己照料一切。"
  },
  {
    "id": "ocp",
    "name": "强迫型",
    "cluster": "C",
    "items": [
      3,
      16,
      29,
      41,
      54,
      66,
      81,
      89
    ],
    "cutoff": 4,
    "about": "用细节、规则和完美来压住不确定。",
    "portrait": "达到划界时，注意力会停在细节、规则和完美上，大目标反而被拖住。道德感偏严，工作排在关系和休息前面，不放心把事情交给别人，节约到被看成吝啬，别人也觉得固执。东西舍不得扔。"
  },
  {
    "id": "pag",
    "name": "被动攻击型",
    "cluster": "X",
    "items": [
      7,
      21,
      35,
      49,
      63,
      77,
      91
    ],
    "cutoff": 4,
    "about": "表面顺从来，实际用拖延和怨气抵抗。",
    "portrait": "达到划界时，攻击不直接出手，而是完不成承诺、抗拒上级的安排、心里觉得不被理解。对别人的好运不满，诉苦多，发过火又很快道歉。外在顺从，内里固执、拖拉。"
  },
  {
    "id": "dps",
    "name": "抑郁型",
    "cluster": "X",
    "items": [
      14,
      28,
      42,
      56,
      70,
      84,
      97
    ],
    "cutoff": 5,
    "about": "长久的悲观和自我责备，不只是某一次心情不好。",
    "portrait": "达到划界时，低落和悲观更像一种长期底色：习惯从坏的一面看，对自己很苛，容易忧虑，也为内疚和自卑烦恼。它描述的是人格层面的抑郁倾向，不能据此判断你现在有没有抑郁发作。"
  }
];

function assertAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT) {
    throw new Error("需要 126 道题的作答");
  }
  answers.forEach((value, index) => {
    if (value !== 0 && value !== 1) {
      throw new Error(`第 ${index + 1} 题的答案无效`);
    }
  });
}

function yes(answers, n) {
  return answers[n - 1] === 1 ? 1 : 0;
}

function sumItems(answers, items) {
  return items.reduce((total, n) => total + yes(answers, n), 0);
}

function composite(answers, items, need) {
  const count = sumItems(answers, items);
  return { count, need, point: count >= need ? 1 : 0 };
}

export function scorePdq4(answers) {
  assertAnswers(answers);
  const impulse = composite(answers, IMPULSE_ITEMS, 2);
  const conduct = composite(answers, CONDUCT_ITEMS, 3);

  const scales = SCALES.map((scale) => {
    let score = sumItems(answers, scale.items);
    if (scale.extra === "impulse") score += impulse.point;
    if (scale.extra === "conduct") score += conduct.point;
    const max = scale.items.length + (scale.extra ? 1 : 0);
    const positive = score >= scale.cutoff;
    return {
      id: scale.id,
      name: scale.name,
      alias: scale.alias || "",
      cluster: scale.cluster,
      about: scale.about,
      portrait: scale.portrait,
      score,
      max,
      cutoff: scale.cutoff,
      positive,
      items: scale.items.slice(),
    };
  });

  const tooGoodHits = [
    ...TOO_GOOD_REVERSE.filter((n) => answers[n - 1] === 0),
    ...TOO_GOOD_YES.filter((n) => answers[n - 1] === 1),
  ];
  const suspectHits = SUSPECT_YES.filter((n) => answers[n - 1] === 1);
  const tooGood = {
    score: tooGoodHits.length,
    max: TOO_GOOD_REVERSE.length + TOO_GOOD_YES.length,
    cutoff: 2,
    flagged: tooGoodHits.length >= 2,
    items: tooGoodHits,
  };
  const suspect = {
    score: suspectHits.length,
    max: SUSPECT_YES.length,
    cutoff: 1,
    flagged: suspectHits.length >= 1,
    items: suspectHits,
  };
  const positiveScales = scales.filter((scale) => scale.positive);
  const total = scales.reduce((sum, scale) => sum + scale.score, 0);

  return {
    scales,
    positiveScales,
    positiveCount: positiveScales.length,
    total,
    impulse,
    conduct,
    tooGood,
    suspect,
    verdict: buildVerdict(positiveScales, tooGood, suspect),
  };
}

function buildVerdict(positiveScales, tooGood, suspect) {
  const names = positiveScales.map((scale) => scale.name).join("、");
  if (suspect.flagged && tooGood.flagged) {
    return {
      id: "invalid",
      title: "作答本身先要打折",
      text: `有题目提示问卷可疑，同时也有掩饰倾向。下面的分数仍然按规则算出${names ? `，达到划界的是${names}` : ""}，但不宜直接当成你的人格画像。`,
    };
  }
  if (suspect.flagged) {
    return {
      id: "suspect",
      title: "这份问卷可疑",
      text: `第 64 题或第 76 题的回答使结果不可靠。分数照常列出${names ? `，其中${names}达到划界` : ""}，请先看效度，再决定要不要重做。`,
    };
  }
  if (tooGood.flagged && positiveScales.length === 0) {
    return {
      id: "too-good-clear",
      title: "没有维度达到划界，但回答偏完美",
      text: "12 个分量表都低于划界分。同时，几道几乎人人都会承认的小题被否认了，分数有可能被压低。",
    };
  }
  if (tooGood.flagged) {
    return {
      id: "too-good",
      title: `${positiveScales.length} 个维度达到划界，回答仍偏完美`,
      text: `${names}达到筛查划界。掩饰分也偏高，实际倾向可能比卷面更明显。这仍是筛查，不是诊断。`,
    };
  }
  if (positiveScales.length === 0) {
    return {
      id: "clear",
      title: "没有维度达到划界",
      text: "12 个分量表都低于各自的划界分。这表示以这份问卷的标准，目前看不到需要标记的人格障碍筛查阳性。它排除不了所有问题，也不能代替面谈。",
    };
  }
  if (positiveScales.length === 1) {
    return {
      id: "one",
      title: `${positiveScales[0].name}达到划界`,
      text: "只有这一个维度达到筛查划界。它提示一种相对稳定的相处和感受方式，不是诊断，也不能说明严重程度。",
    };
  }
  return {
    id: "several",
    title: `${positiveScales.length} 个维度达到划界`,
    text: `${names}达到各自的划界分。阳性越多，说明这些模式叠在一起的范围越广，但不等于更重，也不等于可以给自己下诊断。`,
  };
}

export function pdq4Flags(scored) {
  const flags = [];
  if (scored.positiveCount > 0) flags.push("positive");
  if (scored.tooGood.flagged) flags.push("too-good");
  if (scored.suspect.flagged) flags.push("suspect");
  return flags;
}

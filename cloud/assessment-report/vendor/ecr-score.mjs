/** ECR 计分。反向题、两维均分和 Fisher 判别式与 mindtest ecr/js/score.js、data.js 一致。 */
export const QUESTION_COUNT = 36;
export const ECR_VERSION = "ecr-h5-v1";
export const ECR_CONSENT_VERSION = "consent-assessment-ecr-1";
export const ECR_ID = "ecr";
export const ECR_SCREEN_TEXT = "这是你在恋爱经历里常常有的感觉，不是对某一次吵架的结论，也不是诊断。";
export const ECR_READER_GAP = "阅读页若尚未重绘 ECR，类型说明在 interpretation、sections 与 textFallback。";
export const REVERSE_ITEMS = [3, 15, 19, 22, 25, 27, 29, 31, 33, 35];

const REVERSE = new Set(REVERSE_ITEMS);
const MIDPOINT = 4;
const ODDS = Array.from({ length: 18 }, (_, index) => index * 2 + 1);
const EVENS = Array.from({ length: 18 }, (_, index) => index * 2 + 2);

export const DIMENSIONS = [
  {
    id: "avoidance",
    name: "依恋回避",
    items: ODDS,
    about: "对亲近、依赖、把心里话说出来有多不自在。越高，越倾向于退开。",
    levels: {
      low: "低于量表中点。亲近、依赖、把事情讲给恋人，对你相对自在。",
      mid: "正好落在量表中点。亲近和后退都没有明显偏向。",
      high: "高于量表中点。太近会紧。你更常把感受留在自己这边，靠着恋人不那么容易。",
    },
  },
  {
    id: "anxiety",
    name: "依恋焦虑",
    items: EVENS,
    about: "对关系会不会失去、对方是不是足够在乎有多担心。越高，越容易不安。",
    levels: {
      low: "低于量表中点。关系里的波动，不太会马上变成“我要被抛弃了”。",
      mid: "正好落在量表中点。担心和放心都没有明显偏向。",
      high: "高于量表中点。你容易盯着对方还在不在、在不在乎。回应少的时候，不安来得比较快。",
    },
  },
];

export const TYPES = [
  {
    id: "secure",
    name: "安全型",
    a: 3.2893296,
    b: 5.4725318,
    c: -11.5307833,
    short: "靠近不觉得别扭，分开也不容易慌。",
    text: "你比较能把亲近和独立放在一起。需要对方时，依赖不太羞耻；对方暂时不在，也不容易立刻觉得关系要散。心里话说得出口，也不必时时确认对方还爱不爱你。",
  },
  {
    id: "fearful",
    name: "恐惧型",
    a: 7.2371075,
    b: 8.1776448,
    c: -32.3553266,
    short: "想靠近，也怕靠太近。",
    text: "你既希望被靠近，又对太近保持戒备。一边担心被留下，一边在对方真的走近时想退开。关系里容易出现拉近又推开。不是不在乎，而是在乎和防备一起上来。",
  },
  {
    id: "preoccupied",
    name: "专注型",
    a: 3.9246754,
    b: 9.7102446,
    c: -28.4573220,
    short: "想靠近，又怕自己不够被在乎。",
    text: "你愿意靠近，也常常希望靠得更近。对方回应变少、注意不够、或者人不在身边时，不安来得比较快。你会想再确认一次，或者把关系拉紧一点。",
  },
  {
    id: "dismissing",
    name: "冷漠型",
    a: 7.3654621,
    b: 4.9392039,
    c: -22.2281088,
    short: "不太怕被丢下，但怕靠得太近。",
    text: "“会不会被丢掉”不太缠着你，但过度亲近、依赖和掏心会让你不自在。你更习惯自己扛，也更需要一点距离。对方若一直要求更多情绪上的靠近，你会想往后退。",
  },
];

const SIDE_LABEL = {
  low: "低于中点",
  mid: "处于中点",
  high: "高于中点",
};

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function scoredValue(itemNumber, raw) {
  return REVERSE.has(itemNumber) ? 8 - raw : raw;
}

function sideOf(mean) {
  if (mean < MIDPOINT) return "low";
  if (mean > MIDPOINT) return "high";
  return "mid";
}

function assertAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT) {
    throw new Error("需要 36 道题的作答");
  }
  answers.forEach((value, index) => {
    if (!Number.isInteger(value) || value < 1 || value > 7) {
      throw new Error(`第 ${index + 1} 题的分数无效`);
    }
  });
}

function quadrantId(avoidance, anxiety) {
  if (avoidance === MIDPOINT || anxiety === MIDPOINT) return null;
  if (avoidance < MIDPOINT && anxiety < MIDPOINT) return "secure";
  if (avoidance < MIDPOINT && anxiety > MIDPOINT) return "preoccupied";
  if (avoidance > MIDPOINT && anxiety < MIDPOINT) return "dismissing";
  return "fearful";
}

export function scoreEcr(answers) {
  assertAnswers(answers);
  const scored = answers.map((raw, index) => scoredValue(index + 1, raw));
  const dimensions = DIMENSIONS.map((dimension) => {
    const values = dimension.items.map((n) => scored[n - 1]);
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const level = sideOf(mean);
    return {
      id: dimension.id,
      name: dimension.name,
      about: dimension.about,
      count: dimension.items.length,
      sum,
      mean: round2(mean),
      exactMean: mean,
      level,
      levelLabel: SIDE_LABEL[level],
      narrative: dimension.levels[level],
    };
  });
  const avoidance = dimensions.find((dimension) => dimension.id === "avoidance");
  const anxiety = dimensions.find((dimension) => dimension.id === "anxiety");
  const types = TYPES.map((type) => ({
    id: type.id,
    name: type.name,
    short: type.short,
    text: type.text,
    m: avoidance.exactMean * type.a + anxiety.exactMean * type.b + type.c,
  }));
  const max = Math.max(...types.map((type) => type.m));
  const winners = types.filter((type) => Math.abs(type.m - max) < 1e-8);
  const ranked = [...types].sort((left, right) => right.m - left.m);
  const margin = ranked[0].m - ranked[1].m;
  const quadrant = quadrantId(avoidance.exactMean, anxiety.exactMean);
  const quadrantType = TYPES.find((type) => type.id === quadrant) ?? null;
  return {
    dimensions,
    avoidance,
    anxiety,
    types: types.map((type) => ({
      ...type,
      m: round2(type.m),
      exactM: type.m,
      win: winners.some((winner) => winner.id === type.id),
    })),
    type: {
      id: winners[0].id,
      name: winners.map((winner) => winner.name).join("、"),
      short: winners.length === 1 ? winners[0].short : "两个类型的判别分相同。",
      text: winners.map((winner) => winner.text).join(""),
    },
    tied: winners.length > 1,
    margin: round2(margin),
    closeCall: margin < 0.5,
    nearMidpoint: Math.abs(avoidance.exactMean - MIDPOINT) < 0.25
      && Math.abs(anxiety.exactMean - MIDPOINT) < 0.25,
    quadrant,
    quadrantName: quadrantType?.name ?? null,
    differsFromQuadrant: quadrant != null && !winners.some((winner) => winner.id === quadrant),
    scored,
  };
}

export function ecrFlags(scored) {
  const flags = [scored.type.id];
  if (scored.tied) flags.push("tied");
  if (scored.closeCall) flags.push("close-call");
  if (scored.nearMidpoint) flags.push("near-midpoint");
  if (scored.differsFromQuadrant) flags.push("differs-from-quadrant");
  return flags;
}

export function ecrDimension(dimension) {
  return {
    id: dimension.id,
    name: dimension.name,
    kind: "score",
    score: dimension.mean,
    raw: dimension.sum,
    max: 7,
    level: dimension.level,
    levelLabel: dimension.levelLabel,
    narrative: dimension.narrative,
    labels: [],
  };
}

function axisView(dimension) {
  return {
    id: dimension.id,
    name: dimension.name,
    sum: dimension.sum,
    mean: dimension.mean,
    level: dimension.level,
    levelLabel: dimension.levelLabel,
  };
}

export function ecrViewModel(scored, answers, rushed) {
  return {
    answers: answers.slice(),
    avoidance: axisView(scored.avoidance),
    anxiety: axisView(scored.anxiety),
    types: scored.types.map((type) => ({
      id: type.id,
      name: type.name,
      m: type.m,
      win: type.win,
    })),
    type: {
      id: scored.type.id,
      name: scored.type.name,
      short: scored.type.short,
    },
    tied: scored.tied,
    margin: scored.margin,
    closeCall: scored.closeCall,
    nearMidpoint: scored.nearMidpoint,
    quadrant: scored.quadrant,
    quadrantName: scored.quadrantName,
    differsFromQuadrant: scored.differsFromQuadrant,
    rushed: Boolean(rushed),
  };
}

export function ecrOutcome(scored) {
  return {
    headline: `${scored.type.name}：${scored.type.short}`,
    code: scored.tied ? "tied" : scored.type.id,
    label: scored.type.name,
    summary: scored.type.text,
    flags: ecrFlags(scored),
  };
}

/** 霍兰德兴趣探索计分。60 题、六维分数、holland_code、structure、bands、ranking
 * 与 holland-explore `js/engine.js` 的 HollandEngine.compute 一致。
 * 题序固定为 R I A S E C 循环 10 遍，下标 0 是 Q01。
 * 云端不保存作答用时，因此 quality 不含 FAST_RESPONSE，也没有 median_ms。
 */
export const QUESTION_COUNT = 60;
export const HOLLAND_VERSION = "holland-h5-v1";
export const HOLLAND_CONSENT_VERSION = "consent-assessment-holland-1";
export const HOLLAND_ID = "holland";
export const HOLLAND_NAME = "霍兰德兴趣探索";
export const HOLLAND_SCORE_VERSION = "RIASEC_V2";
export const HOLLAND_SCREEN = "这是兴趣探索，不是职业诊断，也不说明哪种类型更好。";
export const HOLLAND_READER_GAP = "阅读页若尚未重绘霍兰德兴趣探索，RIASEC 分数、holland_code、structure、bands 与 ranking 在 extensionData.score 与 viewModel。";

export const DIMS = ["R", "I", "A", "S", "E", "C"];
export const LETTER_NAME = { R: "实际", I: "研究", A: "艺术", S: "社会", E: "企业", C: "常规" };
export const LETTER_LINE = {
  R: "喜欢动手，把想法变成看得见的东西。",
  I: "喜欢追问为什么，把事情弄明白。",
  A: "喜欢创造、表达和想象。",
  S: "喜欢跟人连接，陪人成长。",
  E: "喜欢推动事情发生，影响结果。",
  C: "喜欢把混乱整理成清楚、有序的样子。",
};

const LOW_VAR_RATIO = 0.9;
const UNSURE_RATIO = 0.4;
const NEAR_TIE = 5;
const BREADTH_GAP = 10;

export const Q2_OPTIONS = ["学一种东西", "做一个作品", "帮助一些人", "深入研究一个主题", "做一个自己的项目", "整理和改善生活", "去真实世界体验", "还没想清楚"];
export const Q3_OPTIONS = ["更理解自己", "找到兴趣方向", "学习方式", "发挥优势", "兴趣爱好", "关系与协作", "专业选择", "工作与职业", "转型方向", "暂时只是好奇"];

const PHONE_VALUE = /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/;
const EXPLORE_KEYS = ["q1", "q2", "q2other", "q3"];

function r1(value) {
  return Math.round(value * 10) / 10;
}

function hexDist(a, b) {
  const d = Math.abs(DIMS.indexOf(a) - DIMS.indexOf(b));
  return Math.min(d, 6 - d);
}

export function hollandAnswersOk(list) {
  return Array.isArray(list)
    && list.length === QUESTION_COUNT
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
}

/** 页面用 Q01–Q60 对象。合成器可收下这个对象，存档时一律改成按题号排列的数组。校验只接受数组。 */
export function coerceHollandAnswers(input) {
  if (hollandAnswersOk(input)) return input.slice();
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const list = Array.from({ length: QUESTION_COUNT }, (_, index) => {
    const key = `Q${String(index + 1).padStart(2, "0")}`;
    return input[key];
  });
  return hollandAnswersOk(list) ? list : null;
}

export function emptyExplore() {
  return { q1: "", q2: [], q2other: "", q3: [] };
}

export function hollandExploreOk(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== EXPLORE_KEYS.length || EXPLORE_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    return false;
  }
  if (typeof value.q1 !== "string" || Array.from(value.q1).length > 400) return false;
  if (typeof value.q2other !== "string" || Array.from(value.q2other).length > 80) return false;
  if (PHONE_VALUE.test(value.q1) || PHONE_VALUE.test(value.q2other)) return false;
  if (!optionListOk(value.q2, Q2_OPTIONS) || !optionListOk(value.q3, Q3_OPTIONS)) return false;
  return true;
}

function optionListOk(list, allowed) {
  if (!Array.isArray(list) || list.length > allowed.length) return false;
  if (new Set(list).size !== list.length) return false;
  return list.every((item) => typeof item === "string" && allowed.includes(item));
}

export function scoreHolland(answers) {
  if (!hollandAnswersOk(answers)) throw new Error("作答需要 60 道 1–5 的整数题");
  const raw = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const fives = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const scores = {};
  answers.forEach((value, index) => {
    const dim = DIMS[index % 6];
    raw[dim] += value;
    if (value === 5) fives[dim] += 1;
  });
  DIMS.forEach((dim) => {
    scores[dim] = r1((raw[dim] - 10) / 40 * 100);
  });
  const ranking = DIMS.slice().sort((a, b) => (
    (scores[b] - scores[a]) || (fives[b] - fives[a]) || (DIMS.indexOf(a) - DIMS.indexOf(b))
  ));
  const top = ranking.slice(0, 3);
  const orderedScores = ranking.map((dim) => scores[dim]);
  const dominance = r1(orderedScores[0] - orderedScores[1]);
  const mean = DIMS.reduce((total, dim) => total + scores[dim], 0) / 6;
  const sd = r1(Math.sqrt(DIMS.reduce((total, dim) => total + (scores[dim] - mean) ** 2, 0) / 6));
  const dist = hexDist(ranking[0], ranking[1]);
  const consistency = dist === 1 ? "HIGH" : dist === 2 ? "MEDIUM" : "CROSS";
  const breadth = DIMS.filter((dim) => orderedScores[0] - scores[dim] <= BREADTH_GAP).length;
  const freq = {};
  answers.forEach((value) => {
    freq[value] = (freq[value] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  const quality = [];
  if (maxFreq >= answers.length * LOW_VAR_RATIO) quality.push("LOW_VARIANCE");
  if ((freq[3] || 0) >= answers.length * UNSURE_RATIO) quality.push("MANY_UNSURE");
  return {
    version: HOLLAND_SCORE_VERSION,
    scores: { ...scores },
    raw: { ...raw },
    top_dimensions: top,
    holland_code: top.join(""),
    structure: {
      dominance,
      near_tie_top12: Math.abs(orderedScores[0] - orderedScores[1]) <= NEAR_TIE,
      near_tie_top34: Math.abs(orderedScores[2] - orderedScores[3]) <= NEAR_TIE,
      differentiation: sd,
      consistency,
      breadth,
    },
    bands: {
      dominance: dominance < 5 ? "DUAL" : dominance < 12 ? "SOME" : "PROMINENT",
      differentiation: sd < 10 ? "LOW" : sd <= 20 ? "MID" : "HIGH",
      breadth: breadth <= 1 ? "ONE" : breadth <= 3 ? "FEW" : "MANY",
    },
    ranking,
    quality,
  };
}

const DOM_TEXT = {
  DUAL: "前两个兴趣几乎一样高，可以看成双核心。",
  SOME: "第一兴趣比第二兴趣高出一截，主次还在。",
  PROMINENT: "第一兴趣明显高出第二兴趣。",
};
const DIF_TEXT = {
  LOW: "六个方向比较均衡，区分还不明显。",
  MID: "六个方向有一定区分。",
  HIGH: "六个方向分得比较开。",
};
const CON_TEXT = {
  HIGH: "前两个兴趣在六边形上相邻。",
  MEDIUM: "前两个兴趣在六边形上隔了一位。",
  CROSS: "前两个兴趣在六边形上相对，是跨界组合。",
};
const BREADTH_TEXT = {
  ONE: "和第一兴趣接近的方向比较集中。",
  FEW: "有少数几个兴趣中心。",
  MANY: "和第一兴趣接近的方向比较宽。",
};
const DOM_LABEL = { DUAL: "双核心", SOME: "有主次", PROMINENT: "第一兴趣突出" };
const DIF_LABEL = { LOW: "比较均衡", MID: "有一定区分", HIGH: "区分清楚" };
const CON_LABEL = { HIGH: "相邻", MEDIUM: "隔一位", CROSS: "跨界" };
const BREADTH_LABEL = { ONE: "比较集中", FEW: "有几个中心", MANY: "比较宽" };

function copyScore(scored) {
  return {
    version: scored.version,
    scores: { ...scored.scores },
    raw: { ...scored.raw },
    top_dimensions: scored.top_dimensions.slice(),
    holland_code: scored.holland_code,
    structure: { ...scored.structure },
    bands: { ...scored.bands },
    ranking: scored.ranking.slice(),
    quality: scored.quality.slice(),
  };
}

export function hollandDimensions(scored) {
  return DIMS.map((id) => ({
    id,
    name: LETTER_NAME[id],
    kind: "score",
    score: scored.scores[id],
    raw: scored.raw[id],
    max: 100,
    level: null,
    levelLabel: null,
    narrative: LETTER_LINE[id],
    labels: [],
  }));
}

export function hollandOutcome(scored) {
  const names = scored.top_dimensions.map((id) => `${LETTER_NAME[id]} ${id}`).join(" × ");
  return {
    headline: `核心兴趣组合：${scored.holland_code}`,
    code: scored.holland_code,
    label: names,
    summary: `${names}。${DOM_TEXT[scored.bands.dominance]}${CON_TEXT[scored.structure.consistency]}${HOLLAND_SCREEN}`,
    flags: scored.quality.slice(),
  };
}

export function hollandInterpretation(scored) {
  const outcome = hollandOutcome(scored);
  const blocks = [
    { id: "verdict", title: outcome.headline, text: outcome.summary },
    { id: "screen", title: "不是诊断", text: HOLLAND_SCREEN },
    { id: "dominance", title: "主次", text: `${DOM_LABEL[scored.bands.dominance]}。${DOM_TEXT[scored.bands.dominance]}` },
    { id: "differentiation", title: "区分度", text: `${DIF_LABEL[scored.bands.differentiation]}。${DIF_TEXT[scored.bands.differentiation]}` },
    { id: "consistency", title: "一致性", text: `${CON_LABEL[scored.structure.consistency]}。${CON_TEXT[scored.structure.consistency]}` },
    { id: "breadth", title: "广度", text: `${BREADTH_LABEL[scored.bands.breadth]}。${BREADTH_TEXT[scored.bands.breadth]}` },
  ];
  for (const id of scored.ranking) {
    blocks.push({
      id,
      title: `${LETTER_NAME[id]} ${id}`,
      text: `${scored.scores[id]} 分。${LETTER_LINE[id]}`,
    });
  }
  return blocks;
}

export function hollandRecommendations() {
  return [
    { id: "screen", title: null, text: HOLLAND_SCREEN },
    { id: "reader", title: null, text: HOLLAND_READER_GAP },
  ];
}

export function hollandViewModel(scored, answers, explore, rushed) {
  return {
    answers: answers.slice(),
    ...copyScore(scored),
    explore: {
      q1: explore.q1,
      q2: explore.q2.slice(),
      q2other: explore.q2other,
      q3: explore.q3.slice(),
    },
    rushed: Boolean(rushed),
  };
}

export function hollandSections(scored) {
  const outcome = hollandOutcome(scored);
  const lines = scored.ranking.map((id) => `${LETTER_NAME[id]} ${id} ${scored.scores[id]}`).join(" · ");
  return [
    { t: "h", l: 2, x: outcome.headline },
    { t: "p", x: outcome.summary },
    { t: "p", x: HOLLAND_SCREEN },
    { t: "p", x: lines },
  ];
}

export function hollandBodyParts(answers, explore, rushed) {
  if (!hollandExploreOk(explore)) throw new Error("探索题格式不对");
  const scored = scoreHolland(answers);
  const sections = hollandSections(scored);
  return {
    dimensions: hollandDimensions(scored),
    result: hollandOutcome(scored),
    interpretation: hollandInterpretation(scored),
    recommendations: hollandRecommendations(),
    reportContent: {
      format: "view-model+sections",
      viewModel: hollandViewModel(scored, answers, explore, rushed),
      sections,
      textFallback: sections.map((section) => section.x).join(""),
    },
    score: copyScore(scored),
    openText: {
      q1: explore.q1,
      q2: explore.q2.slice(),
      q2other: explore.q2other,
      q3: explore.q3.slice(),
    },
  };
}

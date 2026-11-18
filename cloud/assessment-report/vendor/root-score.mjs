/** 寻根之旅 · 生命成长地图计分。加权、反向题、15–92 压缩和空情境记 0，与 root-journey-web FamilyPatternTest.calculate 一致。家庭氛围五题不进入能力分。发展题只核范围，不在这里推发展阶段。 */
export const LIFE_MAP_COUNT = 33;
export const ABILITY_COUNT = 28;
export const CLIMATE_COUNT = 5;
export const DEVELOPMENT_COUNT = 4;
export const ROOT_VERSION = "root-h5-v1";
export const ROOT_CONSENT_VERSION = "consent-assessment-root-1";
export const ROOT_ID = "root";
export const ROOT_SCREEN_TEXT = "分数用于观察相对状态，不代表医学或人格诊断。这份结果不保存电话，也不保存父母档案或原文。";
export const ROOT_READER_GAP = "阅读页若尚未重绘寻根之旅，生命成长地图在 interpretation、sections 与 textFallback。父母档案与电话不在这份结果里。";

const ITEM_TYPES = ["baseline", "stress", "action", "validation"];

export const ABILITIES = [
  { id: "self_awareness", name: "自我认知", moduleId: "subjectivity", explanation: "了解自己是谁、真正想要什么，并能够辨认自己的需要与价值取向。" },
  { id: "autonomy_boundary", name: "自主边界", moduleId: "subjectivity", explanation: "能够为自己做选择并承担责任，同时区分自己与他人的需要、情绪与责任。" },
  { id: "emotion_awareness", name: "情绪觉察", moduleId: "emotion", explanation: "能够感知、辨认并理解自己的情绪，以及情绪背后正在发生什么。" },
  { id: "emotional_independence", name: "情感独立", moduleId: "emotion", explanation: "在重要关系中既能够保持连接，也能够维持自己的判断、生活重心和内在稳定。" },
  { id: "listening_understanding", name: "倾听理解", moduleId: "relationship", explanation: "能够暂时放下自己的立场，理解他人的观点、感受、需要与行为。" },
  { id: "gentle_expression", name: "柔和表达", moduleId: "relationship", explanation: "能够真实而有边界地表达自己，并在分歧和冲突中促进理解与修复。" },
  { id: "self_worth", name: "自我价值感", moduleId: "value", explanation: "对自身价值具有相对稳定的感受，不完全依赖成绩、身份或他人认可。" },
  { id: "value_realization", name: "价值实现力", moduleId: "value", explanation: "能够识别自己的能力与价值，并逐步将其转化为行动、贡献与现实结果。" },
];

export const MODULES = [
  { id: "subjectivity", name: "主体性", abilities: ["self_awareness", "autonomy_boundary"], narrative: "主体性看你如何认识自己，并守住自己的选择。" },
  { id: "emotion", name: "情感力", abilities: ["emotion_awareness", "emotional_independence"], narrative: "情感力看你如何觉察情绪，并在关系里回到自己的生活。" },
  { id: "relationship", name: "关系力", abilities: ["listening_understanding", "gentle_expression"], narrative: "关系力看你如何听懂别人，并真实、有边界地表达。" },
  { id: "value", name: "价值力", abilities: ["self_worth", "value_realization"], narrative: "价值力看你如何感受自身价值，并把它做成现实里的事。" },
];

export const CLIMATES = [
  { id: "high_expectation", name: "高期待" },
  { id: "emotional_suppression", name: "情感压抑" },
  { id: "control_intervention", name: "控制干预" },
  { id: "criticism", name: "批评指责" },
  { id: "warmth", name: "温暖支持" },
];

export const DEVELOPMENT = [
  { id: "initiative", name: "主动与行动" },
  { id: "identity", name: "身份与主体" },
  { id: "intimacy", name: "亲密与互惠" },
  { id: "generativity", name: "创造与生成" },
];

function item(primary, type, reverse, secondary) {
  return { primary, type, reverse, secondary };
}

/** Q01–Q28，顺序与 FamilyPatternTest.lifeMapQuestions 相同。反向题用 6 减原分。 */
export const ABILITY_ITEMS = [
  item("self_awareness", "baseline", false, [{ dimension: "autonomy_boundary", weight: .25 }]),
  item("self_awareness", "stress", true, [{ dimension: "self_worth", weight: .1 }]),
  item("self_awareness", "action", false, [{ dimension: "value_realization", weight: .25 }]),
  item("autonomy_boundary", "baseline", false, [{ dimension: "self_awareness", weight: .25 }]),
  item("autonomy_boundary", "stress", false, [{ dimension: "emotional_independence", weight: .25 }, { dimension: "self_worth", weight: .1 }]),
  item("autonomy_boundary", "action", false, [{ dimension: "gentle_expression", weight: .25 }]),
  item("autonomy_boundary", "validation", true, [{ dimension: "emotional_independence", weight: .25 }]),
  item("emotion_awareness", "baseline", false, [{ dimension: "gentle_expression", weight: .1 }]),
  item("emotion_awareness", "stress", true, [{ dimension: "emotional_independence", weight: .25 }]),
  item("emotion_awareness", "action", false, [{ dimension: "gentle_expression", weight: .25 }]),
  item("emotional_independence", "baseline", false, [{ dimension: "autonomy_boundary", weight: .25 }]),
  item("emotional_independence", "stress", true, [{ dimension: "self_worth", weight: .25 }]),
  item("emotional_independence", "action", false, [{ dimension: "gentle_expression", weight: .25 }]),
  item("emotional_independence", "validation", false, [{ dimension: "emotion_awareness", weight: .1 }]),
  item("listening_understanding", "baseline", false, [{ dimension: "gentle_expression", weight: .25 }]),
  item("listening_understanding", "stress", false, [{ dimension: "emotion_awareness", weight: .25 }]),
  item("listening_understanding", "action", false, [{ dimension: "gentle_expression", weight: .1 }]),
  item("gentle_expression", "baseline", false, [{ dimension: "emotion_awareness", weight: .25 }]),
  item("gentle_expression", "stress", true, [{ dimension: "listening_understanding", weight: .25 }]),
  item("gentle_expression", "action", false, [{ dimension: "autonomy_boundary", weight: .1 }]),
  item("gentle_expression", "validation", false, [{ dimension: "listening_understanding", weight: .25 }]),
  item("self_worth", "baseline", false, [{ dimension: "emotional_independence", weight: .25 }]),
  item("self_worth", "stress", true, [{ dimension: "autonomy_boundary", weight: .25 }]),
  item("self_worth", "action", false, [{ dimension: "value_realization", weight: .1 }]),
  item("value_realization", "baseline", false, [{ dimension: "self_awareness", weight: .25 }]),
  item("value_realization", "action", false, [{ dimension: "autonomy_boundary", weight: .1 }]),
  item("value_realization", "stress", true, [{ dimension: "self_worth", weight: .25 }]),
  item("value_realization", "validation", false, [{ dimension: "self_awareness", weight: .1 }]),
];

const ABILITY_IDS = new Set(ABILITIES.map((ability) => ability.id));
for (const entry of ABILITY_ITEMS) {
  if (!ABILITY_IDS.has(entry.primary)) throw new Error(`未知主维度 ${entry.primary}`);
  for (const secondary of entry.secondary) {
    if (!ABILITY_IDS.has(secondary.dimension)) throw new Error(`未知副维度 ${secondary.dimension}`);
  }
}

function likertList(list, length) {
  return Array.isArray(list)
    && list.length === length
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
}

export function lifeMapAnswersOk(list) {
  return likertList(list, LIFE_MAP_COUNT);
}

export function developmentAnswersOk(list) {
  return likertList(list, DEVELOPMENT_COUNT);
}

export function rootStatus(score) {
  if (score >= 85) return { id: "strong", label: "优势明显" };
  if (score >= 75) return { id: "good", label: "发展较好" };
  if (score >= 65) return { id: "stable", label: "较为稳定" };
  if (score >= 55) return { id: "room", label: "有提升空间" };
  if (score >= 45) return { id: "watch", label: "值得关注" };
  if (score >= 35) return { id: "focus", label: "当前成长重点" };
  return { id: "explore", label: "值得深入探索" };
}

export function climateLevel(value) {
  return ["很少", "较少", "一般", "较明显", "明显"][Math.max(0, Math.min(4, value - 1))];
}

export function scoreRoot(answers) {
  if (!lifeMapAnswersOk(answers)) throw new Error("作答需要 33 道 1–5 的整数题");
  const dimensionScores = {};
  const contextVariances = {};
  for (const ability of ABILITIES) {
    const entries = [];
    ABILITY_ITEMS.forEach((entry, index) => {
      const value = ((entry.reverse ? 6 - answers[index] : answers[index]) - 1) / 4;
      if (entry.primary === ability.id) entries.push({ value, weight: 1, type: entry.type });
      for (const secondary of entry.secondary) {
        if (secondary.dimension === ability.id) entries.push({ value, weight: secondary.weight, type: entry.type });
      }
    });
    const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const raw = entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weightSum * 100;
    dimensionScores[ability.id] = Math.round(Math.min(92, Math.max(15, 50 + .84 * (raw - 50))));
    const contextual = ITEM_TYPES.map((type) => {
      const grouped = entries.filter((entry) => entry.type === type);
      return grouped.reduce((sum, entry, _index, list) => sum + entry.value / list.length, 0) * 100;
    }).filter((value) => Number.isFinite(value));
    const gap = contextual.length ? Math.max(...contextual) - Math.min(...contextual) : 0;
    contextVariances[ability.id] = gap >= 25 ? "high" : gap >= 13 ? "medium" : "low";
  }
  const moduleScores = {};
  for (const module of MODULES) {
    const values = module.abilities.map((id) => dimensionScores[id]);
    moduleScores[module.id] = Math.round((values[0] + values[1]) / 2);
  }
  return { dimensionScores, moduleScores, contextVariances };
}

function rankedAbilities(scored) {
  return ABILITIES
    .map((ability) => ({ ...ability, score: scored.dimensionScores[ability.id] }))
    .sort((left, right) => right.score - left.score);
}

export function rootFlags(scored) {
  return ABILITIES
    .filter((ability) => scored.contextVariances[ability.id] === "high")
    .map((ability) => `variance-high:${ability.id}`);
}

export function rootOutcome(scored) {
  const ranked = rankedAbilities(scored);
  const top = ranked.slice(0, 2).map((ability) => ability.name).join("与");
  const low = ranked[ranked.length - 1];
  return {
    headline: "我的生命成长地图",
    code: null,
    label: "自我探索 · 非诊断",
    summary: `较突出的是${top}；相对更值得继续发展的是${low.name}。${ROOT_SCREEN_TEXT}`,
    flags: rootFlags(scored),
  };
}

function abilityDimension(ability, scored) {
  const status = rootStatus(scored.dimensionScores[ability.id]);
  return {
    id: ability.id,
    name: ability.name,
    kind: "score",
    score: scored.dimensionScores[ability.id],
    max: 100,
    level: status.id,
    levelLabel: status.label,
    narrative: ability.explanation,
    labels: [],
    extra: {
      moduleId: ability.moduleId,
      contextVariance: scored.contextVariances[ability.id],
    },
  };
}

function moduleDimension(module, scored) {
  const status = rootStatus(scored.moduleScores[module.id]);
  return {
    id: module.id,
    name: module.name,
    kind: "score",
    score: scored.moduleScores[module.id],
    max: 100,
    level: status.id,
    levelLabel: status.label,
    narrative: module.narrative,
    labels: [],
    extra: { abilities: module.abilities.slice() },
  };
}

export function rootDimensions(scored) {
  return ABILITIES.map((ability) => abilityDimension(ability, scored))
    .concat(MODULES.map((module) => moduleDimension(module, scored)));
}

export function rootFamilyClimate(answers) {
  return CLIMATES.map((climate, index) => ({
    id: climate.id,
    name: climate.name,
    value: answers[ABILITY_COUNT + index],
    levelLabel: climateLevel(answers[ABILITY_COUNT + index]),
  }));
}

function climateLine(answers) {
  const text = rootFamilyClimate(answers)
    .map((climate) => `${climate.name} ${climate.levelLabel}`)
    .join("，");
  return `家庭氛围：${text}。这五档是主观体验，不是对家人的评价。`;
}

export function rootInterpretation(scored, answers) {
  const outcome = rootOutcome(scored);
  const blocks = [
    { id: "verdict", title: outcome.headline, text: outcome.summary },
    { id: "screen", title: "不是诊断", text: ROOT_SCREEN_TEXT },
  ];
  for (const ability of ABILITIES) {
    const score = scored.dimensionScores[ability.id];
    const status = rootStatus(score);
    blocks.push({
      id: ability.id,
      title: ability.name,
      text: `${status.label}，${score} 分。${ability.explanation}`,
    });
  }
  for (const module of MODULES) {
    const score = scored.moduleScores[module.id];
    const status = rootStatus(score);
    blocks.push({
      id: module.id,
      title: module.name,
      text: `${status.label}，${score} 分。${module.narrative}`,
    });
  }
  blocks.push({ id: "climate", title: "家庭氛围", text: climateLine(answers) });
  return blocks;
}

export function rootRecommendations() {
  return [
    { id: "screen", title: null, text: ROOT_SCREEN_TEXT },
    { id: "reader", title: null, text: ROOT_READER_GAP },
  ];
}

export function rootViewModel(scored, answers, developmentAnswers, rushed) {
  return {
    answers: answers.slice(),
    developmentAnswers: developmentAnswers.slice(),
    abilities: ABILITIES.map((ability) => {
      const status = rootStatus(scored.dimensionScores[ability.id]);
      return {
        id: ability.id,
        name: ability.name,
        score: scored.dimensionScores[ability.id],
        level: status.id,
        levelLabel: status.label,
        contextVariance: scored.contextVariances[ability.id],
        moduleId: ability.moduleId,
      };
    }),
    modules: MODULES.map((module) => {
      const status = rootStatus(scored.moduleScores[module.id]);
      return {
        id: module.id,
        name: module.name,
        score: scored.moduleScores[module.id],
        level: status.id,
        levelLabel: status.label,
      };
    }),
    familyClimate: rootFamilyClimate(answers),
    development: DEVELOPMENT.map((item, index) => ({
      id: item.id,
      name: item.name,
      value: developmentAnswers[index],
    })),
    rushed: Boolean(rushed),
  };
}

export function rootSections(scored, answers) {
  const outcome = rootOutcome(scored);
  const abilities = ABILITIES
    .map((ability) => `${ability.name} ${scored.dimensionScores[ability.id]} 分，${rootStatus(scored.dimensionScores[ability.id]).label}`)
    .join("。");
  const modules = MODULES
    .map((module) => `${module.name} ${scored.moduleScores[module.id]} 分，${rootStatus(scored.moduleScores[module.id]).label}`)
    .join("。");
  return [
    { t: "h", l: 2, x: outcome.headline },
    { t: "p", x: outcome.summary },
    { t: "p", x: ROOT_SCREEN_TEXT },
    { t: "p", x: `${abilities}。` },
    { t: "p", x: `${modules}。` },
    { t: "p", x: climateLine(answers) },
  ];
}

export function rootTextFallback(scored, answers) {
  return rootSections(scored, answers).map((section) => section.x).join("");
}

export function rootStoredScore(scored, answers) {
  return {
    dimensionScores: { ...scored.dimensionScores },
    moduleScores: { ...scored.moduleScores },
    contextVariances: { ...scored.contextVariances },
    familyClimate: answers.slice(ABILITY_COUNT, LIFE_MAP_COUNT),
  };
}

export function rootBodyParts(answers, developmentAnswers, rushed) {
  const scored = scoreRoot(answers);
  return {
    dimensions: rootDimensions(scored),
    result: rootOutcome(scored),
    interpretation: rootInterpretation(scored, answers),
    recommendations: rootRecommendations(),
    reportContent: {
      format: "view-model+sections",
      viewModel: rootViewModel(scored, answers, developmentAnswers, rushed),
      sections: rootSections(scored, answers),
      textFallback: rootTextFallback(scored, answers),
    },
    score: rootStoredScore(scored, answers),
  };
}

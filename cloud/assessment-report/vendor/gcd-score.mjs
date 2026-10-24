/** 个人充电计分。与 geren-chongdian `js/engine.js` 读 `js/rules.js` 的结果相同。
 * 今日电量 = clamp(round(状态基础电量 − 所选来源耗电值之和), 0, 100)。
 * 维度耗电、耗电链路、修复动作、场域和关系训练的挑选规则也不改。
 * dayIndex 与页面 `Math.floor(Date.UTC(y, m-1, d) / 86400000)` 相同，用来打破并列。
 * customText 不接收、不保存。自己写的状态若没对上关键词，只记 customUnmatched，原文留在做题的设备上。
 * 对上关键词时，前端先解析成对应 stateId 再提交，不要带原句。
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Engine = require("./gcd/engine.cjs");
const RULES = require("./gcd/rules.cjs");

export const GCD_VERSION = "gcd-h5-v1";
export const GCD_CONSENT_VERSION = "consent-assessment-gcd-1";
export const GCD_ID = "gcd";
export const GCD_NAME = "个人充电";
export const GCD_READER_GAP = "阅读页若尚未重绘个人充电，电量、四维耗电、耗电链路和今天的小修复在 dimensions、result 与 viewModel。自己写的原句不保存。";
export const GCD_UNMATCHED_LABEL = "自己写的状态";
const UNMATCHED_PROBE = "未保存的自拟";

export const GCD_STATE_IDS = RULES.states.map((item) => item.id);
export const GCD_SOURCE_IDS = RULES.sources.map((item) => item.id);

function stateById(id) {
  return RULES.states.find((item) => item.id === id) || null;
}

export function gcdDayOk(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3000000;
}

export function gcdInputOk(input) {
  if (!input || typeof input !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(input, "customText")) return false;
  if (!gcdDayOk(input.dayIndex)) return false;
  if (!Array.isArray(input.sourceIds) || input.sourceIds.length > RULES.formula.maxSources) return false;
  if (new Set(input.sourceIds).size !== input.sourceIds.length) return false;
  if (input.sourceIds.some((id) => !GCD_SOURCE_IDS.includes(id))) return false;
  const unmatched = input.customUnmatched === true;
  if (unmatched) return input.stateId == null;
  return typeof input.stateId === "string" && Boolean(stateById(input.stateId));
}

function shortLabel(label) {
  return String(label || "").split("：")[0];
}

function chainView(stage) {
  return RULES.chain.map((item) => ({
    key: item.key,
    name: item.name,
    sub: item.sub,
    on: item.key === stage,
    now: item.now,
    next: item.next,
    cut: item.cut,
  }));
}

export function scoreGcd(input) {
  if (!gcdInputOk(input)) throw new Error("个人充电的状态或耗电来源不对");
  if (Engine.matchCustom(UNMATCHED_PROBE)) throw new Error("占位句对上了关键词");
  const unmatched = input.customUnmatched === true;
  const computed = Engine.compute({
    stateId: unmatched ? null : input.stateId,
    customText: unmatched ? UNMATCHED_PROBE : "",
    sourceIds: input.sourceIds.slice(),
    dayIndex: input.dayIndex,
  });
  if (unmatched && !computed.customUnmatched) throw new Error("自己写的状态被当成了预设");
  if (!unmatched && computed.stateId !== input.stateId) throw new Error("状态对不上");
  const stateLabel = unmatched ? GCD_UNMATCHED_LABEL : computed.stateLabel;
  return { ...computed, stateLabel, customUnmatched: unmatched, customMatched: false };
}

export function gcdBodyParts(input, rushed) {
  const scored = scoreGcd(input);
  const stageKey = scored.stage || "none";
  const insightDim = scored.sources.length ? RULES.insights.dim[scored.topDim] : RULES.insights.noDrain;
  const insight = {
    band: RULES.insights.band[scored.band.key].replace("{n}", String(scored.score)),
    dim: insightDim,
    check: RULES.insights.check[stageKey],
    shift: RULES.insights.shift,
    disclaimer: RULES.insights.disclaimer,
  };
  const dims = {};
  const dimLevels = {};
  for (const dim of RULES.dims) {
    dims[dim.key] = scored.dims[dim.key];
    dimLevels[dim.key] = Engine.dimLevel(scored.dims[dim.key]);
  }
  const dimensions = [
    {
      id: "battery",
      name: "今日电量",
      kind: "score",
      score: scored.score,
      raw: scored.score,
      max: 100,
      level: scored.band.key,
      levelLabel: scored.band.label,
      narrative: scored.band.tagline,
      labels: [],
    },
    ...RULES.dims.map((dim) => ({
      id: dim.key,
      name: dim.name,
      kind: "score",
      score: dims[dim.key],
      raw: dims[dim.key],
      max: 100,
      level: dimLevels[dim.key],
      levelLabel: dimLevels[dim.key],
      narrative: dim.desc,
      labels: [],
    })),
  ];
  const active = RULES.chain.find((item) => item.key === scored.stage) || null;
  const result = {
    headline: `${scored.score} 分 · ${scored.band.label}`,
    code: scored.band.key,
    label: scored.band.label,
    summary: `${scored.band.tagline}${active ? active.now : "今天你的电没有明显落在耗电链路上。"}`,
    flags: scored.low ? ["low"] : [],
  };
  const actions = scored.actions.map((item) => {
    const step = RULES.steps[item.step - 1];
    const source = RULES.chargeSources[item.src];
    return {
      id: item.id,
      step: item.step,
      stepName: step.name,
      minutes: item.minutes,
      title: item.title,
      how: item.how.slice(),
      why: item.why,
      srcName: source.name,
    };
  });
  const fields = scored.fields.map((item) => ({
    id: item.id,
    title: item.title,
    why: item.why,
    use: item.use,
  }));
  const trainings = scored.trainings.map((item) => ({
    id: item.id,
    title: item.title,
    when: item.when,
    steps: item.steps.slice(),
    say: item.say,
  }));
  const viewModel = {
    score: scored.score,
    band: {
      key: scored.band.key,
      label: scored.band.label,
      min: scored.band.min,
      max: scored.band.max,
      tagline: scored.band.tagline,
    },
    base: scored.base,
    totalDrain: scored.totalDrain,
    stateId: scored.stateId,
    stateLabel: scored.stateLabel,
    stateLine: `你说的状态：${scored.stateLabel}${scored.customUnmatched ? `（没认出具体意思，按中间值 ${scored.base} 起算）` : ""}`,
    customUnmatched: scored.customUnmatched,
    sourceIds: input.sourceIds.slice(),
    sourceLabels: scored.sources.map((item) => shortLabel(item.label)),
    dims,
    dimLevels,
    dimMeta: RULES.dims.map((dim) => ({ key: dim.key, name: dim.name, desc: dim.desc })),
    topDim: scored.topDim,
    stage: scored.stage,
    low: scored.low,
    chain: chainView(scored.stage),
    insight,
    actions,
    steps: RULES.steps.map((step) => ({
      n: step.n,
      name: step.name,
      on: actions.some((item) => item.step === step.n),
    })),
    fields,
    fieldAvoid: RULES.fieldAvoid[stageKey],
    trainings,
    coreLine: RULES.copy.coreLine,
    dayIndex: input.dayIndex,
    rushed: Boolean(rushed),
  };
  const interpretation = [
    { id: "tagline", title: scored.band.label, text: scored.band.tagline },
    { id: "band", title: null, text: insight.band },
    { id: "dim", title: null, text: insight.dim },
    { id: "check", title: null, text: insight.check },
    { id: "shift", title: null, text: insight.shift },
    { id: "disclaimer", title: null, text: insight.disclaimer },
  ];
  if (active) {
    interpretation.push({ id: "stage", title: active.name, text: `${active.now}${active.next}${active.cut}` });
  }
  const recommendations = [
    ...actions.map((item, index) => ({
      id: `action-${index + 1}`,
      title: item.title,
      text: item.how.join(""),
    })),
    { id: "core", title: null, text: RULES.copy.coreLine },
    { id: "reader", title: null, text: GCD_READER_GAP },
  ];
  const sections = [
    { t: "h", l: 2, x: result.headline },
    { t: "p", x: result.summary },
    { t: "p", x: `你说的状态：${scored.stateLabel}` },
  ];
  return {
    dimensions,
    result,
    interpretation,
    recommendations,
    reportContent: {
      format: "view-model+sections",
      viewModel,
      sections,
      textFallback: sections.map((section) => section.x).join(""),
    },
    score: {
      score: scored.score,
      band: scored.band.key,
      base: scored.base,
      totalDrain: scored.totalDrain,
      stateId: scored.stateId,
      customUnmatched: scored.customUnmatched,
      sourceIds: input.sourceIds.slice(),
      dims,
      topDim: scored.topDim,
      stage: scored.stage,
      low: scored.low,
      actionIds: actions.map((item) => item.id),
      fieldIds: fields.map((item) => item.id),
      trainingIds: trainings.map((item) => item.id),
      dayIndex: input.dayIndex,
    },
    answers: {
      stateId: scored.customUnmatched ? null : input.stateId,
      customUnmatched: scored.customUnmatched,
      sourceIds: input.sourceIds.slice(),
      dayIndex: input.dayIndex,
    },
  };
}

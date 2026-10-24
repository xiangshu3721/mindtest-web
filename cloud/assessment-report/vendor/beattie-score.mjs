/** 梅洛迪·贝蒂六套情绪测试计分。与 beattie-src `src/lib/scoring.ts` 相同。
 * 评估是 10 道 0–10 的和，选择按选项分，判断按书中的对错（不适用记 10 分）。
 * angerFill 不接收、不保存。六套共用这一套结构，assessmentId 各不相同。
 */
import { getTestById, scoreLikert, scoreMcq, scoreTf, computeTotal, insightFor, readingFor, studyAidNote } from "./beattie-engine.mjs";

export const BEATTIE_READER_GAP = "阅读页若尚未重绘这套情绪测试，总分、评估、选择、判断和分数段在 dimensions、result 与 viewModel。填空不保存。";
export const BEATTIE_DRAMA_NOTE = "悲痛还鲜活时，这套分数容易失真。不确定的话，先做悲痛与失落测试，把引发悲痛的事照顾好，再回来看戏剧化。";

export const BEATTIE_TESTS = [
  { testId: "emotional-health", id: "beattie-emotional-health", name: "情绪健康测试" },
  { testId: "anger", id: "beattie-anger", name: "愤怒测试" },
  { testId: "fear", id: "beattie-fear", name: "恐惧测试" },
  { testId: "drama", id: "beattie-drama", name: "戏剧化与不幸成瘾测试" },
  { testId: "guilt", id: "beattie-guilt", name: "内疚测试" },
  { testId: "grief", id: "beattie-grief", name: "悲痛与失落测试" },
];

const BY_ID = Object.fromEntries(BEATTIE_TESTS.map((item) => [item.id, item]));
const BY_TEST = Object.fromEntries(BEATTIE_TESTS.map((item) => [item.testId, item]));

export function beattieSpec(assessmentId) {
  return BY_ID[assessmentId] || null;
}

export function beattieVersion(assessmentId) {
  return `${assessmentId}-h5-v1`;
}

export function beattieConsent(assessmentId) {
  return `consent-assessment-${assessmentId}-1`;
}

function tfAllowsNa(test, item) {
  return (test.id === "guilt" && item.id === 6) || item.stars === 2;
}

export function beattieAnswersOk(input) {
  const spec = input && BY_TEST[input.testId];
  if (!spec) return false;
  if (Object.prototype.hasOwnProperty.call(input, "angerFill")) return false;
  const test = getTestById(spec.testId);
  if (!test) return false;
  const likert = input.likert;
  const mcq = input.mcq;
  const tf = input.tf;
  if (!Array.isArray(likert) || likert.length !== test.likertItems.length) return false;
  if (!likert.every((value) => Number.isInteger(value) && value >= 0 && value <= 10)) return false;
  if (!Array.isArray(mcq) || mcq.length !== test.mcqItems.length) return false;
  if (!mcq.every((value, index) => {
    const item = test.mcqItems[index];
    if (value === "NA") return typeof item.naScore === "number";
    return item.options.some((option) => option.key === value);
  })) return false;
  if (!Array.isArray(tf) || tf.length !== test.tfItems.length) return false;
  if (!tf.every((value, index) => {
    if (value === "yes" || value === "no") return true;
    return value === "NA" && tfAllowsNa(test, test.tfItems[index]);
  })) return false;
  return true;
}

export function beattieBodyParts(input, rushed) {
  if (!beattieAnswersOk(input)) throw new Error("情绪测试的作答不完整");
  const spec = BY_TEST[input.testId];
  const test = getTestById(spec.testId);
  const assessment = scoreLikert(input.likert);
  const mcq = scoreMcq(test.mcqItems, input.mcq);
  const tf = scoreTf(test.tfItems, input.tf);
  const sections = { assessment, mcq, tf };
  const { total, band } = computeTotal(test, sections);
  if (!band) throw new Error("分数没有对上分数段");
  const insight = insightFor(spec.testId, total) || null;
  const reading = readingFor(spec.testId);
  const dramaNote = spec.testId === "drama" ? BEATTIE_DRAMA_NOTE : null;
  const headline = insight ? `${insight.lamp}：${insight.headline}` : `总分 ${total} / ${test.maxPossible}`;
  const dimensions = [
    { id: "assessment", name: "评估", kind: "score", score: assessment, raw: assessment, max: 100, level: null, levelLabel: null, narrative: "评估部分的分数。", labels: [] },
    { id: "mcq", name: "选择", kind: "score", score: mcq, raw: mcq, max: 50, level: null, levelLabel: null, narrative: "选择题的分数。", labels: [] },
    { id: "tf", name: "判断", kind: "score", score: tf, raw: tf, max: 80, level: null, levelLabel: null, narrative: "判断题的分数。", labels: [] },
  ];
  const result = {
    headline,
    code: insight ? insight.lamp : `${band.min}-${band.max}`,
    label: insight ? insight.lamp : "分数段",
    summary: `总分 ${total} / ${test.maxPossible}。${studyAidNote}`,
    flags: [],
  };
  const interpretation = [
    { id: "headline", title: spec.name, text: headline },
    { id: "study", title: null, text: studyAidNote },
  ];
  if (reading && reading.theme) interpretation.push({ id: "theme", title: null, text: reading.theme });
  (insight ? insight.means : []).forEach((text, index) => {
    interpretation.push({ id: `mean-${index + 1}`, title: null, text });
  });
  interpretation.push({ id: "book", title: `${band.min}–${band.max}`, text: band.text });
  if (dramaNote) interpretation.push({ id: "drama", title: "先看悲痛", text: dramaNote });
  const recommendations = (insight ? insight.actions : []).map((text, index) => ({
    id: `action-${index + 1}`,
    title: null,
    text,
  }));
  recommendations.push({ id: "reader", title: null, text: BEATTIE_READER_GAP });
  const viewModel = {
    testId: spec.testId,
    title: test.title,
    chapter: test.chapter,
    theme: reading ? reading.theme : "",
    studyNote: studyAidNote,
    likert: input.likert.slice(),
    mcq: input.mcq.slice(),
    tf: input.tf.slice(),
    sections: { assessment, mcq, tf },
    total,
    maxPossible: test.maxPossible,
    band: { min: band.min, max: band.max, text: band.text },
    insight: insight
      ? {
        min: insight.min,
        max: insight.max,
        lamp: insight.lamp,
        tone: insight.tone,
        headline: insight.headline,
        means: insight.means.slice(),
        actions: insight.actions.slice(),
      }
      : null,
    dramaNote,
    rushed: Boolean(rushed),
  };
  const blocks = [
    { t: "h", l: 2, x: headline },
    { t: "p", x: result.summary },
    { t: "p", x: `评估 ${assessment} / 100。选择 ${mcq} / 50。判断 ${tf} / 80。` },
  ];
  return {
    spec,
    dimensions,
    result,
    interpretation,
    recommendations,
    reportContent: {
      format: "view-model+sections",
      viewModel,
      sections: blocks,
      textFallback: blocks.map((section) => section.x).join(""),
    },
    score: {
      sections: { assessment, mcq, tf },
      total,
      maxPossible: test.maxPossible,
      band: { min: band.min, max: band.max },
      lamp: insight ? insight.lamp : null,
    },
    answers: {
      likert: input.likert.slice(),
      mcq: input.mcq.slice(),
      tf: input.tf.slice(),
    },
  };
}

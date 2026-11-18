/** 珍爱金字塔计分。与 zhenai-pyramid `js/scoring.js`、`js/report.js` 相同。
 * 36 题 1–5。反向题在计分时变成 6 减原始分。维度分 = 六题总分 ÷ 30 × 100，四舍五入。
 * 加权总分的权重是整数百分比。并列时取权重更高的维度。
 * 不保存 7 天打卡。
 */
import { DIMS, DIM_ORDER, QUESTIONS, LEVELS } from "./zhenai/data.js";
import { FOOTER_NOTE } from "./zhenai/content.js";
import { computeResult, isComplete } from "./zhenai/scoring.js";
import { buildReport } from "./zhenai/report.js";

export const ZHENAI_VERSION = "zhenai-h5-v1";
export const ZHENAI_CONSENT_VERSION = "consent-assessment-zhenai-1";
export const ZHENAI_ID = "zhenai";
export const ZHENAI_NAME = "珍爱金字塔 · 自我关系状态评估";
export const ZHENAI_READER_GAP = "阅读页若尚未重绘珍爱金字塔，六维分数、加权总分和最薄的一层在 dimensions、result 与 viewModel。";

export { DIMS, DIM_ORDER, QUESTIONS, LEVELS, computeResult, isComplete };

function plain(value) {
  return String(value || "").replace(/<\/?em>/g, "");
}

function levelView(level) {
  return { id: level.id, name: level.name, desc: level.desc };
}

export function zhenaiAnswersOk(list) {
  return isComplete(list);
}

export function zhenaiBodyParts(answers, rushed) {
  if (!isComplete(answers)) throw new Error("作答需要 36 道 1–5 的整数题");
  const scored = computeResult(answers);
  const report = buildReport(scored, []);
  const opening = plain(report.opening);
  const dimensions = DIM_ORDER.map((key) => ({
    id: key,
    name: DIMS[key].name,
    kind: "score",
    score: scored.scores[key],
    raw: scored.sums[key],
    max: 100,
    weight: DIMS[key].weight,
    level: scored.levels[key].id,
    levelLabel: scored.levels[key].name,
    narrative: DIMS[key].sub,
    labels: [],
  }));
  const result = {
    headline: report.title,
    code: scored.lowest,
    label: DIMS[scored.lowest].name,
    summary: opening,
    flags: scored.allEqual ? ["even"] : [],
  };
  const interpretation = [
    { id: "opening", title: null, text: opening },
    { id: "resource", title: report.resource.title, text: report.resource.paras[0] },
    { id: "leak", title: report.leak.title, text: report.leak.paras.join("") },
  ];
  report.relations.forEach((item, index) => {
    interpretation.push({ id: `rel-${index + 1}`, title: item.title, text: item.body });
  });
  const recommendations = [
    { id: "reco", title: report.recommendation.title, text: report.recommendation.paras.join("") },
    {
      id: "practice",
      title: report.practice.title,
      text: `${report.practice.intro}${report.practice.sentence}${report.practice.how}`,
    },
    { id: "footer", title: null, text: FOOTER_NOTE },
    { id: "reader", title: null, text: ZHENAI_READER_GAP },
  ];
  const viewModel = {
    answers: answers.slice(),
    scores: { ...scored.scores },
    sums: { ...scored.sums },
    total: scored.total,
    totalLevel: levelView(scored.totalLevel),
    levels: Object.fromEntries(DIM_ORDER.map((key) => [key, levelView(scored.levels[key])])),
    lowest: scored.lowest,
    highest: scored.highest,
    allEqual: scored.allEqual,
    relations: scored.relations.map((item) => ({
      id: item.id,
      dims: item.dims.slice(),
      strength: item.strength,
    })),
    weak: scored.weak.slice(),
    opening,
    resource: {
      title: report.resource.title,
      tag: report.resource.tag,
      paras: report.resource.paras.slice(),
    },
    leak: {
      title: report.leak.title,
      tag: report.leak.tag,
      paras: report.leak.paras.slice(),
    },
    relationCards: report.relations.map((item) => ({ title: item.title, body: item.body })),
    recommendation: {
      kind: report.recommendation.kind,
      title: report.recommendation.title,
      tag: report.recommendation.tag,
      tagClass: report.recommendation.tagClass,
      paras: report.recommendation.paras.slice(),
      boldFirst: Boolean(report.recommendation.boldFirst),
    },
    practice: {
      title: report.practice.title,
      intro: report.practice.intro,
      sentence: report.practice.sentence,
      how: report.practice.how,
    },
    dims: report.dims.map((item) => ({
      key: item.key,
      name: item.name,
      score: item.score,
      levelId: item.levelId,
      levelName: item.levelName,
      sub: item.sub,
      desc: item.desc,
      leak: item.leak,
    })),
    rushed: Boolean(rushed),
  };
  const sections = [
    { t: "h", l: 2, x: result.headline },
    { t: "p", x: opening },
    { t: "p", x: `加权总分（参考）${scored.total} · ${scored.totalLevel.name}` },
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
      scores: { ...scored.scores },
      sums: { ...scored.sums },
      total: scored.total,
      totalLevel: scored.totalLevel.id,
      lowest: scored.lowest,
      highest: scored.highest,
      allEqual: scored.allEqual,
      relations: viewModel.relations.map((item) => ({ id: item.id, dims: item.dims.slice(), strength: item.strength })),
      weak: scored.weak.slice(),
    },
  };
}

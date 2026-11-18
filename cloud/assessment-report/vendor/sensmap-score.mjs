/** 高敏感心力地图计分。与 sensitive-map `src/logic/score.ts`、`select.ts`、`report.ts` 相同。
 * 32 题，0–4；只有 M03 可以是 "na"。四个生活影响 0–4。选择最先想改变的领域。
 * 情境题必须是当前分数最高的两个子板块。narrative 不接收、不保存。
 * 首要课题可以带 overrideSubId，服务端按 applyTopicOverride 重算。
 */
import {
  QUESTIONS,
  applyTopicOverride,
  buildReport,
} from "./sensmap-engine.mjs";

export const SENSMAP_VERSION = "sensmap-h5-v1";
export const SENSMAP_CONSENT_VERSION = "consent-assessment-sensmap-1";
export const SENSMAP_ID = "sensmap";
export const SENSMAP_NAME = "高敏感心力地图";
export const SENSMAP_READER_GAP = "阅读页若尚未重绘高敏感心力地图，四维分数、模式和首要课题在 dimensions、result 与 viewModel。你写下的情境不保存。";

const DIMS = ["F", "R", "E", "M"];
const CHOICES = ["F", "R", "E", "M", "unclear"];
const SUB_IDS = [
  "F1", "F2", "F3", "F4",
  "R1", "R2", "R3", "R4",
  "E1", "E2", "E3", "E4",
  "M1", "M2", "M3", "M4",
];

function likertOk(value) {
  return Number.isInteger(value) && value >= 0 && value <= 4;
}

export function sensmapAnswersOk(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  if (Object.prototype.hasOwnProperty.call(input, "narrative")) return false;
  const answers = input.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
  for (const question of QUESTIONS) {
    const value = answers[question.id];
    if (question.allowNa) {
      if (value !== "na" && !likertOk(value)) return false;
    } else if (!likertOk(value)) return false;
  }
  if (Object.keys(answers).length !== QUESTIONS.length) return false;
  const impact = input.impact;
  if (!impact || typeof impact !== "object" || Array.isArray(impact)) return false;
  if (Object.keys(impact).length !== 4) return false;
  if (DIMS.some((dim) => !likertOk(impact[dim]))) return false;
  if (!CHOICES.includes(input.choice)) return false;
  if (!Array.isArray(input.scenarioAnswers) || input.scenarioAnswers.length < 2) return false;
  if (input.overrideSubId != null && !SUB_IDS.includes(input.overrideSubId)) return false;
  return input.scenarioAnswers.every((item) => item
    && typeof item === "object"
    && typeof item.questionId === "string"
    && typeof item.optionId === "string");
}

function orderedAnswers(answers) {
  const out = {};
  for (const question of QUESTIONS) out[question.id] = answers[question.id];
  return out;
}

function orderedImpact(impact) {
  return { F: impact.F, R: impact.R, E: impact.E, M: impact.M };
}

function withoutPrivate(report, rushed) {
  const out = {};
  for (const key of Object.keys(report)) {
    if (key === "narrative" || key === "id" || key === "createdAt") continue;
    out[key] = report[key];
  }
  out.rushed = Boolean(rushed);
  return out;
}

function optionsOk(report) {
  return report.scenarioAnswers.every((answer) => {
    const pick = report.scenarioPicks.find((item) => item.question.id === answer.questionId);
    return Boolean(pick && pick.question.options.some((option) => option.id === answer.optionId));
  });
}

function slimScore(report) {
  return {
    dimensions: report.scores.dimensions.map((item) => ({
      id: item.id,
      name: item.name,
      score: item.score,
      band: item.band,
      validCount: item.validCount,
      deterministic: item.deterministic,
    })),
    subs: report.scores.subs.map((item) => ({
      id: item.id,
      dim: item.dim,
      name: item.name,
      order: item.order,
      score: item.score,
      validCount: item.validCount,
    })),
    primaryTopicId: report.primaryTopicId,
    patternIds: report.patternIds.slice(),
    choice: report.choice,
    help: report.helpNotice != null,
  };
}

export function sensmapBodyParts(input, rushed) {
  if (!sensmapAnswersOk(input)) throw new Error("高敏感心力地图的作答不完整");
  let report = buildReport({
    id: "local",
    answers: orderedAnswers(input.answers),
    impact: orderedImpact(input.impact),
    scenarioAnswers: input.scenarioAnswers.map((item) => ({
      questionId: item.questionId,
      optionId: item.optionId,
    })),
    choice: input.choice,
    narrative: "",
    createdAt: "1970-01-01T00:00:00.000Z",
  });
  if (input.overrideSubId) report = applyTopicOverride(report, input.overrideSubId);
  if (!optionsOk(report)) throw new Error("情境选项不对");
  if (Object.prototype.hasOwnProperty.call(report, "narrative") && report.narrative !== "") {
    throw new Error("情境原文不能保存");
  }
  const viewModel = withoutPrivate(report, rushed);
  const dimensions = report.scores.dimensions.map((item) => ({
    id: item.id,
    name: item.name,
    kind: "score",
    score: item.score,
    raw: item.score,
    max: 100,
    level: item.band,
    levelLabel: item.band,
    narrative: item.deterministic ? item.band : "有效题不足",
    labels: [],
  }));
  const result = {
    headline: report.topic.primaryName,
    code: report.primaryTopicId,
    label: report.topic.primaryName,
    summary: report.summary,
    flags: report.helpNotice ? ["help"] : [],
  };
  const interpretation = [
    { id: "summary", title: null, text: report.summary },
    { id: "boundary", title: null, text: report.boundary },
  ];
  if (report.helpNotice) interpretation.push({ id: "help", title: null, text: report.helpNotice });
  report.patterns.forEach((pattern, index) => {
    interpretation.push({
      id: `pattern-${index + 1}`,
      title: pattern.name,
      text: pattern.nodes.map((node) => `${node.label}：${node.text}`).join(""),
    });
  });
  interpretation.push({ id: "clue", title: report.clue.title, text: report.clue.text });
  const recommendations = [
    { id: "action", title: report.topic.primaryName, text: report.topic.action },
    ...report.topic.basis.map((text, index) => ({ id: `basis-${index + 1}`, title: null, text })),
    { id: "reader", title: null, text: SENSMAP_READER_GAP },
  ];
  const sections = [
    { t: "h", l: 2, x: "我的心力地图" },
    { t: "p", x: report.summary },
    { t: "p", x: `首要课题：${report.topic.primaryName}` },
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
    score: slimScore(report),
    answers: orderedAnswers(input.answers),
    impact: orderedImpact(input.impact),
    scenarioAnswers: report.scenarioAnswers.map((item) => ({
      questionId: item.questionId,
      optionId: item.optionId,
    })),
    choice: input.choice,
    overrideSubId: input.overrideSubId || null,
  };
}

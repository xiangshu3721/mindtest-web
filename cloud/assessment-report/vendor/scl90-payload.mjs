/** 合成 SCL-90 统一结果。计分与 mindtest scl90/js/score.js 的因子键、均分和筛查界值一致。 */
import { scoreScl90Answers } from "../lib/validate.mjs";

export const SCL90_VERSION = "scl90-h5-v1";
export const CONSENT_VERSION = "consent-assessment-scl90-1";
export const ASSESSMENT_NAME = "SCL-90 症状自评量表";

function chars(value) {
  return Array.from(String(value || ""));
}

function answersOk(list) {
  return Array.isArray(list)
    && list.length === 90
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
}

export function buildScl90Result(input) {
  const answers = answersOk(input.answers) ? input.answers.slice() : null;
  const nickname = String(input.nickname || "").trim();
  if (!answers || !nickname || chars(nickname).length > 12) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  const scored = scoreScl90Answers(answers);
  return {
    reportId: input.reportId,
    assessmentId: "scl90",
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: input.assessmentVersion || SCL90_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: scored.factors.map((factor) => ({
      id: factor.id,
      name: factor.name,
      kind: "score",
      score: factor.score,
      raw: factor.raw,
      max: 5,
      level: factor.level,
      levelLabel: factor.levelLabel,
      labels: [],
    })),
    result: {
      headline: scored.headline,
      code: scored.code,
      label: scored.headline,
      summary: scored.summary,
      flags: scored.flags.slice(),
    },
    interpretation: [
      { id: "verdict", title: null, text: scored.summary },
    ],
    recommendations: [
      { id: "screen", title: null, text: "这是筛查，不是诊断。" },
    ],
    reportContent: {
      format: "view-model+sections",
      viewModel: {
        answers,
        factors: scored.factors.map((factor) => ({
          id: factor.id,
          name: factor.name,
          raw: factor.raw,
          score: factor.score,
          level: factor.level,
          levelLabel: factor.levelLabel,
        })),
        total: scored.total,
        gsi: scored.gsi,
        positiveCount: scored.positiveCount,
        positiveMean: scored.positiveMean,
        positive: scored.positive,
      },
      sections: [
        { t: "h", l: 2, x: scored.headline },
        { t: "p", x: scored.summary },
      ],
      textFallback: `${scored.headline}。总分 ${scored.total}。${scored.summary}`,
    },
    extensionData: {
      answers,
      score: {
        total: scored.total,
        gsi: scored.gsi,
        positiveCount: scored.positiveCount,
        positiveMean: scored.positiveMean,
        positive: scored.positive,
        factors: scored.factors.map((factor) => ({
          id: factor.id,
          raw: factor.raw,
          mean: factor.score,
          level: factor.level,
        })),
      },
      consent: {
        agreed: true,
        version: CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: { level: "partial", gaps: ["统一阅读页尚未重绘 SCL-90。"] },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "scl90/index.html",
      repo: "mindtest",
      origin: "external-repo",
      pageUrl: null,
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "scl90",
      localKey: "scl90-session",
    },
    schemaVersion: "1.0.0",
  };
}

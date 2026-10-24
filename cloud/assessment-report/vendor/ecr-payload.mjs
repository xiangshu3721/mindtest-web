/** 合成 ECR 统一结果。计分与 mindtest ecr/js/score.js 的反向题、均分和判别式一致。 */
import {
  ECR_CONSENT_VERSION,
  ECR_ID,
  ECR_READER_GAP,
  ECR_SCREEN_TEXT,
  ECR_VERSION,
  QUESTION_COUNT,
  ecrDimension,
  ecrOutcome,
  ecrViewModel,
  scoreEcr,
} from "./ecr-score.mjs";

export const ASSESSMENT_NAME = "亲密关系经历量表 ECR";
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function ecrNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function answersOk(list) {
  return Array.isArray(list)
    && list.length === QUESTION_COUNT
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 7);
}

export function buildEcrResult(input) {
  const nickname = ecrNickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || !answersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let scored;
  try {
    scored = scoreEcr(answers);
  } catch {
    return null;
  }

  const answerCopy = answers.slice();
  const outcome = ecrOutcome(scored);
  const dimensions = scored.dimensions.map(ecrDimension);
  const rushed = Boolean(input.rushed);
  const axis = dimensions
    .map((dimension) => `${dimension.name} ${dimension.score.toFixed(2)}，${dimension.levelLabel}`)
    .join("。");
  const interpretation = [
    { id: "verdict", title: outcome.headline, text: outcome.summary },
    { id: "screen", title: "筛查不是诊断", text: ECR_SCREEN_TEXT },
  ];
  for (const dimension of dimensions) {
    interpretation.push({
      id: dimension.id,
      title: dimension.name,
      text: `${dimension.levelLabel}，均分 ${dimension.score.toFixed(2)}。${dimension.narrative}`,
    });
  }
  const recommendations = [
    { id: "screen", title: null, text: ECR_SCREEN_TEXT },
  ];
  const textFallback = `${outcome.headline}。${axis}。${ECR_SCREEN_TEXT}`;
  const sections = [
    { t: "h", l: 2, x: outcome.headline },
    { t: "p", x: outcome.summary },
    { t: "p", x: ECR_SCREEN_TEXT },
    { t: "p", x: `${axis}。` },
  ];

  return {
    reportId: input.reportId,
    assessmentId: ECR_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: ECR_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result: outcome,
    interpretation,
    recommendations,
    reportContent: {
      format: "view-model+sections",
      viewModel: ecrViewModel(scored, answerCopy, rushed),
      sections,
      textFallback,
    },
    extensionData: {
      answers: answerCopy.slice(),
      score: scored,
      quality: { rushed },
      consent: {
        agreed: true,
        version: ECR_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [ECR_READER_GAP],
      },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "ecr/index.html",
      repo: "mindtest",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/mindtest/ecr/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "ecr",
      localKey: "ecr-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

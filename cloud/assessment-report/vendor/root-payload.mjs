/** 合成寻根之旅统一结果。计分与 root-score.mjs 相同，只供测试和前端对齐。
 *
 * 页面里的 assessmentVersion「2.0」不是云端版本。云端固定 root-h5-v1。
 * answers：33 个整数 1–5。下标 0–27 是 Q01–Q28，28–32 是家庭氛围（高期待、情感压抑、控制干预、批评指责、温暖支持）。
 * developmentAnswers：4 个整数 1–5，顺序是主动与行动、身份与主体、亲密与互惠、创造与生成。
 * dimensions：先 8 项能力，再 4 个模块。模块 id 是 subjectivity、emotion、relationship、value。
 * 不接受电话、父母档案、openAnswers、developmentStage 或 journey_archive。
 */
import {
  ROOT_CONSENT_VERSION,
  ROOT_ID,
  ROOT_READER_GAP,
  ROOT_VERSION,
  developmentAnswersOk,
  lifeMapAnswersOk,
  rootBodyParts,
} from "./root-score.mjs";

export const ASSESSMENT_NAME = "寻根之旅 · 生命成长地图";
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function rootNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildRootResult(input) {
  const nickname = rootNickname(input && input.nickname);
  const answers = input && input.answers;
  const developmentAnswers = input && input.developmentAnswers;
  if (!nickname || phoneNickname(nickname) || !lifeMapAnswersOk(answers) || !developmentAnswersOk(developmentAnswers)) {
    return null;
  }
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let parts;
  try {
    parts = rootBodyParts(answers, developmentAnswers, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: ROOT_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: ROOT_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: parts.dimensions,
    result: parts.result,
    interpretation: parts.interpretation,
    recommendations: parts.recommendations,
    reportContent: parts.reportContent,
    extensionData: {
      answers: answers.slice(),
      developmentAnswers: developmentAnswers.slice(),
      score: parts.score,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: ROOT_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [ROOT_READER_GAP],
      },
    },
    source: {
      site: "寻根之旅",
      path: "index.html",
      repo: "root-journey-web",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/root-journey-web/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "root",
      localKey: "root-family-pattern-v1",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

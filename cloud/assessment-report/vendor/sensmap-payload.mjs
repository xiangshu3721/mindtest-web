/** 合成高敏感心力地图统一结果。计分与 sensmap-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`sensmap`。assessmentVersion：`sensmap-h5-v1`。schemaVersion：`1.0.0`。
 * - assessmentName 必须包含「高敏感心力地图」。
 * - viewModel.answers：32 题，键顺序 F01…M08。除 M03 外必须是 0–4 的整数；M03 可以是 0–4 或 "na"。
 * - viewModel.impact：F R E M，各为 0–4。viewModel.choice：F、R、E、M 或 unclear。
 * - viewModel.scenarioAnswers：当前最高两个子板块的情境题，optionId 必须是该题选项。
 * - extensionData.overrideSubId：null，或 16 个子板块 id 之一。有值时首要课题按页面的「我想先看别的方向」重算。
 * - 禁止出现 narrative。你写下的情境不上传，阅读页也不显示。
 * - consent.version：`consent-assessment-sensmap-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=external-repo，repo=sensitive-map，path=index.html，resultKitId=sensmap。
 * - compat.level 为 partial。分数、模式、线索和首要课题必须与页面 buildReport 一致。
 */
import {
  SENSMAP_CONSENT_VERSION,
  SENSMAP_ID,
  SENSMAP_NAME,
  SENSMAP_READER_GAP,
  SENSMAP_VERSION,
  sensmapAnswersOk,
  sensmapBodyParts,
} from "./sensmap-score.mjs";

export const ASSESSMENT_NAME = SENSMAP_NAME;
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function sensmapNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildSensmapResult(input) {
  const nickname = sensmapNickname(input && input.nickname);
  if (!nickname || phoneNickname(nickname) || !sensmapAnswersOk(input)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  if (input.customText != null || input.angerFill != null) return null;

  let parts;
  try {
    parts = sensmapBodyParts(input, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: SENSMAP_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: SENSMAP_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: parts.dimensions,
    result: parts.result,
    interpretation: parts.interpretation,
    recommendations: parts.recommendations,
    reportContent: parts.reportContent,
    extensionData: {
      answers: parts.answers,
      impact: parts.impact,
      scenarioAnswers: parts.scenarioAnswers,
      choice: parts.choice,
      overrideSubId: parts.overrideSubId,
      score: parts.score,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: SENSMAP_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [SENSMAP_READER_GAP],
      },
    },
    source: {
      site: SENSMAP_NAME,
      path: "index.html",
      repo: "sensitive-map",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/sensitive-map/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "sensmap",
      localKey: "sensitive-map-session-v1",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

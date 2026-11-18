/** 合成珍爱金字塔统一结果。计分与 zhenai-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`zhenai`。assessmentVersion：`zhenai-h5-v1`。schemaVersion：`1.0.0`。
 * - assessmentName 必须包含「珍爱金字塔」。
 * - reportContent.viewModel.answers：长度 36 的整数数组，每项 1–5，下标 0 是第 1 题。
 * - 反向题由服务端按题库折算。维度分、加权总分、最低层和关联规则必须与 zhenai-pyramid `computeResult` 一致。
 * - dimensions 顺序固定为 A B C D E F。result.code 是最薄一层的字母。并列取权重更高者。
 * - 不保存 7 天打卡，也不保存练习完成记录。
 * - extensionData.answers 与 viewModel.answers 相同。quality 只有 `{ rushed }`。
 * - consent.version：`consent-assessment-zhenai-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=external-repo，repo=zhenai-pyramid，path=index.html，resultKitId=zhenai。
 * - compat.level 为 partial。
 */
import {
  ZHENAI_CONSENT_VERSION,
  ZHENAI_ID,
  ZHENAI_NAME,
  ZHENAI_READER_GAP,
  ZHENAI_VERSION,
  zhenaiAnswersOk,
  zhenaiBodyParts,
} from "./zhenai-score.mjs";

export const ASSESSMENT_NAME = ZHENAI_NAME;
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function zhenaiNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildZhenaiResult(input) {
  const nickname = zhenaiNickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || phoneNickname(nickname) || !zhenaiAnswersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  if (input.customText != null || input.narrative != null || input.angerFill != null) return null;

  let parts;
  try {
    parts = zhenaiBodyParts(answers, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: ZHENAI_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: ZHENAI_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: parts.dimensions,
    result: parts.result,
    interpretation: parts.interpretation,
    recommendations: parts.recommendations,
    reportContent: parts.reportContent,
    extensionData: {
      answers: answers.slice(),
      score: parts.score,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: ZHENAI_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [ZHENAI_READER_GAP],
      },
    },
    source: {
      site: ZHENAI_NAME,
      path: "index.html",
      repo: "zhenai-pyramid",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/zhenai-pyramid/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "zhenai",
      localKey: "zhenai",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

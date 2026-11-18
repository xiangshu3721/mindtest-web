/** 合成六套情绪测试的统一结果。计分与 beattie-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`beattie-emotional-health`、`beattie-anger`、`beattie-fear`、`beattie-drama`、`beattie-guilt`、`beattie-grief`。
 * - assessmentVersion：`beattie-*-h5-v1`，星号与 assessmentId 去掉前缀后的 testId 相同。
 * - assessmentName 必须包含该套测试的标题，例如「愤怒测试」。
 * - viewModel.likert：10 个 0–10 的整数。viewModel.mcq：该题选项字母，或在书中允许时为 "NA"。
 * - viewModel.tf：yes 或 no；只有页面给出「不适用」时才能是 "NA"。
 * - 评估、选择、判断和总分必须与 beattie-src 的 scoreLikert、scoreMcq、scoreTf、computeTotal 一致。
 * - 禁止出现 angerFill。愤怒测试的填空留在做题的设备上。
 * - extensionData.answers 是 `{ likert, mcq, tf }`，与视图相同。quality 只有 `{ rushed }`。
 * - consent.version：`consent-assessment-` 加上 assessmentId 再加 `-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=in-repo，repo=mindtest-web，path=beattie/index.html，resultKitId 等于 assessmentId。
 * - compat.level 为 partial。
 */
import {
  BEATTIE_READER_GAP,
  BEATTIE_TESTS,
  beattieAnswersOk,
  beattieBodyParts,
  beattieConsent,
  beattieSpec,
  beattieVersion,
} from "./beattie-score.mjs";

export const SCHEMA_VERSION = "1.0.0";
export { BEATTIE_TESTS };

function chars(value) {
  return Array.from(String(value || ""));
}

export function beattieNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildBeattieResult(input) {
  const nickname = beattieNickname(input && input.nickname);
  const spec = beattieSpec(input && input.assessmentId) || BEATTIE_TESTS.find((item) => item.testId === input?.testId);
  if (!nickname || phoneNickname(nickname) || !spec || !beattieAnswersOk({ ...input, testId: spec.testId })) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  if (input.customText != null || input.narrative != null) return null;
  if (input.assessmentId && input.assessmentId !== spec.id) return null;

  let parts;
  try {
    parts = beattieBodyParts({ ...input, testId: spec.testId }, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: spec.id,
    assessmentName: spec.name,
    assessmentVersion: beattieVersion(spec.id),
    nickname,
    completedAt: input.completedAt,
    dimensions: parts.dimensions,
    result: parts.result,
    interpretation: parts.interpretation,
    recommendations: parts.recommendations,
    reportContent: parts.reportContent,
    extensionData: {
      answers: parts.answers,
      score: parts.score,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: beattieConsent(spec.id),
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [BEATTIE_READER_GAP],
      },
    },
    source: {
      site: spec.name,
      path: "beattie/index.html",
      repo: "mindtest-web",
      origin: "in-repo",
      pageUrl: "https://xiangshu3721.github.io/mindtest-web/beattie/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: spec.id,
      localKey: `beattie-${spec.testId}`,
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

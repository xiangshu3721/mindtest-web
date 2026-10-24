/** 合成个人充电统一结果。计分与 gcd-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`gcd`。assessmentVersion：`gcd-h5-v1`。schemaVersion：`1.0.0`。
 * - assessmentName 必须包含「个人充电」。
 * - 预设状态：viewModel.stateId 是 collapse、empty、anxious、ruminate、tired、flat、recovering、full 之一，customUnmatched 为 false。
 * - 自己写的、没对上关键词：stateId 为 null，customUnmatched 为 true。基础电量按规则里的 customDefaultBase。原文不上传。
 * - 自己写的、对上了关键词：前端先换成对应 stateId，按预设状态提交，不要带原句。
 * - sourceIds：0–3 个不重复的来源 id，不能是 none。顺序保留。
 * - dayIndex：非负整数，与页面按日期算出的 UTC 日序相同。它会改变并列时挑中的小修复。
 * - 禁止出现 customText。extensionData.answers 与 viewModel 里的 stateId、customUnmatched、sourceIds、dayIndex 相同。
 * - consent.version：`consent-assessment-gcd-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=external-repo，repo=geren-chongdian，path=index.html，resultKitId=gcd。
 * - compat.level 为 partial。修复打卡不保存。
 */
import {
  GCD_CONSENT_VERSION,
  GCD_ID,
  GCD_NAME,
  GCD_READER_GAP,
  GCD_VERSION,
  gcdBodyParts,
  gcdInputOk,
} from "./gcd-score.mjs";

export const ASSESSMENT_NAME = GCD_NAME;
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function gcdNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildGcdResult(input) {
  const nickname = gcdNickname(input && input.nickname);
  if (!nickname || phoneNickname(nickname) || !gcdInputOk(input)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  if (input.narrative != null || input.angerFill != null) return null;

  let parts;
  try {
    parts = gcdBodyParts(input, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: GCD_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: GCD_VERSION,
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
        version: GCD_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [GCD_READER_GAP],
      },
    },
    source: {
      site: GCD_NAME,
      path: "index.html",
      repo: "geren-chongdian",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/geren-chongdian/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "gcd",
      localKey: "gcd",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

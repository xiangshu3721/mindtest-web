/** 合成爱的 5 种语言统一结果。计分与 loves5-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`loves5`。仓库名 `5loves` 不能当 assessmentId。
 * - assessmentName：必须包含「爱的 5 种语言」。合成名就是这七个字。
 * - assessmentVersion：`loves5-h5-v1`。schemaVersion：`1.0.0`。
 * - reportContent.viewModel.picks：长度 30 的数组。每项是该题左侧或右侧的语言码（A–E 一个字母）。
 *   不接受 left/right，不接受选项原文，不接受 `?r=` 分数链。
 * - 第 1–30 题左右码依次是 AE BD CB DE EA BC AD EA CA BA CD BD CA BE EC BA CD AB EC DA EC BD CD BC BD EA DE AD CE BE。
 * - extensionData.score.scores：`{A,B,C,D,E}`，整数，每种 0–12，相加 30，必须与 picks 计票一致。
 * - extensionData.score 另外只有 primaries、ranked、total。primaries 是最高分的语言码，并列都算。
 *   ranked 先比分数，同分按 A–E。
 * - dimensions：固定 A、B、C、D、E 顺序，不是排名顺序。id 是语言码。kind 是 score。
 *   score 与 raw 都是计票。max 是 12。主爱语 level 是 primary，levelLabel 是「主爱语」或「并列主爱语」。
 * - result.code：主爱语字母连写，例如 `A` 或 `AB`。没有单独类型表。
 * - result.flags：只有并列时为 `["tied"]`，否则 []。
 * - extensionData.answers 与 picks 相同。quality 只有 `{ rushed }`，且与 viewModel.rushed 一致。
 * - consent.version：`consent-assessment-loves5-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=external-repo，repo=5loves，path=index.html，resultKitId=loves5。
 * - compat.level 为 partial。不保存资料页、电话。
 */
import {
  LOVES5_CONSENT_VERSION,
  LOVES5_ID,
  LOVES5_NAME,
  LOVES5_READER_GAP,
  LOVES5_VERSION,
  loves5BodyParts,
  loves5PicksOk,
} from "./loves5-score.mjs";

export const ASSESSMENT_NAME = LOVES5_NAME;
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function loves5Nickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildLoves5Result(input) {
  const nickname = loves5Nickname(input && input.nickname);
  const picks = input && input.picks;
  if (!nickname || phoneNickname(nickname) || !loves5PicksOk(picks)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let parts;
  try {
    parts = loves5BodyParts(picks, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: LOVES5_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: LOVES5_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: parts.dimensions,
    result: parts.result,
    interpretation: parts.interpretation,
    recommendations: parts.recommendations,
    reportContent: parts.reportContent,
    extensionData: {
      answers: picks.slice(),
      score: parts.score,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: LOVES5_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [LOVES5_READER_GAP],
      },
    },
    source: {
      site: LOVES5_NAME,
      path: "index.html",
      repo: "5loves",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/5loves/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "loves5",
      localKey: "loves5-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

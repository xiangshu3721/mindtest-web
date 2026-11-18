/** 合成霍兰德兴趣探索统一结果。计分与 holland-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`holland`。assessmentVersion：`holland-h5-v1`。schemaVersion：`1.0.0`。
 * - assessmentName：必须包含「霍兰德兴趣探索」。
 * - reportContent.viewModel.answers：长度 60 的整数数组，每项 1–5，下标 0 是 Q01，下标 59 是 Q60。
 *   页面上的 answers 是以 Q01 为键的对象。云端不收这个对象，提交前要按题号排成数组。
 *   题序是 R I A S E C 循环 10 遍。每维 10 题，原分 raw = 10–50。
 * - 喜爱程度 score = 四舍五入到 1 位小数的 `(raw - 10) / 40 * 100`，范围 0–100，步长 2.5。
 * - dimensions 固定 R、I、A、S、E、C。id 是字母。name 是实际、研究、艺术、社会、企业、常规。
 *   score 是 0–100 的喜爱程度，raw 是 10 题原分，max 是 100。
 * - extensionData.score 与页面 compute() 对齐，但有两处不同：
 *   1. 多了 raw（六维原分）。没有 fives，也没有 median_ms。
 *   2. quality 只有 LOW_VARIANCE（同一选项不少于 54 题）和 MANY_UNSURE（「说不上来」3 分不少于 24 题）。
 *      不保存作答用时，所以没有 FAST_RESPONSE。作答偏快只写 viewModel.rushed 和 extensionData.quality.rushed。
 * - score.version 固定 `RIASEC_V2`。这是题库标记，不是 assessmentVersion。
 * - holland_code = ranking 前三个字母连写。result.code 与它相同。
 * - ranking：先比喜爱程度，再比「很喜欢」（5 分）题数，仍相同则按 R I A S E C。
 * - structure：dominance（第一名减第二名，1 位小数）、near_tie_top12、near_tie_top34（差的绝对值 ≤ 5）、
 *   differentiation（六维总体标准差，除以 6，不是除以 5）、consistency（相邻 HIGH、隔一位 MEDIUM、相对 CROSS）、
 *   breadth（与第一名相差 ≤ 10 的维度个数，含自己，1–6）。
 * - bands.dominance：< 5 为 DUAL，< 12 为 SOME，否则 PROMINENT。
 *   bands.differentiation：< 10 为 LOW，≤ 20 为 MID，否则 HIGH。
 *   bands.breadth：≤ 1 为 ONE，≤ 3 为 FEW，否则 MANY。
 * - viewModel.explore 与 extensionData.openText 必须相同，且正好有 q1、q2、q2other、q3。
 *   q1 最多 400 字，q2other 最多 80 字。q2、q3 是页面选项原文组成的不重复数组，可以是空数组。
 *   不计分。不能写手机号。未作答时四项分别是 ""、[]、""、[]，不能省掉这个对象。
 * - consent.version：`consent-assessment-holland-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=external-repo，repo=holland-explore，path=index.html，resultKitId=holland。
 * - compat.level 为 partial。不保存资料页、电话、作答用时。
 */
import {
  HOLLAND_CONSENT_VERSION,
  HOLLAND_ID,
  HOLLAND_NAME,
  HOLLAND_READER_GAP,
  HOLLAND_VERSION,
  coerceHollandAnswers,
  emptyExplore,
  hollandBodyParts,
  hollandExploreOk,
} from "./holland-score.mjs";

export const ASSESSMENT_NAME = HOLLAND_NAME;
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function hollandNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildHollandResult(input) {
  const nickname = hollandNickname(input && input.nickname);
  const answers = coerceHollandAnswers(input && input.answers);
  const explore = input && input.explore != null ? input.explore : emptyExplore();
  if (!nickname || phoneNickname(nickname) || !answers || !hollandExploreOk(explore)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let parts;
  try {
    parts = hollandBodyParts(answers, explore, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: HOLLAND_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: HOLLAND_VERSION,
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
      openText: parts.openText,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: HOLLAND_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [HOLLAND_READER_GAP],
      },
    },
    source: {
      site: HOLLAND_NAME,
      path: "index.html",
      repo: "holland-explore",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/holland-explore/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "holland",
      localKey: "holland-explore",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

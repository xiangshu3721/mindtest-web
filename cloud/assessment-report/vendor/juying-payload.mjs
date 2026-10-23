/** 合成巨婴测评统一结果。计分与 juying-score.mjs 相同，只供测试和前端对齐。
 *
 * 预期 payload（严格）：
 * - assessmentId：`juying`。assessmentVersion：`juying-h5-v1`。schemaVersion：`1.0.0`。
 * - assessmentName：必须包含「巨婴测评」。
 * - reportContent.viewModel.answers：长度 20 的整数数组，每项 0–5。下标 0–9 是心理特征，10–19 是行为特征。
 *   0 分会计入总分。不接受 null，不接受跳过。
 * - total = 20 项之和（0–100）。mind = 前 10 项之和（0–50）。act = 后 10 项之和（0–50）。
 * - 分档没有空档：0–40 mature 心智成熟；41–59 partial 有部分巨婴特质；60–80 infant 巨婴（含 80）；81–100 child 儿童状态。
 * - dimensions 顺序固定为 total、mind、act。result.code 是分档 id，不是中文。result.label 是分档中文名。
 * - extensionData.score 只有 total、mind、act、band、average、side。
 *   band 只有 id、name、min、max、range、source。不要把页面上的 paragraphs、rows 放进 score。
 *   average 是字符串，两位小数，与页面 `(Math.round((total / 20) * 100) / 100).toFixed(2)` 相同。
 * - side 与页面 sideNote 相同：两边相差小于 4 分算差不多高。
 * - viewModel.marked：得分大于等于 4 的题目，字段是 groupId、group、n、text、score、label。没有则为 []。
 * - 解释里必须有「这是讲座对照，不是诊断，也不是心理评估。」和「非严肃科学，仅供讲座听众理解学习。」
 * - extensionData.answers 与 viewModel.answers 相同。quality 只有 `{ rushed }`。
 * - consent.version：`consent-assessment-juying-1`。scopes 只能是 store、share_link、mentor_read。
 * - source：origin=external-repo，repo=juying，path=index.html，resultKitId=juying。
 * - compat.level 为 partial。不保存资料页、电话。分档名称不是诊断。
 */
import {
  JUYING_CONSENT_VERSION,
  JUYING_ID,
  JUYING_NAME,
  JUYING_READER_GAP,
  JUYING_VERSION,
  juyingAnswersOk,
  juyingBodyParts,
} from "./juying-score.mjs";

export const ASSESSMENT_NAME = JUYING_NAME;
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function juyingNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function phoneNickname(value) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

export function buildJuyingResult(input) {
  const nickname = juyingNickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || phoneNickname(nickname) || !juyingAnswersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let parts;
  try {
    parts = juyingBodyParts(answers, Boolean(input.rushed));
  } catch {
    return null;
  }

  return {
    reportId: input.reportId,
    assessmentId: JUYING_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: JUYING_VERSION,
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
        version: JUYING_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [JUYING_READER_GAP],
      },
    },
    source: {
      site: JUYING_NAME,
      path: "index.html",
      repo: "juying",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/juying/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "juying",
      localKey: "juying-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

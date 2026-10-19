import { KEEP, REVIVE, WORDS } from "../words.mjs";
import { REPORT_ID_RE, SECRET_RE, SUBMISSION_RE } from "./ids.mjs";

export const STAR_VERSION = "star-words-31-v1";
export const CONSENT_VERSION = "consent-assessment-star-1";
export const SCHEMA_VERSION = "1.0.0";
export const MAX_BODY_BYTES = 400 * 1024;

const WORD_SET = new Set(WORDS);
const TOP_KEYS = new Set([
  "reportId", "assessmentId", "assessmentName", "assessmentVersion", "nickname",
  "completedAt", "dimensions", "result", "interpretation", "recommendations",
  "reportContent", "extensionData", "source", "schemaVersion",
]);
const FORBIDDEN_KEY = /phone|mobile|telephone|idcard|id_card|wechat|weixin|realname|real_name|email|address|手机|身份证|微信|邮箱|住址/i;
const NOTES = [
  "倒三角（底层动力）是划了三轮之后留下的 3 个词，是对你最要紧的。",
  "正三角（现实追求）是从划掉的词里复活的 3 个，是你现在想去够的。",
  "这是一次自我整理，不是打分，也不是职业诊断。",
];

function chars(value) {
  return Array.from(String(value || ""));
}

function scanKeys(value, issues, path) {
  if (!value || typeof value !== "object") return;
  const keys = Array.isArray(value) ? [] : Object.keys(value);
  for (const key of keys) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      issues.push(`${path} 含有不允许的键`);
    }
    if (FORBIDDEN_KEY.test(key)) issues.push(`${path}.${key} 不在可保存范围内`);
    scanKeys(value[key], issues, `${path}.${key}`);
  }
  if (Array.isArray(value)) value.forEach((item, index) => scanKeys(item, issues, `${path}[${index}]`));
}

function wordsOk(list) {
  return Array.isArray(list)
    && list.length === 3
    && list.every((word) => typeof word === "string" && WORD_SET.has(word))
    && new Set(list).size === 3;
}

export function validateSecrets(linkSecret, ownerToken) {
  const issues = [];
  if (!SECRET_RE.test(String(linkSecret || ""))) issues.push("linkSecret 格式不对");
  if (!SECRET_RE.test(String(ownerToken || ""))) issues.push("ownerToken 格式不对");
  if (linkSecret && ownerToken && linkSecret === ownerToken) issues.push("分享秘密与作废口令必须分开");
  return issues;
}

export function validateStarResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return ["结果必须是对象"];
  }
  scanKeys(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== "star") issues.push("第一期只接受职业六芒星");
  if (result.assessmentName !== "职业六芒星") issues.push("测评名称不对");
  if (result.assessmentVersion !== STAR_VERSION) issues.push("规则版本不对");
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");

  const dimensions = result.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== 2) issues.push("六芒星需要两条分类维度");
  const drive = dimensions?.find?.((item) => item && item.id === "drive");
  const pursue = dimensions?.find?.((item) => item && item.id === "pursue");
  for (const side of [drive, pursue]) {
    if (!side) continue;
    if (side.kind !== "category") issues.push(`${side.id} 必须是分类维度`);
    if (side.score !== null) issues.push(`${side.id} 不能写分数`);
    if (!wordsOk(side.labels)) issues.push(`${side.id} 需要 3 个不重复的词`);
  }
  if (!drive || !pursue) issues.push("缺少底层动力或现实追求");
  if (drive && pursue && drive.labels.some((word) => pursue.labels.includes(word))) {
    issues.push("底层动力和现实追求不能有同一个词");
  }

  const headline = drive ? `底层动力：${drive.labels.join("、")}` : "";
  const summary = pursue ? `现实追求：${pursue.labels.join("、")}` : "";
  if (!result.result || result.result.headline !== headline) issues.push("结论与底层动力不一致");
  if (result.result && result.result.summary !== summary) issues.push("摘要与现实追求不一致");
  if (result.result && result.result.code !== null) issues.push("六芒星没有类型码");
  if (result.result && Array.isArray(result.result.flags) && result.result.flags.length) {
    issues.push("六芒星没有分数标记");
  }

  const blocks = []
    .concat(result.interpretation || [], result.recommendations || [])
    .map((item) => item && item.text);
  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  }
  for (const note of NOTES) {
    if (!blocks.includes(note)) issues.push("页面说明不完整");
  }

  const view = result.reportContent && result.reportContent.viewModel;
  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!view || !drive || !pursue) {
    issues.push("缺少视图");
  } else {
    if (JSON.stringify(view.driveOrder) !== JSON.stringify(drive.labels)) issues.push("视图与底层动力不一致");
    if (JSON.stringify(view.pursueOrder) !== JSON.stringify(pursue.labels)) issues.push("视图与现实追求不一致");
  }
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");

  const consent = result.extensionData && result.extensionData.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && consent.version !== CONSENT_VERSION) issues.push("同意文案版本不对");
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  }
  if (result.extensionData && result.extensionData.profile) issues.push("六芒星不保存资料页");
  const attribution = result.extensionData && result.extensionData.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of ["mentorId", "activity"]) {
      if (attribution[key] == null || attribution[key] === "") continue;
      if (typeof attribution[key] !== "string" || Array.from(attribution[key]).length > 40) {
        issues.push(`${key} 太长`);
      }
    }
  }
  if (!result.extensionData || !result.extensionData.compat || result.extensionData.compat.level !== "full") {
    issues.push("六芒星这一期按完整结果保存");
  }

  const source = result.source;
  if (!source || source.path !== "star/index.html" || source.origin !== "in-repo") issues.push("来源不对");
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== "star") issues.push("resultKit 标识不对");

  if (drive && pursue && (drive.labels.length !== KEEP || pursue.labels.length !== REVIVE)) {
    issues.push("词的数量不对");
  }
  return issues;
}

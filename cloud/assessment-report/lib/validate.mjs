import { KEEP, REVIVE, WORDS } from "../words.mjs";
import {
  PDQ4_CONSENT_VERSION,
  PDQ4_READER_GAP,
  PDQ4_SCREEN_TEXT,
  PDQ4_VERSION,
  QUESTION_COUNT,
  SCALES as PDQ4_SCALES,
  pdq4Flags,
  scorePdq4,
} from "../vendor/pdq4-score.mjs";
import {
  DIMENSIONS as ECR_DIMENSIONS,
  ECR_CONSENT_VERSION,
  ECR_READER_GAP,
  ECR_SCREEN_TEXT,
  ECR_VERSION,
  QUESTION_COUNT as ECR_QUESTION_COUNT,
  ecrDimension,
  ecrFlags,
  ecrOutcome,
  ecrViewModel,
  scoreEcr,
} from "../vendor/ecr-score.mjs";
import {
  ROOT_CONSENT_VERSION,
  ROOT_READER_GAP,
  ROOT_VERSION,
  developmentAnswersOk,
  lifeMapAnswersOk,
  rootBodyParts,
} from "../vendor/root-score.mjs";
import {
  LOVES5_CONSENT_VERSION,
  LOVES5_READER_GAP,
  LOVES5_VERSION,
  loves5BodyParts,
  loves5PicksOk,
} from "../vendor/loves5-score.mjs";
import {
  JUYING_CONSENT_VERSION,
  JUYING_DISCLAIMER,
  JUYING_READER_GAP,
  JUYING_SCREEN,
  JUYING_VERSION,
  juyingAnswersOk,
  juyingBodyParts,
} from "../vendor/juying-score.mjs";
import {
  HOLLAND_CONSENT_VERSION,
  HOLLAND_READER_GAP,
  HOLLAND_VERSION,
  hollandAnswersOk,
  hollandBodyParts,
  hollandExploreOk,
} from "../vendor/holland-score.mjs";
import {
  ZHENAI_CONSENT_VERSION,
  ZHENAI_READER_GAP,
  ZHENAI_VERSION,
  zhenaiAnswersOk,
  zhenaiBodyParts,
} from "../vendor/zhenai-score.mjs";
import {
  GCD_CONSENT_VERSION,
  GCD_READER_GAP,
  GCD_VERSION,
  gcdBodyParts,
  gcdInputOk,
} from "../vendor/gcd-score.mjs";
import {
  SENSMAP_CONSENT_VERSION,
  SENSMAP_READER_GAP,
  SENSMAP_VERSION,
  sensmapAnswersOk,
  sensmapBodyParts,
} from "../vendor/sensmap-score.mjs";
import {
  BEATTIE_READER_GAP,
  beattieBodyParts,
  beattieConsent,
  beattieSpec,
  beattieVersion,
} from "../vendor/beattie-score.mjs";
import { ALLOWED_ASSESSMENT_IDS, REPORT_ID_RE, SECRET_RE, SUBMISSION_RE } from "./ids.mjs";

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

const PHONE_VALUE = /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/;
const PARTIAL_SCOPES = ["store", "share_link", "mentor_read"];

function scanSensitive(value, issues, path) {
  if (!value || typeof value !== "object") return;
  const keys = Array.isArray(value) ? [] : Object.keys(value);
  for (const key of keys) {
    if (/^(customText|angerFill)$/i.test(key)) issues.push(`${path}.${key} 不能保存`);
    const story = path === "result"
      || path === "result.extensionData"
      || path === "result.reportContent"
      || path === "result.reportContent.viewModel";
    if (/^narrative$/i.test(key) && story) issues.push(`${path}.${key} 不能保存`);
    scanSensitive(value[key], issues, `${path}.${key}`);
  }
  if (Array.isArray(value)) value.forEach((item, index) => scanSensitive(item, issues, `${path}[${index}]`));
}

function scanPhones(value, issues, path) {
  if (typeof value === "string") {
    if (PHONE_VALUE.test(value)) issues.push(`${path} 不能保存手机号`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPhones(item, issues, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) scanPhones(value[key], issues, `${path}.${key}`);
  }
}

function checkPartialFrame(result, issues, spec) {
  scanKeys(result, issues, "result");
  scanPhones(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== spec.id) issues.push("测评不在可保存范围内");
  if (!String(result.assessmentName || "").includes(spec.name)) issues.push("测评名称不对");
  if (result.assessmentVersion !== spec.version) issues.push("规则版本不对");
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");
  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!result.reportContent || !result.reportContent.viewModel) issues.push("缺少视图");
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");
  const extension = result.extensionData;
  if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
    issues.push("缺少扩展数据");
  } else {
    for (const key of Object.keys(extension)) {
      if (!spec.extensionKeys.has(key)) issues.push(`不能保存额外字段 extensionData.${key}`);
    }
  }
  const consent = extension && extension.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && consent.version !== spec.consent) issues.push("同意文案版本不对");
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  } else if (scopes.some((scope) => !PARTIAL_SCOPES.includes(scope))) {
    issues.push("同意范围不能包含档案或电话");
  }
  const attribution = extension && extension.attribution;
  if (attribution != null) {
    if (typeof attribution !== "object" || Array.isArray(attribution)) issues.push("来源标注格式不对");
    else {
      for (const key of Object.keys(attribution)) {
        if (key !== "mentorId" && key !== "activity") issues.push(`不能保存额外字段 attribution.${key}`);
        const value = attribution[key];
        if (value == null || value === "") continue;
        if (typeof value !== "string" || Array.from(value).length > 40) issues.push(`${key} 太长`);
      }
    }
  }
  const compat = extension && extension.compat;
  if (!compat || compat.level !== "partial") issues.push(`${spec.label}这一期按部分兼容保存`);
  if (!compat || !Array.isArray(compat.gaps) || !compat.gaps.includes(spec.gap)) {
    issues.push("阅读页缺口说明不完整");
  }
  const source = result.source;
  if (!source || source.origin !== (spec.origin || "external-repo") || source.repo !== spec.repo || source.path !== spec.path) {
    issues.push("来源不对");
  }
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== spec.resultKitId) issues.push("resultKit 标识不对");
  const view = result.reportContent && result.reportContent.viewModel;
  const rushed = view && view.rushed;
  if (typeof rushed !== "boolean" || !sameValue(extension && extension.quality, { rushed })) {
    issues.push("作答速度标记不一致");
  }
  return { view, extension, rushed };
}

function checkBody(result, issues, parts) {
  if (!parts) return;
  if (!sameValue(result.dimensions, parts.dimensions)) issues.push("维度与作答不一致");
  if (!sameValue(result.result, parts.result)) issues.push("结论与作答不一致");
  if (!sameValue(result.interpretation, parts.interpretation)) issues.push("解释与作答不一致");
  if (!sameValue(result.recommendations, parts.recommendations)) issues.push("建议与作答不一致");
  if (!sameValue(result.reportContent, parts.reportContent)) issues.push("视图与作答不一致");
  if (!sameValue(result.extensionData && result.extensionData.score, parts.score)) issues.push("扩展分数与作答不一致");
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
  if (result.assessmentId !== "star") issues.push("测评不在可保存范围内");
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

export const SEFS_VERSION = "sefs-h5-v1";
export const SEFS_CONSENT_VERSION = "consent-assessment-sefs-1";
export const SEFS_NAME = "SEFS · 主观体验功能状态量表";
export const SEFS_READER_GAP = "统一阅读页目前只重绘职业六芒星，SEFS 的阅读页会另开 mindtest-web 任务。链接和存档已按统一协议保存。";
const SEFS_TIED_ADVICE = "本次有多个并列维度。可以先选一个自己最想了解、最不让你感到负担的方向，慢慢观察。";
const SEFS_COMPLEX = "按草案规则，有至少两个维度达到 15 分，属于“复合关注”模式。得分排序只是本次观察顺序，不等于临床干预优先级。";
const SEFS_SINGLE = "按草案规则，本次未达到“两个及以上维度均不少于 15 分”的复合关注条件。";
const SEFS_LABEL = "探索性分析 · 非病理诊断";
const SEFS_DIMS = [
  { id: "breadth", title: "体验广度", type: "体验压缩型", suggest: "先从微弱而具体的身体感受开始，例如温度、触感或一点点好奇。无需要求自己立刻快乐。" },
  { id: "capacity", title: "体验容纳", type: "体验泛滥型", suggest: "在情绪很满的时候，先关注当下的安全感和稳定感；可以暂停、休息，或联系值得信任的人，不急着追溯痛苦来源。" },
  { id: "belonging", title: "体验归属", type: "体验割裂型", suggest: "温和地留意此时此地可以确认的事物，例如双脚与地面的接触、眼前的颜色。若疏离感明显或持续，建议寻求专业支持。" },
  { id: "autonomy", title: "体验自主", type: "体验被侵占型", suggest: "试着把“别人期待我怎样感受”和“我此刻真实的感受”分别写下来。看见差异就已是一步，不必立刻做出重大改变。" },
];

function sefsLevel(score) {
  return score <= 7 ? "功能基本完好" : score <= 11 ? "轻度受损" : score <= 18 ? "中度受损" : "重度受损";
}

function sefsScore(answers) {
  const scores = [0, 1, 2, 3].map((index) => answers.slice(index * 6, index * 6 + 6).reduce((sum, value) => sum + value, 0));
  const max = Math.max(...scores);
  const leaders = scores.map((score, index) => (score === max ? index : -1)).filter((index) => index >= 0);
  const complex = scores.filter((score) => score >= 15).length >= 2;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return { scores, total, leaders, complex };
}

function sefsAnswersOk(list) {
  return Array.isArray(list)
    && list.length === 24
    && list.every((value) => Number.isInteger(value) && value >= 0 && value <= 4);
}

function sefsNarrative(scored) {
  const names = scored.leaders.map((index) => `${SEFS_DIMS[index].title}（${SEFS_DIMS[index].type}）`);
  const lead = scored.leaders.length > 1
    ? `并列最高的体验方向：${names.join("、")}`
    : `相对突出的体验方向：${names[0]}`;
  const advice = scored.leaders.length === 1 ? SEFS_DIMS[scored.leaders[0]].suggest : SEFS_TIED_ADVICE;
  const comp = scored.complex ? SEFS_COMPLEX : SEFS_SINGLE;
  const ranking = scored.scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => `${SEFS_DIMS[item.index].title} ${item.score}分`)
    .join(" · ");
  return {
    lead,
    advice,
    comp,
    summary: `${comp}可以尝试：${advice}`,
    ranking: `四维度从高到低：${ranking}。`,
    flags: [].concat(scored.complex ? ["complex"] : [], scored.leaders.length > 1 ? ["tied"] : []),
  };
}

export function validateSefsResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  scanKeys(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== "sefs") issues.push("测评不在可保存范围内");
  if (result.assessmentName !== SEFS_NAME) issues.push("测评名称不对");
  if (result.assessmentVersion !== SEFS_VERSION) issues.push("规则版本不对");
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");

  const view = result.reportContent && result.reportContent.viewModel;
  const answers = view && view.answers;
  const answersOk = sefsAnswersOk(answers);
  if (!answersOk) issues.push("作答需要 24 道 0–4 的整数题");
  const scored = answersOk ? sefsScore(answers) : null;
  const text = scored ? sefsNarrative(scored) : null;

  const dimensions = result.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== 4) issues.push("SEFS 需要四条分数维度");
  else {
    dimensions.forEach((side, index) => {
      const spec = SEFS_DIMS[index];
      if (!side || typeof side !== "object") {
        issues.push(`维度 ${spec.id} 缺失`);
        return;
      }
      if (side.id !== spec.id) issues.push(`${spec.id} 标识不对`);
      if (side.name !== spec.title) issues.push(`${spec.id} 名称不对`);
      if (side.kind !== "score") issues.push(`${spec.id} 必须是分数维度`);
      if (side.max !== 24) issues.push(`${spec.id} 满分不对`);
      if (!Array.isArray(side.labels) || side.labels.length !== 0) issues.push(`${spec.id} 不保存词`);
      if (scored && side.score !== scored.scores[index]) issues.push(`${spec.id} 分数与作答不一致`);
      if (Number.isInteger(side.score) && side.level !== sefsLevel(side.score)) issues.push(`${spec.id} 分段不对`);
      if (side.levelLabel !== spec.type) issues.push(`${spec.id} 类型不对`);
    });
  }

  const outcome = result.result;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) issues.push("缺少结论");
  else if (text) {
    if (outcome.headline !== text.lead) issues.push("结论与四维分数不一致");
    if (outcome.summary !== text.summary) issues.push("摘要与四维分数不一致");
    if (outcome.code !== null) issues.push("SEFS 没有类型码");
    if (outcome.label !== SEFS_LABEL) issues.push("结论标签不对");
    if (JSON.stringify(outcome.flags) !== JSON.stringify(text.flags)) issues.push("分数标记与作答不一致");
  }

  const blocks = []
    .concat(result.interpretation || [], result.recommendations || [])
    .map((item) => item && item.text);
  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  } else if (text) {
    for (const note of [text.lead, text.comp, text.ranking, `可以尝试：${text.advice}`, SEFS_READER_GAP]) {
      if (!blocks.includes(note)) issues.push("页面说明不完整");
    }
  }

  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!view) issues.push("缺少视图");
  else if (scored) {
    if (JSON.stringify(view.scores) !== JSON.stringify(scored.scores)) issues.push("视图与分数不一致");
    if (view.total !== scored.total) issues.push("总分不一致");
    if (JSON.stringify(view.leaders) !== JSON.stringify(scored.leaders)) issues.push("突出维度不一致");
    if (view.complex !== scored.complex) issues.push("复合关注标记不一致");
    if (JSON.stringify(view.levels) !== JSON.stringify(scored.scores.map(sefsLevel))) issues.push("视图分段不一致");
  }
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");

  const extension = result.extensionData;
  const consent = extension && extension.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && consent.version !== SEFS_CONSENT_VERSION) issues.push("同意文案版本不对");
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  }
  if (extension && extension.profile) issues.push("SEFS 不保存资料页");
  const attribution = extension && extension.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of ["mentorId", "activity"]) {
      if (attribution[key] == null || attribution[key] === "") continue;
      if (typeof attribution[key] !== "string" || Array.from(attribution[key]).length > 40) {
        issues.push(`${key} 太长`);
      }
    }
  }
  if (scored) {
    const stored = extension && extension.score;
    const storedAnswers = extension && extension.answers;
    if (!stored
      || JSON.stringify(stored.scores) !== JSON.stringify(scored.scores)
      || stored.total !== scored.total
      || JSON.stringify(stored.leaders) !== JSON.stringify(scored.leaders)
      || stored.complex !== scored.complex) {
      issues.push("扩展分数与作答不一致");
    }
    if (JSON.stringify(storedAnswers) !== JSON.stringify(answers)) issues.push("扩展作答与视图不一致");
  }
  const compat = extension && extension.compat;
  if (!compat || compat.level !== "partial") issues.push("SEFS 这一期按部分兼容保存");
  if (!compat || !Array.isArray(compat.gaps) || !compat.gaps.includes(SEFS_READER_GAP)) {
    issues.push("阅读页缺口说明不完整");
  }

  const source = result.source;
  if (!source || source.path !== "sefs/index.html" || source.origin !== "external-repo") issues.push("来源不对");
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== "sefs") issues.push("resultKit 标识不对");
  return issues;
}

const SCL90_FACTORS = [
  { id: "som", name: "躯体化", items: [1, 4, 12, 27, 40, 42, 48, 49, 52, 53, 56, 58] },
  { id: "oc", name: "强迫症状", items: [3, 9, 10, 28, 38, 45, 46, 51, 55, 65] },
  { id: "is", name: "人际关系敏感", items: [6, 21, 34, 36, 37, 41, 61, 69, 73] },
  { id: "dep", name: "抑郁", items: [5, 14, 15, 20, 22, 26, 29, 30, 31, 32, 54, 71, 79] },
  { id: "anx", name: "焦虑", items: [2, 17, 23, 33, 39, 57, 72, 78, 80, 86] },
  { id: "hos", name: "敌对", items: [11, 24, 63, 67, 74, 81] },
  { id: "phob", name: "恐怖", items: [13, 25, 47, 50, 70, 75, 82] },
  { id: "par", name: "偏执", items: [8, 18, 43, 68, 76, 83] },
  { id: "psy", name: "精神病性", items: [7, 16, 35, 62, 77, 84, 85, 87, 88, 90] },
  { id: "add", name: "其他", items: [19, 44, 59, 60, 64, 66, 89] },
];
const SCL90_LEVELS = [
  { id: "none", label: "无明显症状", max: 2 },
  { id: "mild", label: "轻度", max: 3 },
  { id: "moderate", label: "中度", max: 4 },
  { id: "severe", label: "重度", max: 5 },
];
const SCL90_VERDICT_POS = "筛查阳性";
const SCL90_VERDICT_NEG = "筛查阴性";
const SCL90_TEXT_POS = "按国内常用筛查标准，总分、阳性项目数、九个症状因子这三条里，至少有一条超过界值。这表示最近一周的不适，在范围或强度上需要认真看一看。它是筛查，不是诊断。";
const SCL90_TEXT_NEG = "按国内常用筛查标准，总分未超过 160，阳性项目数未超过 43，九个症状因子的均分都没有超过 2。最近一周的这些感受，整体还在常用界值以内。量表不能排除所有问题。";

function scl90Round2(value) {
  return Math.round(value * 100) / 100;
}

function scl90Level(mean) {
  return SCL90_LEVELS.find((level) => mean <= level.max) || SCL90_LEVELS[SCL90_LEVELS.length - 1];
}

function scl90AnswersOk(list) {
  return Array.isArray(list)
    && list.length === 90
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
}

function scl90Same(left, right) {
  if (left == null && right == null) return true;
  return typeof left === "number" && typeof right === "number" && Math.abs(left - right) < 0.001;
}

export function scoreScl90Answers(answers) {
  const total = answers.reduce((sum, value) => sum + value, 0);
  const positiveCount = answers.filter((value) => value >= 2).length;
  const positiveSum = answers.reduce((sum, value) => sum + (value >= 2 ? value : 0), 0);
  const positiveMean = positiveCount === 0 ? null : scl90Round2(positiveSum / positiveCount);
  const factors = SCL90_FACTORS.map((factor) => {
    const raw = factor.items.reduce((sum, n) => sum + answers[n - 1], 0);
    const exact = raw / factor.items.length;
    const level = scl90Level(exact);
    return {
      id: factor.id,
      name: factor.name,
      raw,
      score: scl90Round2(exact),
      exact,
      level: level.id,
      levelLabel: level.label,
      screened: exact > 2,
    };
  });
  const nineHit = factors.some((factor) => factor.id !== "add" && factor.screened);
  const positive = total > 160 || positiveCount > 43 || nineHit;
  return {
    total,
    gsi: scl90Round2(total / answers.length),
    positiveCount,
    negativeCount: answers.length - positiveCount,
    positiveMean,
    positive,
    headline: positive ? SCL90_VERDICT_POS : SCL90_VERDICT_NEG,
    summary: positive ? SCL90_TEXT_POS : SCL90_TEXT_NEG,
    code: positive ? "positive" : "negative",
    flags: positive ? ["positive"] : [],
    factors,
  };
}

export function validateScl90Result(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  scanKeys(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== "scl90") issues.push("测评不在可保存范围内");
  const name = String(result.assessmentName || "");
  if (!name.includes("SCL-90") || !name.includes("症状自评量表")) issues.push("测评名称不对");
  if (typeof result.assessmentVersion !== "string" || result.assessmentVersion.length < 1 || result.assessmentVersion.length > 40) {
    issues.push("规则版本不对");
  }
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");

  const view = result.reportContent && result.reportContent.viewModel;
  const answers = view && view.answers;
  const answersOk = scl90AnswersOk(answers);
  if (!answersOk) issues.push("作答需要 90 道 1–5 的整数题");
  const scored = answersOk ? scoreScl90Answers(answers) : null;

  const dimensions = result.dimensions;
  const viewFactors = view && view.factors;
  if (!Array.isArray(dimensions) || dimensions.length !== 10) issues.push("SCL-90 需要十条因子");
  else {
    dimensions.forEach((side, index) => {
      const spec = scored ? scored.factors[index] : SCL90_FACTORS[index];
      if (!side || typeof side !== "object") {
        issues.push(`因子 ${SCL90_FACTORS[index].id} 缺失`);
        return;
      }
      if (side.id !== SCL90_FACTORS[index].id) issues.push(`${SCL90_FACTORS[index].id} 标识不对`);
      if (side.name !== SCL90_FACTORS[index].name) issues.push(`${SCL90_FACTORS[index].id} 名称不对`);
      if (side.kind !== "score") issues.push(`${SCL90_FACTORS[index].id} 必须是分数维度`);
      if (side.max !== 5) issues.push(`${SCL90_FACTORS[index].id} 满分不对`);
      if (side.labels != null && (!Array.isArray(side.labels) || side.labels.length !== 0)) {
        issues.push(`${SCL90_FACTORS[index].id} 不保存词`);
      }
      if (scored && !scl90Same(side.score, spec.score)) issues.push(`${SCL90_FACTORS[index].id} 分数与作答不一致`);
      if (scored && side.raw !== spec.raw) issues.push(`${SCL90_FACTORS[index].id} 原始分与作答不一致`);
      if (scored && side.level !== spec.level) issues.push(`${SCL90_FACTORS[index].id} 分段不对`);
      if (scored && side.levelLabel !== spec.levelLabel) issues.push(`${SCL90_FACTORS[index].id} 分段名称不对`);
      const viewSide = Array.isArray(viewFactors) ? viewFactors[index] : null;
      if (!viewSide || viewSide.id !== side.id || (scored && (!scl90Same(viewSide.score, spec.score) || viewSide.raw !== spec.raw))) {
        issues.push(`${SCL90_FACTORS[index].id} 视图与维度不一致`);
      }
    });
  }

  const outcome = result.result;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) issues.push("缺少结论");
  else if (scored) {
    if (outcome.headline !== scored.headline) issues.push("结论与筛查结果不一致");
    if (outcome.summary !== scored.summary) issues.push("摘要与筛查结果不一致");
    if (outcome.code !== scored.code) issues.push("筛查码与作答不一致");
    if (outcome.label !== scored.headline) issues.push("结论标签不对");
    if (JSON.stringify(outcome.flags) !== JSON.stringify(scored.flags)) issues.push("分数标记与作答不一致");
  }

  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  }
  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!view) issues.push("缺少视图");
  else if (scored) {
    if (view.total !== scored.total) issues.push("总分与作答不一致");
    if (!scl90Same(view.gsi, scored.gsi)) issues.push("总症状指数与作答不一致");
    if (view.positiveCount !== scored.positiveCount) issues.push("阳性项目数与作答不一致");
    if (!scl90Same(view.positiveMean, scored.positiveMean)) issues.push("阳性症状均分与作答不一致");
    if (view.positive !== scored.positive) issues.push("筛查结论与作答不一致");
  }
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");

  const extension = result.extensionData;
  const consent = extension && extension.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && (typeof consent.version !== "string" || consent.version.length < 1 || consent.version.length > 40)) {
    issues.push("同意文案版本不对");
  }
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  }
  const attribution = extension && extension.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of ["mentorId", "activity"]) {
      if (attribution[key] == null || attribution[key] === "") continue;
      if (typeof attribution[key] !== "string" || Array.from(attribution[key]).length > 40) {
        issues.push(`${key} 太长`);
      }
    }
  }
  if (scored) {
    const stored = extension && extension.score;
    const storedFactors = stored && stored.factors;
    if (!stored
      || stored.total !== scored.total
      || !scl90Same(stored.gsi, scored.gsi)
      || stored.positiveCount !== scored.positiveCount
      || !scl90Same(stored.positiveMean, scored.positiveMean)
      || stored.positive !== scored.positive
      || !Array.isArray(storedFactors)
      || storedFactors.length !== 10
      || storedFactors.some((factor, index) => !factor
        || factor.id !== scored.factors[index].id
        || factor.raw !== scored.factors[index].raw
        || !scl90Same(factor.mean, scored.factors[index].score))) {
      issues.push("扩展分数与作答不一致");
    }
    if (JSON.stringify(extension.answers) !== JSON.stringify(answers)) issues.push("扩展作答与视图不一致");
  }

  const source = result.source;
  if (!source || source.origin !== "external-repo" || source.repo !== "mindtest" || source.path !== "scl90/index.html") {
    issues.push("来源不对");
  }
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== "scl90") issues.push("resultKit 标识不对");
  return issues;
}

function sameValue(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => sameValue(item, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]));
}

function pdq4AnswersOk(list) {
  return Array.isArray(list)
    && list.length === QUESTION_COUNT
    && list.every((value) => value === 0 || value === 1);
}

function pdq4ScaleView(scale) {
  return {
    id: scale.id,
    name: scale.name,
    alias: scale.alias || "",
    cluster: scale.cluster,
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
  };
}

function pdq4Dimension(scale) {
  return {
    id: scale.id,
    name: scale.name,
    kind: "score",
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
    cluster: scale.cluster,
    level: scale.positive ? "positive" : "negative",
    levelLabel: scale.positive ? "达到划界" : "未达到",
    narrative: scale.about,
    labels: [],
  };
}

export function validatePdq4Result(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  scanKeys(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== "pdq4") issues.push("测评不在可保存范围内");
  const name = String(result.assessmentName || "");
  if (!name.includes("PDQ-4") || !name.includes("人格障碍筛查")) issues.push("测评名称不对");
  if (result.assessmentVersion !== PDQ4_VERSION) issues.push("规则版本不对");
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");

  const view = result.reportContent && result.reportContent.viewModel;
  const answers = view && view.answers;
  const answersOk = pdq4AnswersOk(answers);
  if (!answersOk) issues.push("作答需要 126 道 0 或 1 的题");
  const scored = answersOk ? scorePdq4(answers) : null;

  const dimensions = result.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== 12) issues.push("PDQ-4 需要十二条分量表");
  else if (scored) {
    dimensions.forEach((side, index) => {
      const scale = scored.scales[index];
      if (!sameValue(side, pdq4Dimension(scale))) issues.push(`${scale.id} 与作答不一致`);
    });
  } else {
    dimensions.forEach((side, index) => {
      const scale = PDQ4_SCALES[index];
      if (!side || side.id !== scale.id) issues.push(`${scale.id} 标识不对`);
    });
  }

  const outcome = result.result;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) issues.push("缺少结论");
  else if (scored) {
    if (outcome.headline !== scored.verdict.title) issues.push("结论与筛查结果不一致");
    if (outcome.summary !== scored.verdict.text) issues.push("摘要与筛查结果不一致");
    if (outcome.code !== scored.verdict.id) issues.push("筛查码与作答不一致");
    if (outcome.label !== scored.verdict.title) issues.push("结论标签不对");
    if (!sameValue(outcome.flags, pdq4Flags(scored))) issues.push("分数标记与作答不一致");
  }

  const blocks = []
    .concat(result.interpretation || [], result.recommendations || [])
    .map((item) => item && item.text);
  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  } else if (!blocks.includes(PDQ4_SCREEN_TEXT)) {
    issues.push("筛查说明不完整");
  }
  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!view) issues.push("缺少视图");
  else if (scored) {
    if (!sameValue(view.scales, scored.scales.map(pdq4ScaleView))) issues.push("视图量表与作答不一致");
    if (view.positiveCount !== scored.positiveCount) issues.push("阳性量表数与作答不一致");
    if (view.total !== scored.total) issues.push("总分与作答不一致");
    if (!sameValue(view.tooGood, scored.tooGood)) issues.push("掩饰分与作答不一致");
    if (!sameValue(view.suspect, scored.suspect)) issues.push("怀疑分与作答不一致");
    if (!sameValue(view.impulse, scored.impulse)) issues.push("冲动合成与作答不一致");
    if (!sameValue(view.conduct, scored.conduct)) issues.push("品行合成与作答不一致");
    if (!sameValue(view.verdict, scored.verdict)) issues.push("视图结论与作答不一致");
  }
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");

  const extension = result.extensionData;
  const consent = extension && extension.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && consent.version !== PDQ4_CONSENT_VERSION) issues.push("同意文案版本不对");
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  }
  if (extension && extension.profile) issues.push("PDQ-4 不保存资料页");
  const attribution = extension && extension.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of ["mentorId", "activity"]) {
      if (attribution[key] == null || attribution[key] === "") continue;
      if (typeof attribution[key] !== "string" || Array.from(attribution[key]).length > 40) {
        issues.push(`${key} 太长`);
      }
    }
  }
  const rushed = view && view.rushed;
  const quality = extension && extension.quality;
  if (typeof rushed !== "boolean" || !quality || quality.rushed !== rushed) {
    issues.push("作答速度标记不一致");
  }
  if (scored) {
    if (!sameValue(extension && extension.score, scored)) issues.push("扩展分数与作答不一致");
    if (!sameValue(extension && extension.answers, answers)) issues.push("扩展作答与视图不一致");
  }
  const compat = extension && extension.compat;
  if (!compat || compat.level !== "partial") issues.push("PDQ-4 这一期按部分兼容保存");
  if (!compat || !Array.isArray(compat.gaps) || !compat.gaps.includes(PDQ4_READER_GAP)) {
    issues.push("阅读页缺口说明不完整");
  }

  const source = result.source;
  if (!source || source.origin !== "external-repo" || source.repo !== "mindtest" || source.path !== "pdq/index.html") {
    issues.push("来源不对");
  }
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== "pdq4") issues.push("resultKit 标识不对");
  return issues;
}

function ecrAnswersOk(list) {
  return Array.isArray(list)
    && list.length === ECR_QUESTION_COUNT
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 7);
}

export function validateEcrResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  scanKeys(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== "ecr") issues.push("测评不在可保存范围内");
  const name = String(result.assessmentName || "");
  if (!name.includes("ECR") || !name.includes("亲密关系经历量表")) issues.push("测评名称不对");
  if (result.assessmentVersion !== ECR_VERSION) issues.push("规则版本不对");
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");

  const view = result.reportContent && result.reportContent.viewModel;
  const answers = view && view.answers;
  const answersOk = ecrAnswersOk(answers);
  if (!answersOk) issues.push("作答需要 36 道 1–7 的整数题");
  let scored = null;
  if (answersOk) {
    try {
      scored = scoreEcr(answers);
    } catch {
      issues.push("作答需要 36 道 1–7 的整数题");
    }
  }

  const dimensions = result.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== 2) issues.push("ECR 需要依恋回避和依恋焦虑");
  else if (scored) {
    dimensions.forEach((side, index) => {
      const dimension = scored.dimensions[index];
      if (!sameValue(side, ecrDimension(dimension))) issues.push(`${dimension.id} 与作答不一致`);
    });
  } else {
    dimensions.forEach((side, index) => {
      const dimension = ECR_DIMENSIONS[index];
      if (!side || side.id !== dimension.id) issues.push(`${dimension.id} 标识不对`);
    });
  }

  const outcome = result.result;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) issues.push("缺少结论");
  else if (scored) {
    const expected = ecrOutcome(scored);
    if (outcome.headline !== expected.headline) issues.push("结论与类型不一致");
    if (outcome.summary !== expected.summary) issues.push("摘要与类型不一致");
    if (outcome.code !== expected.code) issues.push("类型码与作答不一致");
    if (outcome.label !== expected.label) issues.push("结论标签不对");
    if (!sameValue(outcome.flags, ecrFlags(scored))) issues.push("分数标记与作答不一致");
  }

  const blocks = []
    .concat(result.interpretation || [], result.recommendations || [])
    .map((item) => item && item.text);
  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  } else if (!blocks.includes(ECR_SCREEN_TEXT)) {
    issues.push("筛查说明不完整");
  }
  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!view) issues.push("缺少视图");
  else if (scored && typeof view.rushed === "boolean" && !sameValue(view, ecrViewModel(scored, answers, view.rushed))) {
    issues.push("视图与作答不一致");
  }
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");

  const extension = result.extensionData;
  const consent = extension && extension.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && consent.version !== ECR_CONSENT_VERSION) issues.push("同意文案版本不对");
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  }
  if (extension && extension.profile) issues.push("ECR 不保存资料页");
  const attribution = extension && extension.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of ["mentorId", "activity"]) {
      if (attribution[key] == null || attribution[key] === "") continue;
      if (typeof attribution[key] !== "string" || Array.from(attribution[key]).length > 40) {
        issues.push(`${key} 太长`);
      }
    }
  }
  const rushed = view && view.rushed;
  const quality = extension && extension.quality;
  if (typeof rushed !== "boolean" || !quality || quality.rushed !== rushed) {
    issues.push("作答速度标记不一致");
  }
  if (scored) {
    if (!sameValue(extension && extension.score, scored)) issues.push("扩展分数与作答不一致");
    if (!sameValue(extension && extension.answers, answers)) issues.push("扩展作答与视图不一致");
  }
  const compat = extension && extension.compat;
  if (!compat || compat.level !== "partial") issues.push("ECR 这一期按部分兼容保存");
  if (!compat || !Array.isArray(compat.gaps) || !compat.gaps.includes(ECR_READER_GAP)) {
    issues.push("阅读页缺口说明不完整");
  }

  const source = result.source;
  if (!source || source.origin !== "external-repo" || source.repo !== "mindtest" || source.path !== "ecr/index.html") {
    issues.push("来源不对");
  }
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== "ecr") issues.push("resultKit 标识不对");
  return issues;
}

const ROOT_EXTENSION_KEYS = new Set([
  "answers", "developmentAnswers", "score", "quality", "consent", "compat", "attribution",
]);
const ROOT_SCOPES = ["store", "share_link", "mentor_read"];
const ROOT_ARCHIVE_KEY = /parent|father|mother|people|materials|journey|archive|openanswers|open_answers|opentext|open_text|birth|档案|父母|父亲|母亲/i;
const ROOT_PHONE_VALUE = /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/;

function scanRootArchive(value, issues, path) {
  if (!value || typeof value !== "object") return;
  const keys = Array.isArray(value) ? [] : Object.keys(value);
  for (const key of keys) {
    if (ROOT_ARCHIVE_KEY.test(key)) issues.push(`${path}.${key} 不能保存父母档案`);
    scanRootArchive(value[key], issues, `${path}.${key}`);
  }
  if (Array.isArray(value)) value.forEach((item, index) => scanRootArchive(item, issues, `${path}[${index}]`));
}

function scanRootPhones(value, issues, path) {
  if (typeof value === "string") {
    if (ROOT_PHONE_VALUE.test(value)) issues.push(`${path} 不能保存手机号`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanRootPhones(item, issues, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) scanRootPhones(value[key], issues, `${path}.${key}`);
  }
}

export function validateRootResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  scanKeys(result, issues, "result");
  scanRootArchive(result, issues, "result");
  scanRootPhones(result, issues, "result");
  for (const key of Object.keys(result)) {
    if (!TOP_KEYS.has(key)) issues.push(`不能保存额外字段 ${key}`);
  }
  if (!REPORT_ID_RE.test(String(result.reportId || ""))) issues.push("reportId 格式不对");
  if (result.assessmentId !== "root") issues.push("测评不在可保存范围内");
  const name = String(result.assessmentName || "");
  if (!name.includes("寻根") && !name.includes("生命成长地图")) issues.push("测评名称不对");
  if (result.assessmentVersion !== ROOT_VERSION) issues.push("规则版本不对");
  if (result.schemaVersion !== SCHEMA_VERSION) issues.push("协议版本不对");
  const nick = chars(result.nickname);
  if (nick.length < 1 || nick.length > 12) issues.push("昵称需要 1–12 个字");
  if (!Number.isFinite(Date.parse(result.completedAt))) issues.push("完成时间不对");

  const view = result.reportContent && result.reportContent.viewModel;
  const answers = view && view.answers;
  const developmentAnswers = view && view.developmentAnswers;
  const answersOk = lifeMapAnswersOk(answers);
  const developmentOk = developmentAnswersOk(developmentAnswers);
  if (!answersOk) issues.push("作答需要 33 道 1–5 的整数题（28 项能力 + 5 道家庭氛围）");
  if (!developmentOk) issues.push("发展题需要 4 道 1–5 的整数题");

  const dimensions = result.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== 12) issues.push("寻根之旅需要八项能力与四个模块");

  const outcome = result.result;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) issues.push("缺少结论");
  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  }
  if (!result.reportContent || result.reportContent.format !== "view-model+sections") {
    issues.push("报告快照格式不对");
  }
  if (!view) issues.push("缺少视图");
  const raw = JSON.stringify(result.reportContent || {});
  if (/data:(image|application\/pdf)|<!doctype|<html/i.test(raw)) issues.push("不能保存图片、PDF 或 HTML");

  const extension = result.extensionData;
  if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
    issues.push("缺少扩展数据");
  } else {
    for (const key of Object.keys(extension)) {
      if (!ROOT_EXTENSION_KEYS.has(key)) issues.push(`不能保存额外字段 extensionData.${key}`);
    }
  }
  const consent = extension && extension.consent;
  if (!consent || consent.agreed !== true) issues.push("未同意不能保存");
  if (consent && consent.version !== ROOT_CONSENT_VERSION) issues.push("同意文案版本不对");
  const scopes = consent && consent.scopes;
  if (!Array.isArray(scopes) || !scopes.includes("store") || !scopes.includes("share_link")) {
    issues.push("同意范围不足");
  } else if (scopes.some((scope) => !ROOT_SCOPES.includes(scope))) {
    issues.push("同意范围不能包含档案或电话");
  }
  const attribution = extension && extension.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of Object.keys(attribution)) {
      if (ROOT_ARCHIVE_KEY.test(key)) issues.push(`attribution.${key} 不能保存父母档案`);
      const value = attribution[key];
      if (value == null || value === "") continue;
      if (typeof value !== "string" || Array.from(value).length > 40) issues.push(`${key} 太长`);
    }
  }
  const rushed = view && view.rushed;
  if (typeof rushed !== "boolean" || !sameValue(extension && extension.quality, { rushed })) {
    issues.push("作答速度标记不一致");
  }
  if (answersOk && developmentOk && typeof rushed === "boolean") {
    let parts = null;
    try {
      parts = rootBodyParts(answers, developmentAnswers, rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答需要 33 道 1–5 的整数题（28 项能力 + 5 道家庭氛围）");
    else {
      if (!sameValue(result.dimensions, parts.dimensions)) issues.push("维度与作答不一致");
      if (!sameValue(result.result, parts.result)) issues.push("结论与作答不一致");
      if (!sameValue(result.interpretation, parts.interpretation)) issues.push("解释与作答不一致");
      if (!sameValue(result.recommendations, parts.recommendations)) issues.push("建议与作答不一致");
      if (!sameValue(result.reportContent, parts.reportContent)) issues.push("视图与作答不一致");
      if (!sameValue(extension && extension.score, parts.score)) issues.push("扩展分数与作答不一致");
      if (!sameValue(extension && extension.answers, answers)) issues.push("扩展作答与视图不一致");
      if (!sameValue(extension && extension.developmentAnswers, developmentAnswers)) {
        issues.push("扩展发展题与视图不一致");
      }
    }
  }
  const compat = extension && extension.compat;
  if (!compat || compat.level !== "partial") issues.push("寻根之旅这一期按部分兼容保存");
  if (!compat || !Array.isArray(compat.gaps) || !compat.gaps.includes(ROOT_READER_GAP)) {
    issues.push("阅读页缺口说明不完整");
  }

  const source = result.source;
  if (!source || source.origin !== "external-repo" || source.repo !== "root-journey-web" || source.path !== "index.html") {
    issues.push("来源不对");
  }
  if (!source || !SUBMISSION_RE.test(String(source.clientSubmissionId || ""))) issues.push("提交号格式不对");
  if (source && source.resultKitId !== "root") issues.push("resultKit 标识不对");
  return issues;
}

const LOVES5_EXTENSION_KEYS = new Set(["answers", "score", "quality", "consent", "compat", "attribution"]);

export function validateLoves5Result(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const frame = checkPartialFrame(result, issues, {
    id: "loves5",
    name: "爱的 5 种语言",
    version: LOVES5_VERSION,
    consent: LOVES5_CONSENT_VERSION,
    gap: LOVES5_READER_GAP,
    label: "爱的 5 种语言",
    repo: "5loves",
    path: "index.html",
    resultKitId: "loves5",
    extensionKeys: LOVES5_EXTENSION_KEYS,
  });
  const picks = frame.view && frame.view.picks;
  if (!loves5PicksOk(picks)) issues.push("作答需要 30 道二选一，每题只能是该题的语言码");
  if (loves5PicksOk(picks) && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = loves5BodyParts(picks, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答需要 30 道二选一，每题只能是该题的语言码");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(frame.extension && frame.extension.answers, picks)) issues.push("扩展作答与视图不一致");
    }
  }
  return issues;
}

const JUYING_EXTENSION_KEYS = new Set(["answers", "score", "quality", "consent", "compat", "attribution"]);

export function validateJuyingResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const frame = checkPartialFrame(result, issues, {
    id: "juying",
    name: "巨婴测评",
    version: JUYING_VERSION,
    consent: JUYING_CONSENT_VERSION,
    gap: JUYING_READER_GAP,
    label: "巨婴测评",
    repo: "juying",
    path: "index.html",
    resultKitId: "juying",
    extensionKeys: JUYING_EXTENSION_KEYS,
  });
  const answers = frame.view && frame.view.answers;
  if (!juyingAnswersOk(answers)) issues.push("作答需要 20 道 0–5 的整数题");
  const blocks = []
    .concat(result.interpretation || [], result.recommendations || [])
    .map((item) => item && item.text);
  if (!Array.isArray(result.interpretation) || !Array.isArray(result.recommendations)) {
    issues.push("解释和建议必须是列表");
  } else if (!blocks.includes(JUYING_SCREEN) || !blocks.includes(JUYING_DISCLAIMER)) {
    issues.push("非诊断说明不完整");
  }
  if (juyingAnswersOk(answers) && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = juyingBodyParts(answers, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答需要 20 道 0–5 的整数题");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(frame.extension && frame.extension.answers, answers)) issues.push("扩展作答与视图不一致");
    }
  }
  return issues;
}

const HOLLAND_EXTENSION_KEYS = new Set(["answers", "score", "openText", "quality", "consent", "compat", "attribution"]);

export function validateHollandResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const frame = checkPartialFrame(result, issues, {
    id: "holland",
    name: "霍兰德兴趣探索",
    version: HOLLAND_VERSION,
    consent: HOLLAND_CONSENT_VERSION,
    gap: HOLLAND_READER_GAP,
    label: "霍兰德兴趣探索",
    repo: "holland-explore",
    path: "index.html",
    resultKitId: "holland",
    extensionKeys: HOLLAND_EXTENSION_KEYS,
  });
  const answers = frame.view && frame.view.answers;
  const explore = frame.view && frame.view.explore;
  if (!hollandAnswersOk(answers)) issues.push("作答需要 60 道 1–5 的整数题");
  if (!hollandExploreOk(explore)) issues.push("探索题格式不对");
  if (hollandAnswersOk(answers) && hollandExploreOk(explore) && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = hollandBodyParts(answers, explore, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答需要 60 道 1–5 的整数题");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(frame.extension && frame.extension.answers, answers)) issues.push("扩展作答与视图不一致");
      if (!sameValue(frame.extension && frame.extension.openText, parts.openText)) issues.push("探索题与视图不一致");
    }
  }
  return issues;
}

const ZHENAI_EXTENSION_KEYS = new Set(["answers", "score", "quality", "consent", "compat", "attribution"]);
const GCD_EXTENSION_KEYS = ZHENAI_EXTENSION_KEYS;
const SENSMAP_EXTENSION_KEYS = new Set([
  "answers", "impact", "scenarioAnswers", "choice", "overrideSubId", "score", "quality", "consent", "compat", "attribution",
]);
const BEATTIE_EXTENSION_KEYS = ZHENAI_EXTENSION_KEYS;

export function validateZhenaiResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const frame = checkPartialFrame(result, issues, {
    id: "zhenai",
    name: "珍爱金字塔",
    version: ZHENAI_VERSION,
    consent: ZHENAI_CONSENT_VERSION,
    gap: ZHENAI_READER_GAP,
    label: "珍爱金字塔",
    repo: "zhenai-pyramid",
    path: "index.html",
    resultKitId: "zhenai",
    extensionKeys: ZHENAI_EXTENSION_KEYS,
  });
  const answers = frame.view && frame.view.answers;
  if (!zhenaiAnswersOk(answers)) issues.push("作答需要 36 道 1–5 的整数题");
  if (zhenaiAnswersOk(answers) && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = zhenaiBodyParts(answers, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答需要 36 道 1–5 的整数题");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(frame.extension && frame.extension.answers, answers)) issues.push("扩展作答与视图不一致");
    }
  }
  return issues;
}

export function validateGcdResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const frame = checkPartialFrame(result, issues, {
    id: "gcd",
    name: "个人充电",
    version: GCD_VERSION,
    consent: GCD_CONSENT_VERSION,
    gap: GCD_READER_GAP,
    label: "个人充电",
    repo: "geren-chongdian",
    path: "index.html",
    resultKitId: "gcd",
    extensionKeys: GCD_EXTENSION_KEYS,
  });
  const view = frame.view || {};
  const input = {
    stateId: view.stateId,
    customUnmatched: view.customUnmatched,
    sourceIds: view.sourceIds,
    dayIndex: view.dayIndex,
  };
  if (!gcdInputOk(input)) issues.push("状态或耗电来源不对");
  if (gcdInputOk(input) && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = gcdBodyParts(input, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("状态或耗电来源不对");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(frame.extension && frame.extension.answers, parts.answers)) issues.push("扩展作答与视图不一致");
    }
  }
  return issues;
}

export function validateSensmapResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const frame = checkPartialFrame(result, issues, {
    id: "sensmap",
    name: "高敏感心力地图",
    version: SENSMAP_VERSION,
    consent: SENSMAP_CONSENT_VERSION,
    gap: SENSMAP_READER_GAP,
    label: "高敏感心力地图",
    repo: "sensitive-map",
    path: "index.html",
    resultKitId: "sensmap",
    extensionKeys: SENSMAP_EXTENSION_KEYS,
  });
  const view = frame.view || {};
  const extension = frame.extension || {};
  const input = {
    answers: view.answers,
    impact: view.impact,
    scenarioAnswers: view.scenarioAnswers,
    choice: view.choice,
    overrideSubId: extension.overrideSubId,
  };
  if (!sensmapAnswersOk(input)) issues.push("作答、生活影响或情境题不完整");
  if (sensmapAnswersOk(input) && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = sensmapBodyParts(input, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答、生活影响或情境题不完整");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(extension.answers, parts.answers)) issues.push("扩展作答与视图不一致");
      if (!sameValue(extension.impact, parts.impact)) issues.push("生活影响与视图不一致");
      if (!sameValue(extension.scenarioAnswers, parts.scenarioAnswers)) issues.push("情境题与视图不一致");
      if (extension.choice !== parts.choice) issues.push("最先想改变的领域不一致");
      if (!sameValue(extension.overrideSubId, parts.overrideSubId)) issues.push("改看的方向不一致");
    }
  }
  return issues;
}

export function validateBeattieResult(result) {
  const issues = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const spec = beattieSpec(result.assessmentId);
  if (!spec) return ["测评不在可保存范围内"];
  const frame = checkPartialFrame(result, issues, {
    id: spec.id,
    name: spec.name,
    version: beattieVersion(spec.id),
    consent: beattieConsent(spec.id),
    gap: BEATTIE_READER_GAP,
    label: spec.name,
    repo: "mindtest-web",
    path: "beattie/index.html",
    resultKitId: spec.id,
    origin: "in-repo",
    extensionKeys: BEATTIE_EXTENSION_KEYS,
  });
  const view = frame.view || {};
  const input = { testId: spec.testId, likert: view.likert, mcq: view.mcq, tf: view.tf };
  const answersOk = Array.isArray(view.likert) && Array.isArray(view.mcq) && Array.isArray(view.tf);
  if (!answersOk || view.testId !== spec.testId) issues.push("作答和这套测试对不上");
  if (answersOk && view.testId === spec.testId && typeof frame.rushed === "boolean") {
    let parts = null;
    try {
      parts = beattieBodyParts(input, frame.rushed);
    } catch {
      parts = null;
    }
    if (!parts) issues.push("作答和这套测试对不上");
    else {
      checkBody(result, issues, parts);
      if (!sameValue(frame.extension && frame.extension.answers, parts.answers)) issues.push("扩展作答与视图不一致");
    }
  }
  return issues;
}

export function validateAssessmentResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  const sensitive = [];
  scanSensitive(result, sensitive, "result");
  if (sensitive.length) return sensitive;
  if (!ALLOWED_ASSESSMENT_IDS.includes(result.assessmentId)) return ["测评不在可保存范围内"];
  if (result.assessmentId === "sefs") return validateSefsResult(result);
  if (result.assessmentId === "star") return validateStarResult(result);
  if (result.assessmentId === "scl90") return validateScl90Result(result);
  if (result.assessmentId === "pdq4") return validatePdq4Result(result);
  if (result.assessmentId === "ecr") return validateEcrResult(result);
  if (result.assessmentId === "root") return validateRootResult(result);
  if (result.assessmentId === "loves5") return validateLoves5Result(result);
  if (result.assessmentId === "juying") return validateJuyingResult(result);
  if (result.assessmentId === "holland") return validateHollandResult(result);
  if (result.assessmentId === "zhenai") return validateZhenaiResult(result);
  if (result.assessmentId === "gcd") return validateGcdResult(result);
  if (result.assessmentId === "sensmap") return validateSensmapResult(result);
  if (typeof result.assessmentId === "string" && result.assessmentId.startsWith("beattie-")) return validateBeattieResult(result);
  return ["测评不在可保存范围内"];
}

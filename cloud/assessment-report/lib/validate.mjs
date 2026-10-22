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

export function validateAssessmentResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["结果必须是对象"];
  if (result.assessmentId === "sefs") return validateSefsResult(result);
  if (result.assessmentId === "star") return validateStarResult(result);
  return ["测评不在可保存范围内"];
}

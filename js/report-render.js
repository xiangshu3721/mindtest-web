import { QUESTIONS as ECR_QUESTIONS, OPTIONS as ECR_OPTIONS, REVERSE_ITEMS as ECR_REVERSE_ITEMS } from "../ecr/js/data.js";
import { QUESTIONS as PDQ_QUESTIONS } from "../pdq/js/data.js";
import { QUESTIONS as SCL_QUESTIONS } from "../scl90/js/data.js";
import { ASVA_READER_IDS, renderBeattieReport, renderGcdReport, renderSensmapReport, renderZhenaiReport } from "./asva-report.js";
import { renderHollandReport as renderHollandMap } from "./holland-report.js";
import { JUYING_BAND_COPY, JUYING_DEGREES, JUYING_GROUPS, JUYING_REFERENCE_INTRO } from "./juying-bands.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

const NICK_FALLBACK = "我";

export function visibleNickname(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || NICK_FALLBACK;
}

const SHARE_TITLES = {
  holland: "兴趣地图",
  sefs: "主观体验地图",
  scl90: "症状自评量表",
  pdq4: "人格筛查",
  ecr: "依恋结果",
  root: "生命成长地图",
  loves5: "爱的五种语言",
  juying: "巨婴测评",
  star: "职业六芒星",
  zhenai: "珍爱金字塔",
  gcd: "个人充电",
  sensmap: "心力地图",
  "beattie-emotional-health": "情绪健康测试",
  "beattie-anger": "愤怒测试",
  "beattie-fear": "恐惧测试",
  "beattie-drama": "戏剧化与不幸成瘾测试",
  "beattie-guilt": "内疚测试",
  "beattie-grief": "悲痛与失落测试",
};

export const KNOWN_READER_IDS = [
  "star", "sefs", "scl90", "pdq4", "ecr", "root", "loves5", "juying", "holland",
  ...ASVA_READER_IDS,
];

export function isKnownReader(id) {
  return KNOWN_READER_IDS.includes(id);
}

export function sharePageTitle(report) {
  const nick = visibleNickname(report && report.nickname);
  const id = report && report.assessmentId;
  if (typeof id === "string" && id.startsWith("beattie-")) {
    const view = report.reportContent && report.reportContent.viewModel;
    const phrase = view && typeof view.title === "string" && view.title.trim()
      ? view.title.trim()
      : SHARE_TITLES[id];
    if (phrase) return `${nick}的${phrase}`;
  }
  const phrase = SHARE_TITLES[id];
  if (phrase) return `${nick}的${phrase}`;
  const name = report && typeof report.assessmentName === "string" ? report.assessmentName.trim() : "";
  return name ? `${nick}的${name}` : `${nick}的测评报告`;
}

function nickMark(value) {
  return `<span class="share-nick">${esc(visibleNickname(value))}</span>`;
}

function personLine(value) {
  return `<p class="share-person">${nickMark(value)}</p>`;
}

function words(list) {
  return (list || []).map((word) => `<li>${esc(word)}</li>`).join("");
}

function when(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const STAR_DRIVE_SLOTS = ["at-ul", "at-ur", "at-bot"];
const STAR_PURSUE_SLOTS = ["at-top", "at-ll", "at-lr"];

function starTags(list, role, slots) {
  return (list || []).map((word, index) => {
    const slot = slots[index] || slots[slots.length - 1];
    return `<span class="tag ${role} ${slot}"><span class="ink">${esc(word)}</span></span>`;
  }).join("");
}

export function renderStarReport(report) {
  const drive = report.reportContent?.viewModel?.driveOrder || report.dimensions?.find((item) => item.id === "drive")?.labels || [];
  const pursue = report.reportContent?.viewModel?.pursueOrder || report.dimensions?.find((item) => item.id === "pursue")?.labels || [];
  const notes = []
    .concat(report.interpretation || [], report.recommendations || [])
    .map((item) => item && item.text)
    .filter(Boolean);
  return `
    <div class="star-map">
      <h1 class="star-title">${nickMark(report.nickname)}的职业六芒星</h1>
      <div class="capture">
        <figure class="plate">
          <p class="aside drive">底层动力</p>
          <p class="aside pursue">现实追求</p>
          <div class="sky">
            <svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
              <polygon class="up" points="50,8 86.4,71 13.6,71" />
              <polygon class="down" points="50,92 13.6,29 86.4,29" />
            </svg>
            ${starTags(drive, "drive", STAR_DRIVE_SLOTS)}
            ${starTags(pursue, "pursue", STAR_PURSUE_SLOTS)}
          </div>
          <p class="spine">职业六芒星</p>
        </figure>
        <section class="roster">
          <div>
            <h2 class="drive-name">底层动力</h2>
            <ul>${words(drive)}</ul>
          </div>
          <div>
            <h2 class="pursue-name">现实追求</h2>
            <ul>${words(pursue)}</ul>
          </div>
        </section>
      </div>
      ${notes.length ? `<ul class="notes">${notes.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>` : ""}
      <p class="meta">${esc(report.nickname)} · ${esc(when(report.completedAt))} · ${esc(report.assessmentVersion)}</p>
    </div>
  `;
}

// SEFS 阅读约定：不按 24 题重算。字段对齐 my-react-app sefs/cloud-payload.js 的 buildSefsResult。
// 维度 id：breadth、capacity、belonging、autonomy。level 是分档，levelLabel 是类型名。
// 总分用 viewModel.total（或四维相加）；headline / summary / interpretation / recommendations 照原文。
// recommendations 里 id 为 reader 的那句是「阅读页尚未接上」的旧说明，这里不再展示。
const SEFS_NOTICE = "本量表为所提供 SEFS 草案的 H5 测试版。题目、分段及类型解释尚未在此提供可核验的信效度、常模或临床验证信息。分数、主导方向和复合关注均是草案规则下的描述，不可用于确诊、排除疾病、决定治疗或判断安全风险。若困扰持续、影响生活，或测评引起明显不适，建议与合格的心理健康专业人员讨论；如有立即危险，请联系当地急救或危机支持服务。";
const SEFS_TAG = "探索性分析 · 非病理诊断";
const SEFS_READER_GAP = "统一阅读页目前只重绘职业六芒星";
const SEFS_IDS = [
  ["breadth", "breadth-of-experience", "range", "guangdu", "experience-breadth", "exp-breadth"],
  ["capacity", "contain", "containment", "holding", "rongna", "experience-contain", "exp-contain"],
  ["belonging", "belong", "ownership", "guishu", "experience-belong", "exp-belong"],
  ["autonomy", "agency", "self-direction", "zizhu", "experience-agency", "exp-agency"],
];
const SEFS_DIMS = [
  { name: "体验广度", type: "体验压缩型", brief: "感受的宽度与鲜活程度", color: "#79a993", suggest: "先从微弱而具体的身体感受开始，例如温度、触感或一点点好奇。无需要求自己立刻快乐。" },
  { name: "体验容纳", type: "体验泛滥型", brief: "情绪来临时的容纳与调节", color: "#d6a183", suggest: "在情绪很满的时候，先关注当下的安全感和稳定感；可以暂停、休息，或联系值得信任的人，不急着追溯痛苦来源。" },
  { name: "体验归属", type: "体验割裂型", brief: "感受与自我之间的联结", color: "#90a4c6", suggest: "温和地留意此时此地可以确认的事物，例如双脚与地面的接触、眼前的颜色。若疏离感明显或持续，建议寻求专业支持。" },
  { name: "体验自主", type: "体验被侵占型", brief: "真实感受与外界期待的边界", color: "#baa1bd", suggest: "试着把“别人期待我怎样感受”和“我此刻真实的感受”分别写下来。看见差异就已是一步，不必立刻做出重大改变。" },
];

function num(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function showNum(value) {
  if (value == null) return "—";
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function safeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(text(value)) ? text(value) : "";
}

function viewModelOf(report) {
  const viewModel = report.reportContent && report.reportContent.viewModel;
  return viewModel && typeof viewModel === "object" ? viewModel : {};
}

function calcOf(report) {
  const score = report.extensionData && report.extensionData.score;
  return score && typeof score === "object" ? score : {};
}

function matchSlot(raw, indexHint) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const id = text(raw.id).toLowerCase();
    const name = text(raw.name);
    if (id || name) {
      for (let i = 0; i < 4; i += 1) {
        if (id && (SEFS_IDS[i].includes(id) || id === String(i))) return i;
        if (name === SEFS_DIMS[i].name) return i;
      }
      return null;
    }
  }
  if (Number.isInteger(indexHint) && indexHint >= 0 && indexHint < 4) return indexHint;
  return null;
}

function applyEntries(slots, list) {
  if (!Array.isArray(list)) return;
  list.forEach((raw, index) => {
    const slotIndex = matchSlot(raw, index);
    if (slotIndex == null) return;
    const slot = slots[slotIndex];
    const score = num(raw && typeof raw === "object" ? raw.score : raw);
    if (score != null) slot.score = score;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const max = num(raw.max);
    if (max != null && max > 0) slot.max = max;
    if (text(raw.level)) slot.level = text(raw.level);
    const brief = text(raw.narrative) || text(raw.brief);
    if (brief) slot.brief = brief;
    const type = text(raw.type) || text(raw.extra && raw.extra.type) || text(raw.levelLabel);
    if (type) slot.type = type;
    const color = safeColor(raw.color || (raw.extra && raw.extra.color));
    if (color) slot.color = color;
    const suggest = text(raw.suggest) || text(raw.extra && raw.extra.suggest);
    if (suggest) slot.suggest = suggest;
  });
}

function band(score) {
  if (score <= 7) return "功能基本完好";
  if (score <= 11) return "轻度受损";
  if (score <= 18) return "中度受损";
  return "重度受损";
}

function levelText(slot) {
  const label = slot.level || (slot.score == null ? "" : band(slot.score));
  if (!label) return "";
  return label.endsWith("*") ? label : `${label}*`;
}

function readLeaders(report, slots) {
  const viewModel = viewModelOf(report);
  const calc = calcOf(report);
  const raw = Array.isArray(viewModel.leaders) ? viewModel.leaders : (Array.isArray(calc.leaders) ? calc.leaders : null);
  const picked = [];
  const take = (item) => {
    if (typeof item === "number" && item >= 0 && item < 4) return item;
    const asNum = num(item);
    if (asNum != null && asNum >= 0 && asNum < 4 && text(item) === String(asNum)) return asNum;
    return matchSlot({ id: item, name: item }, null);
  };
  if (raw) raw.forEach((item) => { const index = take(item); if (index != null) picked.push(index); });
  if (!picked.length && Array.isArray(report.result && report.result.flags)) {
    report.result.flags.forEach((flag) => {
      if (flag === "complex" || flag === "tied") return;
      const index = take(flag);
      if (index != null) picked.push(index);
    });
  }
  if (picked.length) return [...new Set(picked)];
  if (slots.some((slot) => slot.score == null)) return [];
  const max = Math.max(...slots.map((slot) => slot.score));
  return slots.map((slot, index) => (slot.score === max ? index : -1)).filter((index) => index >= 0);
}

function readComplex(report, slots) {
  const viewModel = viewModelOf(report);
  const calc = calcOf(report);
  if (typeof viewModel.complex === "boolean") return viewModel.complex;
  if (typeof calc.complex === "boolean") return calc.complex;
  const flags = report.result && report.result.flags;
  if (Array.isArray(flags) && flags.includes("complex")) return true;
  if (slots.some((slot) => slot.score == null)) return false;
  return slots.filter((slot) => slot.score >= 15).length >= 2;
}

function storedBlocks(report) {
  return [].concat(report.interpretation || [], report.recommendations || [])
    .filter((item) => item && text(item.text))
    .filter((item) => item.id !== "reader" && !text(item.text).includes(SEFS_READER_GAP))
    .map((item) => ({ title: text(item.title), text: text(item.text) }));
}

function sectionTotal(report) {
  const sections = report.reportContent && report.reportContent.sections;
  if (!Array.isArray(sections)) return "";
  const found = sections.find((section) => section && text(section.x).startsWith("总分"));
  return found ? text(found.x) : "";
}

function unseen(blocks, seen) {
  const out = [];
  blocks.forEach((block) => {
    if (seen.some((item) => item === block.text || item.includes(block.text))) return;
    out.push(block);
    seen.push(block.text);
  });
  return out;
}

function insightOf(report) {
  const insight = viewModelOf(report).insight;
  if (!insight || typeof insight !== "object") return null;
  const paragraphs = [];
  if (text(insight.complex)) paragraphs.push({ title: "", text: text(insight.complex) });
  if (text(insight.advice)) paragraphs.push({ title: "可以尝试", text: text(insight.advice) });
  if (Array.isArray(insight.paragraphs)) {
    insight.paragraphs.forEach((item) => {
      if (text(item)) paragraphs.push({ title: "", text: text(item) });
    });
  }
  const model = {
    tag: text(insight.tag),
    lead: text(insight.lead),
    paragraphs,
    order: text(insight.order),
    disclaimer: text(insight.disclaimer),
  };
  if (!model.tag && !model.lead && !model.paragraphs.length && !model.order && !model.disclaimer) return null;
  return model;
}

function leadLine(slots, leaders) {
  const names = leaders.map((index) => `${slots[index].name}（${slots[index].type}）`);
  if (names.length > 1) return `并列最高的体验方向：${names.join("、")}`;
  if (names.length === 1) return `相对突出的体验方向：${names[0]}`;
  return "";
}

function orderLine(slots) {
  if (slots.some((slot) => slot.score == null)) return "";
  const ranked = slots.map((slot, index) => ({ slot, index }))
    .sort((a, b) => b.slot.score - a.slot.score || a.index - b.index);
  return `四维度从高到低：${ranked.map(({ slot }) => `${slot.name} ${showNum(slot.score)}分`).join(" · ")}。* 维度分段沿用所提供草案，尚未建立临床解释效度。`;
}

function readSefs(report) {
  const slots = SEFS_DIMS.map((item) => ({ ...item, score: null, max: 24, level: "" }));
  const viewModel = viewModelOf(report);
  applyEntries(slots, calcOf(report).scores);
  applyEntries(slots, report.dimensions);
  applyEntries(slots, viewModel.scores);
  applyEntries(slots, viewModel.dimensions);
  const total = num(viewModel.total ?? calcOf(report).total ?? (report.result && report.result.total));
  const summed = slots.every((slot) => slot.score != null) ? slots.reduce((sum, slot) => sum + slot.score, 0) : null;
  const totalValue = total != null ? total : summed;
  const leaders = readLeaders(report, slots);
  const complex = readComplex(report, slots);
  const insight = insightOf(report);
  const blocks = storedBlocks(report);
  const summary = text(report.result && report.result.summary) || text(viewModel.summary);
  const headline = text(report.result && report.result.headline) || text(viewModel.headline);
  const totalLine = sectionTotal(report)
    || (totalValue != null ? `总分 ${showNum(totalValue)} 分。它是四个体验维度的简单相加，不设未经验证的总体严重程度阈值。` : "");
  let paragraphs = [];
  let order = "";
  let lead = "";
  if (insight) {
    lead = insight.lead || headline || leadLine(slots, leaders);
    paragraphs = insight.paragraphs;
    order = insight.order;
  } else if (blocks.length || summary || headline) {
    lead = headline;
    paragraphs = unseen(blocks, [headline, summary].filter(Boolean));
  } else if (slots.some((slot) => slot.score != null)) {
    lead = leadLine(slots, leaders);
    const complexText = complex
      ? "按草案规则，有至少两个维度达到 15 分，属于“复合关注”模式。得分排序只是本次观察顺序，不等于临床干预优先级。"
      : "按草案规则，本次未达到“两个及以上维度均不少于 15 分”的复合关注条件。";
    paragraphs.push({ title: "", text: complexText });
    if (leaders.length === 1) paragraphs.push({ title: "可以尝试", text: slots[leaders[0]].suggest });
    else if (leaders.length > 1) paragraphs.push({ title: "可以尝试", text: "本次有多个并列维度。可以先选一个自己最想了解、最不让你感到负担的方向，慢慢观察。" });
    order = orderLine(slots);
  }
  const label = text(report.result && report.result.label);
  const tag = (insight && insight.tag) || (label.includes("非病理") ? label : SEFS_TAG);
  const narrative = [summary, totalLine, lead, order].concat(paragraphs.map((item) => `${item.title}${item.text}`));
  const disclaimer = insight && insight.disclaimer;
  const notice = disclaimer || (narrative.join("\n").includes("可核验的信效度") ? "" : SEFS_NOTICE);
  return {
    name: text(report.assessmentName) || "SEFS · 主观体验功能状态量表",
    total: totalValue,
    maxTotal: num(viewModel.maxTotal) || 96,
    totalLine,
    summary,
    slots,
    leaders,
    tag,
    lead,
    paragraphs,
    order,
    notice,
    nickname: report.nickname,
    completedAt: report.completedAt,
    version: report.assessmentVersion,
  };
}

function barWidth(slot) {
  if (slot.score == null || !(slot.max > 0)) return 0;
  return Math.max(0, Math.min(100, (slot.score / slot.max) * 100));
}

function radarSvg(slots) {
  if (slots.some((slot) => slot.score == null || !(slot.max > 0))) return "";
  const cx = 200;
  const cy = 168;
  const radius = 100;
  const at = (index, scale) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  };
  const poly = (scale) => [0, 1, 2, 3].map((index) => at(index, scale).map((n) => n.toFixed(1)).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map((scale) => `<polygon points="${poly(scale)}" />`).join("");
  const axes = [0, 1, 2, 3].map((index) => {
    const [x, y] = at(index, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
  }).join("");
  const shape = slots.map((slot, index) => {
    const scale = Math.max(0, Math.min(1, slot.score / slot.max));
    return at(index, scale).map((n) => n.toFixed(1)).join(",");
  }).join(" ");
  const dots = slots.map((slot, index) => {
    const scale = Math.max(0, Math.min(1, slot.score / slot.max));
    const [x, y] = at(index, scale);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${slot.color}" />`;
  }).join("");
  const places = [
    { index: 0, anchor: "middle", dx: 0, dy: -16 },
    { index: 1, anchor: "start", dx: 12, dy: 4 },
    { index: 2, anchor: "middle", dx: 0, dy: 22 },
    { index: 3, anchor: "end", dx: -12, dy: 4 },
  ];
  const labels = places.map(({ index, anchor, dx, dy }) => {
    const [x, y] = at(index, 1);
    const lx = (x + dx).toFixed(1);
    const ly = (y + dy).toFixed(1);
    const slot = slots[index];
    return `<text x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(slot.name)}<tspan x="${lx}" dy="15">${esc(showNum(slot.score))} / ${esc(showNum(slot.max))}</tspan></text>`;
  }).join("");
  const label = slots.map((slot) => `${slot.name} ${showNum(slot.score)} / ${showNum(slot.max)}`).join("，");
  return `<svg class="sefs-radar" viewBox="0 0 400 336" role="img" aria-label="${esc(label)}">${`<g class="sefs-grid">${rings}${axes}</g><polygon class="sefs-shape" points="${shape}" />${dots}${labels}`}</svg>`;
}

function paragraphHtml(block) {
  if (block.title) return `<p><strong>${esc(block.title)}：</strong>${esc(block.text)}</p>`;
  return `<p>${esc(block.text)}</p>`;
}

export function renderSefsReport(report) {
  const model = readSefs(report || {});
  const radar = radarSvg(model.slots);
  const cards = model.slots.map((slot) => `
    <article class="dim-card">
      <div class="dim-head">
        <div class="dim-title">${esc(slot.name)}</div>
        <div class="dim-score">${esc(showNum(slot.score))} <small>/ ${esc(showNum(slot.max))}</small></div>
      </div>
      <div class="mini-track"><div class="mini-fill" style="width:${barWidth(slot).toFixed(1)}%;--tone:${slot.color}"></div></div>
      <div class="dim-meta"><span>${esc(slot.brief)}</span><span>${esc(levelText(slot))}</span></div>
    </article>
  `).join("");
  const totalBlock = model.total == null
    ? `<p class="state">这份结果里没有可显示的分数。</p>`
    : `<div class="score-hero">
        <div>
          <div class="total-number"><span>${esc(showNum(model.total))}</span><small> / ${esc(showNum(model.maxTotal))}</small></div>
          <p class="total-label">四个维度总计</p>
        </div>
        ${model.totalLine ? `<p class="score-copy">${esc(model.totalLine)}</p>` : ""}
      </div>`;
  return `
    <div class="sefs-map">
      <p class="eyebrow">YOUR EXPERIENCE MAP</p>
      <h1 class="result-title">${nickMark(model.nickname)}的主观体验地图</h1>
      <p class="result-sub">这些数字只是一次观察，不能定义完整的你。</p>
      <p class="sefs-scale">${esc(model.name)}</p>
      ${totalBlock}
      <h2 class="h2">四个维度，四种体验</h2>
      ${radar ? `<div class="radar-wrap">${radar}</div>` : ""}
      <div class="dim-grid">${cards}</div>
      <div class="insight">
        <span class="tag">${esc(model.tag)}</span>
        ${model.lead ? `<h3>${esc(model.lead)}</h3>` : ""}
        ${model.summary ? `<p>${esc(model.summary)}</p>` : ""}
        ${model.paragraphs.map(paragraphHtml).join("")}
        ${model.order ? `<p class="sefs-order">${esc(model.order)}</p>` : ""}
      </div>
      ${model.notice ? `<p class="notice">${esc(model.notice)}</p>` : ""}
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </div>
  `;
}

// SCL-90 阅读约定：不按 90 题重算因子分。统一协议 dimensions 的 score 是均分；
// viewModel 优先，其次 dimensions，再退到 extensionData.score（score.js 的返回）。
// 十因子固定按 som oc is dep anx hos phob par psy add，不按 ranked 重排。
// 缺数字留「—」，不补 0。危机文案（viewModel.crisis 或 interpretation id=crisis）放在分数前面。
// 结构化 crisis 为空时，不再从答案推断。
const SCL_ORDER = ["som", "oc", "is", "dep", "anx", "hos", "phob", "par", "psy", "add"];
const SCL_NAMES = {
  som: "躯体化",
  oc: "强迫症状",
  is: "人际关系敏感",
  dep: "抑郁",
  anx: "焦虑",
  hos: "敌对",
  phob: "恐怖",
  par: "偏执",
  psy: "精神病性",
  add: "其他",
};
const SCL_ALIAS = {
  somatization: "som",
  somatic: "som",
  obsessive: "oc",
  obsession: "oc",
  interpersonal: "is",
  depression: "dep",
  anxiety: "anx",
  hostility: "hos",
  phobic: "phob",
  phobia: "phob",
  paranoid: "par",
  paranoia: "par",
  psychotic: "psy",
  psychosis: "psy",
  additional: "add",
  other: "add",
};
const SCL_LEVELS = {
  none: "无明显症状",
  mild: "轻度",
  moderate: "中度",
  severe: "重度",
};
const SCL_LEVEL_NAME = {
  无明显症状: "none",
  轻度: "mild",
  中度: "moderate",
  重度: "severe",
};
const SCL_NOTICE = "这是筛查，不是诊断，也不能代替面谈。";
const SCL_CRISIS = {
  urgent: "第 15 题是“想结束自己的生命”，你选了偏重或严重。如果这个想法最近反复出现，或者你担心自己可能行动，请现在就联系能马上回应你的人：全国心理援助热线 12356，或当地急救 120。这份量表不能代替危机帮助。",
  alert: "第 15 题是“想结束自己的生命”，这次的选择已经离开了「没有」。如果它变频繁，或你开始觉得自己可能行动，请联系全国心理援助热线 12356，或告诉一个此刻能陪着你的人。",
  note: "你在“想到有关死亡的事”上选了偏重或严重。这不等于要结束生命，但如果这些想法停不下来，可以打全国心理援助热线 12356，让另一个人帮你把它放到台面上。",
};
const SCL_OPTIONS = { 1: "没有", 2: "很轻", 3: "中等", 4: "偏重", 5: "严重" };

function asObj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function owns(obj, key) {
  return Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));
}

function fixed2(value) {
  if (value == null) return "—";
  return (Math.round(value * 100) / 100).toFixed(2);
}

function showCount(value) {
  if (value == null) return "—";
  if (Number.isInteger(value)) return String(value);
  return fixed2(value);
}

function showTrim(value) {
  if (value == null) return "";
  return String(Math.round(value * 100) / 100);
}

function sourcesOf(report) {
  const viewModel = viewModelOf(report);
  const extension = asObj(report && report.extensionData) || {};
  return {
    viewModel,
    viewScore: asObj(viewModel.score),
    score: asObj(extension.score),
    extension,
    result: asObj(report && report.result) || {},
  };
}

function pickState(sources, keys) {
  for (const key of keys) {
    for (const obj of sources) {
      if (!owns(obj, key)) continue;
      if (obj[key] === null) return { present: true, value: null };
      const value = num(obj[key]);
      if (value != null) return { present: true, value };
    }
  }
  return { present: false, value: null };
}

function pickText(sources, keys) {
  for (const key of keys) {
    for (const obj of sources) {
      if (!obj) continue;
      const value = text(obj[key]);
      if (value) return value;
    }
  }
  return "";
}

function pickBool(sources, key) {
  for (const obj of sources) {
    if (obj && typeof obj[key] === "boolean") return obj[key];
  }
  return null;
}

function sclSlotId(raw) {
  if (!raw || typeof raw !== "object") return "";
  const id = text(raw.id).toLowerCase();
  if (SCL_ORDER.includes(id)) return id;
  if (SCL_ALIAS[id]) return SCL_ALIAS[id];
  const name = text(raw.name);
  const named = Object.keys(SCL_NAMES).find((key) => SCL_NAMES[key] === name);
  if (named) return named;
  if (id) return `x:${id}`;
  if (name) return `n:${name}`;
  return "";
}

function emptySclSlot(id) {
  return {
    id,
    name: SCL_NAMES[id] || "",
    score: null,
    max: 5,
    raw: null,
    count: null,
    level: "",
    levelLabel: "",
    about: "",
    narrative: "",
    aboveNorm: null,
    normMean: null,
    normSd: null,
  };
}

function sclLevelId(raw) {
  const id = text(raw.level).toLowerCase();
  if (SCL_LEVELS[id]) return id;
  const label = text(raw.levelLabel) || text(raw.level);
  return SCL_LEVEL_NAME[label] || "";
}

function applySclFactor(slots, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const id = sclSlotId(raw);
  if (!id) return;
  if (!slots.has(id)) slots.set(id, emptySclSlot(id));
  const slot = slots.get(id);
  const extra = asObj(raw.extra) || {};
  const name = text(raw.name);
  if (name) slot.name = name;
  const mean = num(raw.mean);
  const score = num(raw.score);
  if (mean != null) slot.score = mean;
  else if (score != null) slot.score = score;
  const max = num(raw.max);
  if (max != null && max > 1) slot.max = max;
  const rawScore = num(raw.raw);
  if (rawScore != null) slot.raw = rawScore;
  const count = num(raw.count);
  if (count != null && count > 0) slot.count = count;
  else if (Array.isArray(raw.items) && raw.items.length) slot.count = raw.items.length;
  const level = sclLevelId(raw) || sclLevelId(extra);
  if (level) slot.level = level;
  const levelLabel = text(raw.levelLabel) || text(extra.levelLabel) || (level ? SCL_LEVELS[level] : "");
  if (levelLabel) slot.levelLabel = levelLabel;
  const about = text(raw.about) || text(extra.about);
  if (about) slot.about = about;
  const narrative = text(raw.narrative) || text(extra.narrative);
  if (narrative) slot.narrative = narrative;
  if (typeof raw.aboveNorm === "boolean") slot.aboveNorm = raw.aboveNorm;
  const norm = asObj(raw.norm);
  if (norm) {
    const normMean = num(norm.mean);
    const normSd = num(norm.sd);
    if (normMean != null) slot.normMean = normMean;
    if (normSd != null) slot.normSd = normSd;
  }
}

function applySclList(slots, list) {
  if (!Array.isArray(list)) return;
  list.forEach((item) => applySclFactor(slots, item));
}

function levelFromMean(mean) {
  if (mean == null) return "";
  if (mean <= 2) return "none";
  if (mean <= 3) return "mild";
  if (mean <= 4) return "moderate";
  return "severe";
}

function gsiLabelFrom(gsi) {
  if (gsi == null) return "";
  if (gsi <= 1.5) return "没有明显症状";
  if (gsi <= 2.5) return "有症状，并不频繁";
  if (gsi <= 3.5) return "轻到中度";
  if (gsi <= 4.5) return "中到严重";
  return "十分严重";
}

function orderedSlots(slots, rankedIds, dimensionIds) {
  const seen = new Set();
  const order = [];
  const push = (id) => {
    if (!id || seen.has(id) || !slots.has(id)) return;
    seen.add(id);
    order.push(slots.get(id));
  };
  const preferred = rankedIds && rankedIds.length ? rankedIds : dimensionIds;
  (preferred || []).forEach(push);
  SCL_ORDER.forEach(push);
  slots.forEach((_slot, id) => push(id));
  return order;
}

function idList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => (typeof item === "string" ? sclSlotId({ id: item }) : sclSlotId(item))).filter(Boolean);
}

function blocksOf(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && text(item.text))
    .map((item) => ({ id: text(item.id).toLowerCase(), title: text(item.title), text: text(item.text) }));
}

function isCrisisBlock(block) {
  if (!block) return false;
  if (block.id === "crisis" || block.id.startsWith("crisis-")) return true;
  if (block.text.includes("想结束自己的生命")) return true;
  if (block.text.includes("想到有关死亡的事") && block.text.includes("12356")) return true;
  return false;
}

function readCrisisValue(value) {
  if (typeof value === "string") {
    const body = text(value);
    return body ? { level: "", title: "", text: body } : null;
  }
  const obj = asObj(value);
  if (!obj) return null;
  const body = text(obj.text) || text(obj.message) || text(obj.body);
  if (!body) return null;
  const level = text(obj.level).toLowerCase();
  return {
    level: level === "urgent" || level === "alert" || level === "note" ? level : "",
    title: text(obj.title),
    text: body,
  };
}

function crisisFromAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 90) return null;
  const wish = answers[14];
  const deathThought = answers[58];
  const valid = (value) => Number.isInteger(value) && value >= 1 && value <= 5;
  if (wish != null && !valid(wish)) return null;
  if (deathThought != null && !valid(deathThought)) return null;
  if (valid(wish) && wish >= 4) return { level: "urgent", title: "", text: SCL_CRISIS.urgent };
  if (valid(wish) && wish >= 2) return { level: "alert", title: "", text: SCL_CRISIS.alert };
  if (valid(deathThought) && deathThought >= 4) return { level: "note", title: "", text: SCL_CRISIS.note };
  return null;
}

function flagCrisisLevel(flags) {
  if (flags.includes("crisis-urgent")) return "urgent";
  if (flags.includes("crisis-alert")) return "alert";
  if (flags.includes("crisis-note")) return "note";
  return "";
}

function readCrisis(report, pack, flags) {
  let sawStructured = false;
  let structured = null;
  for (const obj of [pack.viewModel, pack.viewScore, pack.score, pack.result, pack.extension]) {
    if (!owns(obj, "crisis")) continue;
    sawStructured = true;
    structured = readCrisisValue(obj.crisis);
    break;
  }
  const blocks = blocksOf(report.interpretation).concat(blocksOf(report.recommendations));
  const block = blocks.find(isCrisisBlock);
  let crisis = structured || (block ? { level: "", title: block.title, text: block.text } : null);
  if (!crisis && !sawStructured) crisis = crisisFromAnswers(answersOf(report, pack));
  if (!crisis) return null;
  const flagged = flagCrisisLevel(flags);
  if (!crisis.level && flagged) crisis.level = flagged;
  if (!crisis.title) crisis.title = crisis.level === "note" ? "关于死亡的想法" : "请先看这里";
  return crisis;
}

function answersOf(report, pack) {
  if (Array.isArray(pack.viewModel.answers)) return pack.viewModel.answers;
  if (Array.isArray(pack.extension.answers)) return pack.extension.answers;
  if (pack.score && Array.isArray(pack.score.answers)) return pack.score.answers;
  return null;
}

// 题详只对照本地题库展示已上传的 answers，不重算分数。长度或取值对不上就不留空壳。
const ECR_REVERSE = new Set(ECR_REVERSE_ITEMS);
const ECR_OPTION_LABEL = Object.fromEntries(ECR_OPTIONS.map((option) => [option.value, option.label]));

function padItem(n) {
  return String(n).padStart(2, "0");
}

function integerAnswerList(report, length, valid) {
  if (!report || typeof report !== "object") return null;
  const pack = sourcesOf(report);
  const lists = [pack.viewModel.answers, pack.extension.answers, pack.score && pack.score.answers];
  for (const list of lists) {
    if (!Array.isArray(list) || list.length !== length) continue;
    const values = [];
    let ok = true;
    for (const value of list) {
      if (typeof value !== "number" || !Number.isInteger(value) || !valid(value)) {
        ok = false;
        break;
      }
      values.push(value);
    }
    if (ok) return values;
  }
  return null;
}

function ledgerDetails(summary, rows) {
  return `<details class="ledger"><summary>${esc(summary)}</summary><ol>${rows}</ol></details>`;
}

function sclLedger(report) {
  const answers = integerAnswerList(report, SCL_QUESTIONS.length, (value) => value >= 1 && value <= 5);
  if (!answers || answers.length !== 90) return "";
  const rows = SCL_QUESTIONS.map((item, index) => `
    <li><b>${padItem(index + 1)}</b><span>${esc(item)}</span><span>${esc(SCL_OPTIONS[answers[index]] || "")}</span></li>
  `).join("");
  return ledgerDetails("查看 90 题的作答", rows);
}

function pdqLedger(report) {
  const answers = integerAnswerList(report, PDQ_QUESTIONS.length, (value) => value === 0 || value === 1);
  if (!answers || answers.length !== 126) return "";
  const rows = PDQ_QUESTIONS.map((item, index) => `
    <li><b>${padItem(index + 1)}</b><span>${esc(item)}</span><span>${answers[index] === 1 ? "是" : "否"}</span></li>
  `).join("");
  return ledgerDetails("查看 126 题的作答", rows);
}

function ecrLedger(report) {
  const answers = integerAnswerList(report, ECR_QUESTIONS.length, (value) => value >= 1 && value <= 7);
  if (!answers || answers.length !== 36) return "";
  const rows = ECR_QUESTIONS.map((item, index) => {
    const raw = answers[index];
    const reversed = ECR_REVERSE.has(index + 1);
    const label = ECR_OPTION_LABEL[raw] || "";
    const tail = reversed ? `${label} · 计 ${8 - raw}` : label;
    return `
      <li><b>${padItem(index + 1)}</b><span>${esc(item)}</span><span>${esc(tail)}</span></li>
    `;
  }).join("");
  return ledgerDetails("查看 36 题的作答", rows);
}

function lineList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return text(item);
    if (item && typeof item === "object") return text(item.text) || text(item.x);
    return "";
  }).filter(Boolean);
}

function readRules(value) {
  if (!Array.isArray(value)) return [];
  return value.map((rule) => {
    const obj = asObj(rule);
    if (!obj) return null;
    const label = text(obj.label);
    if (!label || typeof obj.hit !== "boolean") return null;
    return { label, hit: obj.hit, detail: text(obj.detail) };
  }).filter(Boolean);
}

function readNotable(value) {
  if (!Array.isArray(value)) return null;
  return value.map((item) => {
    const obj = asObj(item);
    if (!obj) return null;
    const n = num(obj.n ?? obj.item);
    const body = text(obj.text) || text(obj.question);
    const score = num(obj.score ?? obj.value);
    if (n == null && !body) return null;
    return { n, text: body, score };
  }).filter(Boolean);
}

function optionWord(score) {
  const value = num(score);
  if (value == null) return "";
  return SCL_OPTIONS[value] || showTrim(value);
}

function sectionLines(report) {
  const sections = report.reportContent && report.reportContent.sections;
  if (!Array.isArray(sections)) return [];
  const lines = [];
  sections.forEach((section) => {
    if (!section || typeof section !== "object") return;
    const line = text(section.x) || text(section.text);
    if (line) lines.push(line);
    if (Array.isArray(section.it)) {
      section.it.forEach((item) => {
        const inner = text(item && (item.x || item.text));
        if (inner) lines.push(inner);
      });
    }
  });
  return lines;
}

function fresh(lines, seen) {
  const out = [];
  lines.forEach((line) => {
    if (!line || seen.some((item) => item === line || item.includes(line))) return;
    out.push(line);
    seen.push(line);
  });
  return out;
}

function normLine(norms) {
  const obj = asObj(norms);
  if (!obj) return "";
  const total = asObj(obj.total);
  const positive = asObj(obj.positiveCount);
  if (!total || !positive || num(total.mean) == null || num(total.sd) == null) return "";
  if (num(positive.mean) == null || num(positive.sd) == null) return "";
  return `全国常模里，总分约 ${showTrim(total.mean)} ± ${showTrim(total.sd)}，阳性项目数约 ${showTrim(positive.mean)} ± ${showTrim(positive.sd)}。`;
}

function aboveLine(pack) {
  const pairs = [
    ["总分", pickBool([pack.viewModel, pack.viewScore, pack.score], "totalAboveNorm")],
    ["总症状指数", pickBool([pack.viewModel, pack.viewScore, pack.score], "gsiAboveNorm")],
    ["阳性项目数", pickBool([pack.viewModel, pack.viewScore, pack.score], "positiveCountAboveNorm")],
    ["阳性症状均分", pickBool([pack.viewModel, pack.viewScore, pack.score], "positiveMeanAboveNorm")],
  ];
  const known = pairs.filter((pair) => typeof pair[1] === "boolean");
  if (!known.length) return "";
  const hits = known.filter((pair) => pair[1]).map((pair) => pair[0]);
  if (hits.length) return `高于常模一个标准差的是${hits.join("、")}。`;
  const quiet = ["总分", "总症状指数", "阳性项目数"].every((name) => known.some((pair) => pair[0] === name && pair[1] === false));
  return quiet ? "总分、总症状指数和阳性项目数都没有超过常模一个标准差。" : "";
}

function sclBar(slot) {
  if (slot.score == null || !(slot.max > 1)) return 0;
  return Math.max(0, Math.min(100, ((slot.score - 1) / (slot.max - 1)) * 100));
}

function foldSclCopy(factors, blocks) {
  const byId = new Map(factors.map((slot) => [slot.id, slot]));
  const byName = new Map(factors.filter((slot) => slot.name).map((slot) => [slot.name, slot]));
  const lines = [];
  let gsiText = "";
  let gsiLabel = "";
  blocks.forEach((block) => {
    if (!block || isCrisisBlock(block)) return;
    if (block.id === "gsi") {
      if (!gsiText) gsiText = block.text;
      if (!gsiLabel) gsiLabel = block.title;
      return;
    }
    const slot = byId.get(block.id) || byName.get(block.title);
    if (slot) {
      if (slot.score == null) {
        const mean = block.text.match(/均分\s*(\d+(?:\.\d+)?)/);
        if (mean) slot.score = Number(mean[1]);
      }
      if (!slot.narrative) {
        const stripped = block.text.replace(/^[^。]*均分\s*\d+(?:\.\d+)?。/, "");
        slot.narrative = text(stripped) || block.text;
      }
      return;
    }
    lines.push(block.title ? `${block.title}：${block.text}` : block.text);
  });
  return { lines, gsiText, gsiLabel };
}

function firstFilled(...lists) {
  for (const list of lists) {
    if (Array.isArray(list) && list.length) return list;
  }
  return [];
}

function readScl90(report) {
  report = report || {};
  const pack = sourcesOf(report);
  const numberSources = [pack.viewModel, pack.viewScore, pack.score, pack.result];
  const textSources = [pack.viewModel, pack.viewScore, pack.score];
  const slots = new Map(SCL_ORDER.map((id) => [id, emptySclSlot(id)]));
  applySclList(slots, pack.score && pack.score.factors);
  applySclList(slots, pack.score && pack.score.ranked);
  applySclList(slots, report.dimensions);
  applySclList(slots, pack.viewModel.dimensions);
  applySclList(slots, pack.viewScore && pack.viewScore.factors);
  applySclList(slots, pack.viewModel.factors);
  applySclList(slots, pack.viewScore && pack.viewScore.ranked);
  applySclList(slots, pack.viewModel.ranked);
  slots.forEach((slot) => {
    if (!slot.level && slot.score != null) slot.level = levelFromMean(slot.score);
    if (!slot.levelLabel && slot.level) slot.levelLabel = SCL_LEVELS[slot.level] || "";
    if (!slot.name) slot.name = SCL_NAMES[slot.id] || slot.id;
  });
  const factors = orderedSlots(slots, [], []);
  const gsi = pickState(numberSources, ["gsi"]);
  const total = pickState(numberSources, ["total"]);
  const positiveCount = pickState(numberSources, ["positiveCount"]);
  const positiveMean = pickState(numberSources, ["positiveMean"]);
  const negativeCount = pickState(numberSources, ["negativeCount"]);
  const flags = Array.isArray(pack.result.flags) ? pack.result.flags.map((flag) => text(flag).toLowerCase()) : [];
  const code = text(pack.result.code).toLowerCase();
  let positive = pickBool(textSources, "positive");
  if (positive == null && (flags.includes("positive") || code === "positive")) positive = true;
  if (positive == null && (flags.includes("negative") || code === "negative") && code !== "positive" && !flags.includes("positive")) positive = false;
  const verdictTitle = pickText(textSources, ["verdictTitle"])
    || (positive === true ? "筛查阳性" : "")
    || (positive === false ? "筛查阴性" : "");
  const verdictText = pickText(textSources, ["verdictText"]) || text(pack.result.summary);
  let gsiLabel = pickText(textSources, ["gsiLabel"]) || gsiLabelFrom(gsi.value);
  let gsiText = pickText(textSources, ["gsiText"]);
  const headline = text(pack.result.headline) || text(pack.viewModel.headline);
  const crisis = readCrisis(report, pack, flags);
  const profile = asObj(pack.viewModel.profile) || asObj(pack.extension.profile) || {};
  const who = [text(profile.name), text(profile.gender), text(profile.age)].filter(Boolean).join(" · ");
  const youth = text(profile.age) === "20岁以下"
    ? "年龄选的是 20 岁以下。常模来自成人样本，16–19 岁只作参考，不宜直接套用成人界值做判断。"
    : "";
  const quality = asObj(pack.extension.quality) || {};
  const rushed = quality.rushed === true || quality.tooFast === true
    || pack.viewModel.rushed === true || pack.viewModel.tooFast === true
    || (pack.score && pack.score.rushed === true)
    || (asObj(pack.viewModel.rush) && pack.viewModel.rush.tooFast === true);
  const rules = firstFilled(readRules(pack.viewModel.rules), readRules(pack.viewScore && pack.viewScore.rules), readRules(pack.score && pack.score.rules));
  const notableSource = Array.isArray(pack.viewModel.notable)
    ? pack.viewModel.notable
    : (Array.isArray(pack.viewScore && pack.viewScore.notable) ? pack.viewScore.notable : (pack.score && pack.score.notable));
  const notable = readNotable(notableSource);
  const recommendationLines = blocksOf(report.recommendations)
    .filter((block) => !isCrisisBlock(block) && !block.text.includes("阅读页还没接上") && !block.text.includes("统一阅读页目前只重绘"))
    .map((block) => (block.title ? `${block.title}：${block.text}` : block.text));
  const guidance = recommendationLines.length
    ? recommendationLines
    : firstFilled(
      lineList(pack.viewModel.guidance),
      lineList(pack.viewScore && pack.viewScore.guidance),
      lineList(pack.score && pack.score.guidance),
    );
  const copied = foldSclCopy(factors, blocksOf(report.interpretation));
  factors.forEach((slot) => {
    if (!slot.level && slot.score != null) slot.level = levelFromMean(slot.score);
    if (!slot.levelLabel && slot.level) slot.levelLabel = SCL_LEVELS[slot.level] || "";
  });
  if (!gsiText && copied.gsiText) gsiText = copied.gsiText;
  if (!gsiLabel && copied.gsiLabel) gsiLabel = copied.gsiLabel;
  const seen = [crisis && crisis.text, verdictTitle, verdictText, gsiText, headline]
    .concat(factors.map((slot) => slot.narrative))
    .concat(guidance)
    .filter(Boolean);
  const interpretation = fresh(copied.lines, seen);
  const anyNumber = gsi.present || total.present || positiveCount.present || positiveMean.present || factors.some((slot) => slot.score != null);
  const leftover = anyNumber ? [] : fresh(sectionLines(report), seen);
  const prose = [verdictText, gsiText, headline].concat(interpretation, guidance, leftover).join("\n");
  return {
    name: text(report.assessmentName) || "SCL-90 症状自评量表",
    factors,
    gsi,
    total,
    positiveCount,
    positiveMean,
    negativeCount,
    gsiLabel,
    gsiText,
    verdictTitle,
    verdictText,
    headline: headline && headline !== verdictTitle && !headline.startsWith(verdictTitle) ? headline : "",
    crisis,
    who,
    youth,
    rushed,
    rules,
    notable,
    guidance,
    interpretation,
    leftover,
    above: aboveLine(pack),
    norms: normLine(pack.viewModel.norms || (pack.score && pack.score.norms)),
    notice: prose.includes("不是诊断") ? "" : SCL_NOTICE,
    nickname: report.nickname,
    completedAt: report.completedAt,
    version: report.assessmentVersion,
    empty: !anyNumber,
  };
}

function sclStats(model) {
  const items = [];
  if (model.gsi.present) {
    const label = `总症状指数${model.gsiLabel ? ` · ${model.gsiLabel}` : ""}`;
    items.push([label, fixed2(model.gsi.value), true]);
  }
  if (model.total.present) items.push(["总分", showCount(model.total.value), false]);
  if (model.positiveCount.present) items.push(["阳性项目", showCount(model.positiveCount.value), false]);
  if (model.negativeCount.present) items.push(["阴性项目", showCount(model.negativeCount.value), false]);
  if (model.positiveMean.present) items.push(["阳性症状均分", model.positiveMean.value == null ? "—" : fixed2(model.positiveMean.value), false]);
  if (!items.length) return "";
  return `<div class="metrics">${items.map(([label, value, gsi]) => `
    <div class="metric">${gsi ? `<strong>${esc(value)}</strong>` : `<b>${esc(value)}</b>`}<span>${esc(label)}</span></div>
  `).join("")}</div>`;
}

function sclFactors(factors) {
  return factors.map((slot) => {
    const level = SCL_LEVELS[slot.level] ? slot.level : "";
    const scoreClass = level ? ` scl-level-${level}` : "";
    const fillClass = level ? ` scl-fill-${level}` : "";
    const metaLeft = slot.about || (slot.raw != null && slot.count ? `因子总分 ${showCount(slot.raw)} / ${showCount(slot.count)} 题` : "");
    const metaRight = [slot.levelLabel, slot.aboveNorm ? "高于常模" : ""].filter(Boolean).join(" · ");
    const norm = slot.normMean != null && slot.normSd != null
      ? `常模 ${showTrim(slot.normMean)} ± ${showTrim(slot.normSd)}`
      : "";
    const raw = slot.raw != null && slot.count && slot.about
      ? `因子总分 ${showCount(slot.raw)} / ${showCount(slot.count)} 题`
      : "";
    const foot = [raw, norm].filter(Boolean).join(" · ");
    const normTick = slot.normMean != null
      ? `<i class="norm" style="left:${sclBar({ score: slot.normMean, max: slot.max }).toFixed(1)}%"></i>`
      : "";
    return `
      <section class="factor">
        <header>
          <h3>${esc(slot.name)}</h3>
          <span class="level ${esc(level)}${scoreClass}">${esc([slot.levelLabel, fixed2(slot.score)].filter((part) => part && part !== "—").join(" · "))}${slot.score != null ? ` <small>/ ${esc(showCount(slot.max))}</small>` : ""}</span>
        </header>
        ${slot.about ? `<em class="about">${esc(slot.about)}</em>` : ""}
        <div class="bar" aria-hidden="true"><b class="${esc(level)}${fillClass}" style="width:${sclBar(slot).toFixed(1)}%"></b><i class="cut" style="left:${sclBar({ score: 2, max: slot.max || 5 }).toFixed(1)}%"></i>${normTick}</div>
        ${foot ? `<div class="scale-note">${esc(foot)}</div>` : ""}
        ${metaLeft && metaLeft !== slot.about ? `<p class="sub">${esc(metaLeft)}</p>` : ""}
        ${metaRight ? `<p class="sub">${esc(metaRight)}</p>` : ""}
        ${slot.narrative ? `<p>${esc(slot.narrative)}</p>` : ""}
      </section>
    `;
  }).join("");
}

export function renderScl90Report(report) {
  const model = readScl90(report || {});
  const crisis = model.crisis
    ? `<div class="verdict ${model.crisis.level === "note" ? "scl-crisis scl-crisis-note" : "urgent scl-crisis scl-crisis-hot"}" role="${model.crisis.level === "note" ? "note" : "alert"}">
        <strong>${esc(model.crisis.title)}</strong>
        <p>${esc(model.crisis.text)}</p>
      </div>`
    : "";
  const rush = model.rushed
    ? `<div class="verdict positive scl-rush"><strong>作答偏快</strong><p>超过一半的题目间隔不到 1.5 秒。下面的分数仍然按作答计算，但可能没有反映最近一周的实际感觉。</p></div>`
    : "";
  const verdict = model.verdictTitle
    ? `<div class="verdict${model.verdictTitle.includes("阳性") ? " positive scl-tag-pos" : ""}"><strong>${esc(model.verdictTitle)}</strong>${model.verdictText ? `<p>${esc(model.verdictText)}</p>` : ""}</div>`
    : (model.verdictText ? `<p class="lead">${esc(model.verdictText)}</p>` : "");
  const rules = model.rules.length
    ? `<ul class="rules scl-rules">${model.rules.map((rule) => `
        <li><span class="${rule.hit ? "scl-pill-hit" : "scl-pill"}">${rule.hit ? "超过" : "未超过"}</span><span><strong>${esc(rule.label)}</strong>${rule.detail ? `<br />${esc(rule.detail)}` : ""}</span></li>
      `).join("")}</ul>`
    : "";
  const guidance = model.guidance.length
    ? `<h2>怎么看下一步</h2><ul class="guidance scl-guidance">${model.guidance.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>`
    : "";
  const extra = model.interpretation.concat(model.leftover);
  const extraHtml = extra.length
    ? `<section class="sefs-insight">${extra.map((line) => `<p>${esc(line)}</p>`).join("")}</section>`
    : "";
  let notable = "";
  if (model.notable) {
    notable = model.notable.length
      ? `<h2>偏重和严重的条目（${model.notable.length}）</h2><ul class="symptoms scl-symptoms">${model.notable.map((item) => `
          <li><b>${item.n == null ? "" : esc(String(item.n).padStart(2, "0"))}</b><span>${esc(item.text)}</span><span>${esc(optionWord(item.score))}</span></li>
        `).join("")}</ul>`
      : `<h2>偏重和严重的条目</h2><p class="sub">没有题目达到偏重或严重。</p>`;
  }
  const seenLead = new Set();
  const takeLead = (lines) => lines.filter(Boolean).filter((line) => {
    if (seenLead.has(line)) return false;
    seenLead.add(line);
    return true;
  });
  const before = takeLead([model.headline, model.verdictText]);
  const after = takeLead([model.gsiText, model.above, model.norms]);
  const whoParts = model.who ? model.who.split(" · ") : [];
  const whoLabels = whoParts.length === 4 ? ["姓名", "性别", "年龄", "日期"] : (whoParts.length === 3 ? ["姓名", "性别", "年龄"] : []);
  const who = model.who
    ? `<p class="who-flat" hidden>${esc(model.who)}</p>${whoLabels.length ? `<div class="who">${whoParts.map((part, index) => `<div><span>${whoLabels[index]}</span><b>${esc(part)}</b></div>`).join("")}</div>` : ""}`
    : "";
  return `
    <div class="scl-map">
      <p class="kicker"><i class="mark"></i> 测评报告</p>
      <h1>${nickMark(model.nickname)}的症状自评量表</h1>
      <p class="scl-scale-name">${esc(model.name)}</p>
      <p class="sub">最近一周的感受筛查。筛查不是诊断。</p>
      ${who}
      ${crisis}
      ${rush}
      ${verdict}
      ${before.filter((line) => line !== model.verdictText).map((line) => `<p class="lead">${esc(line)}</p>`).join("")}
      ${model.youth ? `<p class="sub">${esc(model.youth)}</p>` : ""}
      ${model.empty ? `<p class="state">这份结果里没有可显示的分数。</p>` : ""}
      ${sclStats(model)}
      ${after.map((line) => `<p class="sub">${esc(line)}</p>`).join("")}
      ${rules}
      <h2>十个方面</h2>
      <p class="sub">横条是因子均分，左端 1 分，右端 5 分。黑线是 2 分筛查界，灰线是常模均分。2 分及以下为无明显症状，其后到 3 分为轻度，到 4 分为中度，再高为重度。</p>
      ${sclFactors(model.factors)}
      ${guidance}
      ${extraHtml}
      ${notable}
      ${sclLedger(report)}
      <div class="formulas">
        <p>总分 = 90 题相加。总症状指数 = 总分 ÷ 90。</p>
        <p>阳性项目 = 选了很轻及以上的题。阴性项目 = 选了「没有」的题。阳性症状均分 = 阳性题得分之和 ÷ 阳性题数。</p>
        <p>因子均分 = 该因子题目得分之和 ÷ 题目数。筛查阳性：总分超过 160，或阳性项目超过 43，或九个症状因子里有均分超过 2。</p>
        <p>这是筛查，不是诊断，也不能代替面谈。</p>
      </div>
      ${model.notice ? `<p class="notice">${esc(model.notice)}</p>` : ""}
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </div>
  `;
}

// PDQ-4 阅读约定：不按 126 题重算。字段对齐即将合入的 pdq/js/cloud-payload.js（buildPdq4Result）。
// viewModel 优先，其次 dimensions，再退到 extensionData.score（scorePdq4 的返回）。
// 十二量表固定按 par szd szt ant bor his nar avo dep ocp pag dps，再按 A/B/C/X 群归位。
// tooGood 是掩饰，suspect 是怀疑，impulse / conduct 是合成分，verdict 是总述。
// 缺数字留「—」，不补 0。页眉写明筛查不是诊断。
const PDQ_ORDER = ["par", "szd", "szt", "ant", "bor", "his", "nar", "avo", "dep", "ocp", "pag", "dps"];
const PDQ_META = {
  par: { name: "偏执型", cluster: "A", cutoff: 4, max: 7, about: "不信任别人，容易把中性的举动看成针对自己。" },
  szd: { name: "分裂样", cluster: "A", cutoff: 4, max: 7, about: "主动与人保持距离，情感比较平、比较冷。" },
  szt: { name: "分裂型", cluster: "A", cutoff: 5, max: 9, about: "想法或感受比较奇特，跟人靠近时容易紧张。" },
  ant: { name: "反社会型", cluster: "B", cutoff: 3, max: 8, about: "漠视别人的处境和规则，行为不计后果。" },
  bor: { name: "边缘型", cluster: "B", cutoff: 5, max: 9, about: "关系、心情和自我感都容易大起大落。" },
  his: { name: "表演型", alias: "癔症型", cluster: "B", cutoff: 5, max: 8, about: "需要被看见，情绪外露，也容易受场面影响。" },
  nar: { name: "自恋型", cluster: "B", cutoff: 5, max: 9, about: "需要被特别看待，受挫时容易羞耻或生气。" },
  avo: { name: "回避型", cluster: "C", cutoff: 4, max: 7, about: "怕被否定，所以先退出可能被评价的场合。" },
  dep: { name: "依赖型", cluster: "C", cutoff: 5, max: 8, about: "把决定和照顾交给别人，害怕独自撑住。" },
  ocp: { name: "强迫型", cluster: "C", cutoff: 4, max: 8, about: "用细节、规则和完美来压住不确定。" },
  pag: { name: "被动攻击型", cluster: "X", cutoff: 4, max: 7, about: "表面顺从来，实际用拖延和怨气抵抗。" },
  dps: { name: "抑郁型", cluster: "X", cutoff: 5, max: 7, about: "长久的悲观和自我责备，不只是某一次心情不好。" },
};
const PDQ_ALIAS = {
  paranoid: "par",
  schizoid: "szd",
  schizotypal: "szt",
  antisocial: "ant",
  borderline: "bor",
  histrionic: "his",
  narcissistic: "nar",
  avoidant: "avo",
  dependent: "dep",
  obsessive: "ocp",
  "obsessive-compulsive": "ocp",
  "passive-aggressive": "pag",
  passiveaggressive: "pag",
  depressive: "dps",
  偏执型: "par",
  分裂样: "szd",
  分裂型: "szt",
  反社会型: "ant",
  边缘型: "bor",
  表演型: "his",
  癔症型: "his",
  自恋型: "nar",
  回避型: "avo",
  依赖型: "dep",
  强迫型: "ocp",
  被动攻击型: "pag",
  抑郁型: "dps",
};
const PDQ_CLUSTERS = [
  { id: "A", name: "A 群", note: "疏离、猜疑或古怪" },
  { id: "B", name: "B 群", note: "情绪强烈、人际动荡" },
  { id: "C", name: "C 群", note: "焦虑、依赖或过度控制" },
  { id: "X", name: "附录", note: "DSM-IV 建议进一步观察的类型" },
];
const PDQ_READER_GAP = "统一阅读页目前只重绘";

function pdqSlotId(raw) {
  if (!raw || typeof raw !== "object") return "";
  const id = text(raw.id).toLowerCase();
  if (PDQ_ORDER.includes(id)) return id;
  if (PDQ_ALIAS[id]) return PDQ_ALIAS[id];
  const name = text(raw.name);
  if (PDQ_ALIAS[name]) return PDQ_ALIAS[name];
  return "";
}

function emptyPdqSlot(id) {
  const meta = PDQ_META[id];
  return {
    id,
    name: meta.name,
    alias: meta.alias || "",
    cluster: meta.cluster,
    about: meta.about,
    portrait: "",
    score: null,
    max: meta.max,
    cutoff: meta.cutoff,
    positive: null,
  };
}

function explicitPositive(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.positive === "boolean") return raw.positive;
  if (typeof raw.hit === "boolean") return raw.hit;
  const level = text(raw.level).toLowerCase();
  const label = `${text(raw.levelLabel)} ${level}`;
  if (label.includes("未达到") || label.includes("未达划界") || ["negative", "clear", "below", "none"].includes(level)) return false;
  if (label.includes("达到划界") || label.includes("筛查阳性") || ["positive", "hit", "flagged", "above"].includes(level)) return true;
  return null;
}

function applyPdqScale(slots, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const id = pdqSlotId(raw);
  if (!id || !slots.has(id)) return;
  const slot = slots.get(id);
  const extra = asObj(raw.extra) || {};
  const name = text(raw.name);
  const canonical = PDQ_META[id].name;
  if (name === canonical) slot.name = name;
  else if (name && (name === slot.alias || name === "癔症型")) slot.alias = slot.alias || name;
  else if (name) slot.name = name;
  const alias = text(raw.alias) || text(extra.alias);
  if (alias) slot.alias = alias;
  const cluster = text(raw.cluster || extra.cluster).toUpperCase();
  if (["A", "B", "C", "X"].includes(cluster)) slot.cluster = cluster;
  const about = text(raw.about) || text(extra.about);
  if (about) slot.about = about;
  const portrait = text(raw.portrait) || text(raw.narrative) || text(extra.portrait) || text(extra.narrative);
  if (portrait) slot.portrait = portrait;
  const marked = explicitPositive(raw) == null ? explicitPositive(extra) : explicitPositive(raw);
  if (owns(raw, "score")) {
    slot.score = num(raw.score);
    if (marked == null) slot.positive = null;
  }
  if (marked != null) slot.positive = marked;
  const max = num(raw.max);
  if (max != null && max > 0) slot.max = max;
  const cutoffSource = owns(raw, "cutoff") ? raw : (owns(extra, "cutoff") ? extra : null);
  if (cutoffSource) {
    const cutoff = num(cutoffSource.cutoff);
    if (cutoff != null) slot.cutoff = cutoff;
  }
}

function applyPdqList(slots, list) {
  if (!Array.isArray(list)) return;
  list.forEach((item) => applyPdqScale(slots, item));
}

function applyPositiveIds(slots, list) {
  if (!Array.isArray(list)) return;
  list.forEach((item) => {
    const id = typeof item === "string" ? pdqSlotId({ id: item }) : pdqSlotId(item);
    if (item && typeof item === "object") applyPdqScale(slots, item);
    if (!id || !slots.has(id)) return;
    if (item && typeof item === "object" && explicitPositive(item) != null) return;
    slots.get(id).positive = true;
  });
}

function readBag(sources, key) {
  for (const obj of sources) {
    if (!owns(obj, key)) continue;
    return { saw: true, bag: asObj(obj[key]) };
  }
  return { saw: false, bag: null };
}

function readValidity(sources, key, fallback) {
  const { saw, bag } = readBag(sources, key);
  const score = bag ? num(bag.score) : null;
  const max = bag && num(bag.max) != null ? num(bag.max) : fallback.max;
  const cutoff = bag && num(bag.cutoff) != null ? num(bag.cutoff) : fallback.cutoff;
  let flagged = bag && typeof bag.flagged === "boolean" ? bag.flagged : null;
  if (flagged == null && score != null && cutoff != null) flagged = score >= cutoff;
  const items = bag && Array.isArray(bag.items) ? bag.items.map((item) => num(item)).filter((item) => item != null) : [];
  const detail = bag ? (text(bag.detail) || text(bag.text) || text(bag.note)) : "";
  return { saw, score, max, cutoff, flagged, items, detail };
}

function readComposite(sources, key) {
  const { saw, bag } = readBag(sources, key);
  if (!saw) return { present: false, count: null, need: null, point: null };
  if (!bag) return { present: true, count: null, need: null, point: null };
  return {
    present: true,
    count: num(bag.count),
    need: num(bag.need),
    point: num(bag.point != null ? bag.point : bag.score),
  };
}

function readVerdict(sources, result) {
  const { bag } = readBag(sources, "verdict");
  const title = (bag && (text(bag.title) || text(bag.headline))) || text(result.headline) || "";
  const body = (bag && (text(bag.text) || text(bag.summary))) || text(result.summary) || "";
  const id = ((bag && text(bag.id)) || text(result.code)).toLowerCase();
  const label = text(result.label);
  return {
    id,
    title: title || (label && label !== "筛查不是诊断" ? label : ""),
    text: body,
  };
}

function clusterMeta(sources) {
  const base = PDQ_CLUSTERS.map((item) => ({ ...item }));
  for (const obj of sources) {
    const list = obj && (obj.clusters || obj.groups);
    if (!Array.isArray(list)) continue;
    list.forEach((raw) => {
      const found = base.find((item) => item.id === text(raw && raw.id).toUpperCase());
      if (!found) return;
      if (text(raw.name)) found.name = text(raw.name);
      const note = text(raw.note) || text(raw.about);
      if (note) found.note = note;
    });
    break;
  }
  return base;
}

function hitLineFor(scales, seenText) {
  const hits = scales.filter((slot) => slot.positive === true);
  if (!hits.length) {
    const knownClear = scales.every((slot) => slot.positive === false);
    if (knownClear && !seenText.includes("低于") && !seenText.includes("没有维度达到划界")) {
      return "十二个分量表都低于各自的划界分。";
    }
    return "";
  }
  if (hits.every((slot) => seenText.includes(slot.name))) return "";
  return `达到划界的是${hits.map((slot) => slot.name).join("、")}。`;
}

function pdqBar(slot) {
  if (slot.score == null || !(slot.max > 0)) return 0;
  return Math.max(0, Math.min(100, (slot.score / slot.max) * 100));
}

function pdqScaleArticle(slot) {
  const hit = slot.positive === true;
  const state = hit ? "达到划界" : (slot.positive === false ? "未达到" : "—");
  const cut = slot.cutoff == null ? "" : `划界 ${showNum(slot.cutoff)} 分`;
  const meta = [state, cut].filter(Boolean).join(" · ");
  const cutLeft = slot.cutoff != null && slot.max > 0
    ? Math.max(0, Math.min(100, (slot.cutoff / slot.max) * 100))
    : null;
  const name = slot.alias
    ? `${esc(slot.name)}<span class="pdq-alias"> · ${esc(slot.alias)}</span>`
    : esc(slot.name);
  return `
    <section class="factor${hit ? " pdq-hit" : ""}">
      <header>
        <h3>${name}</h3>
        <span class="sefs-score">${esc(showNum(slot.score))} <small>/ ${esc(showNum(slot.max))}</small></span>
      </header>
      <em class="about">${esc(slot.about)}</em>
      <div class="bar pdq-track" aria-hidden="true">
        <b style="width:${pdqBar(slot).toFixed(1)}%"></b>
        ${cutLeft == null ? "" : `<i class="cut" style="left:${cutLeft.toFixed(1)}%"></i>`}
      </div>
      <p class="sub">${esc(meta)}</p>
      ${hit && slot.portrait ? `<p class="pdq-portrait">${esc(slot.portrait)}</p>` : ""}
    </section>
  `;
}

function validityArticle(label, block, calm, caution) {
  const mark = block.flagged == null ? "—" : (block.flagged ? "需要留意" : "未触发");
  const detail = block.detail || (block.flagged == null ? "这项效度没有随结果一起送来。" : (block.flagged ? caution : calm));
  const items = block.items.length && !detail.includes("题号") ? `记分题号：${block.items.join("、")}。` : "";
  const scoreLine = `${label} ${showNum(block.score)} / ${showNum(block.max)}`;
  return `
    <section class="factor${block.flagged ? " pdq-valid-on" : ""}">
      <header>
        <h3>${esc(label)}</h3>
        <span class="sefs-score">${esc(showNum(block.score))} <small>/ ${esc(showNum(block.max))}</small></span>
      </header>
      <p><strong>${esc(scoreLine)}</strong> · ${esc(mark)}。${esc(detail)}${items ? ` ${esc(items)}` : ""}</p>
    </section>
  `;
}

function compositeLine(name, block, host) {
  if (!block.present) return "";
  const need = block.need == null ? "" : `至少 ${showNum(block.need)} 个「是」才记 1 分。`;
  return `${name}：${showNum(block.count)} 个「是」，合成 ${showNum(block.point)} 分，记在${host}。${need}`;
}

function readPdq4(report) {
  report = report || {};
  const pack = sourcesOf(report);
  const objectSources = [pack.viewModel, pack.viewScore, pack.score];
  const slots = new Map(PDQ_ORDER.map((id) => [id, emptyPdqSlot(id)]));
  applyPdqList(slots, pack.score && pack.score.scales);
  applyPositiveIds(slots, pack.score && pack.score.positiveScales);
  applyPdqList(slots, report.dimensions);
  applyPdqList(slots, pack.viewModel.dimensions);
  applyPdqList(slots, pack.viewScore && pack.viewScore.scales);
  applyPdqList(slots, pack.viewModel.scales);
  applyPositiveIds(slots, pack.viewModel.positiveScales);
  slots.forEach((slot) => {
    if (slot.positive == null && slot.score != null && slot.cutoff != null) slot.positive = slot.score >= slot.cutoff;
  });
  const scales = PDQ_ORDER.map((id) => slots.get(id));
  const flags = Array.isArray(pack.result.flags) ? pack.result.flags.map((flag) => text(flag).toLowerCase()) : [];
  const tooGood = readValidity(objectSources, "tooGood", { max: 4, cutoff: 2 });
  const suspect = readValidity(objectSources, "suspect", { max: 2, cutoff: 1 });
  const verdict = readVerdict(objectSources, pack.result);
  if (tooGood.flagged == null && (flags.includes("too-good") || flags.includes("toogood") || flags.includes("too_good") || verdict.id === "too-good" || verdict.id === "too-good-clear" || verdict.id === "invalid")) {
    tooGood.flagged = true;
  }
  if (suspect.flagged == null && (flags.includes("suspect") || verdict.id === "suspect" || verdict.id === "invalid")) {
    suspect.flagged = true;
  }
  const countState = pickState([pack.viewModel, pack.viewScore, pack.score, pack.result], ["positiveCount"]);
  let positiveCount = countState.present ? countState.value : null;
  if (positiveCount == null && scales.every((slot) => typeof slot.positive === "boolean")) {
    positiveCount = scales.filter((slot) => slot.positive).length;
  }
  const total = pickState([pack.viewModel, pack.viewScore, pack.score, pack.result], ["total"]);
  const impulse = readComposite(objectSources, "impulse");
  const conduct = readComposite(objectSources, "conduct");
  const blocks = blocksOf(report.interpretation);
  blocks.forEach((block) => {
    const id = pdqSlotId({ id: block.id, name: block.title });
    const slot = id ? slots.get(id) : null;
    if (!slot || !slot.positive) return;
    if (!slot.portrait) slot.portrait = block.text;
    if (slot.portrait === block.text || slot.portrait.includes(block.text)) block.used = true;
  });
  const seenText = `${verdict.title}\n${verdict.text}`;
  const hitLine = hitLineFor(scales, seenText);
  const quality = asObj(pack.extension.quality) || {};
  const rushed = quality.rushed === true || quality.tooFast === true
    || pack.viewModel.rushed === true || pack.viewModel.tooFast === true
    || (pack.score && pack.score.rushed === true);
  const guidance = blocksOf(report.recommendations)
    .filter((block) => !block.text.includes("阅读页还没接上") && !block.text.includes(PDQ_READER_GAP))
    .map((block) => (block.title ? `${block.title}：${block.text}` : block.text));
  const seen = [verdict.title, verdict.text, hitLine].concat(scales.map((slot) => slot.portrait), guidance).filter(Boolean);
  const interpretation = fresh(blocks.filter((block) => !block.used).map((block) => (block.title ? `${block.title}：${block.text}` : block.text)), seen);
  const anyNumber = scales.some((slot) => slot.score != null)
    || total.present
    || countState.present
    || tooGood.score != null
    || suspect.score != null
    || impulse.present
    || conduct.present;
  return {
    name: text(report.assessmentName) || "PDQ-4 人格障碍筛查",
    scales,
    clusters: clusterMeta(objectSources),
    tooGood,
    suspect,
    verdict,
    hitLine,
    positiveCount,
    total,
    impulse,
    conduct,
    rushed,
    guidance,
    interpretation,
    empty: !anyNumber,
    nickname: report.nickname,
    completedAt: report.completedAt,
    version: report.assessmentVersion,
  };
}

export function renderPdq4Report(report) {
  const model = readPdq4(report || {});
  const scalesByCluster = (id) => model.scales.filter((slot) => slot.cluster === id).map(pdqScaleArticle).join("");
  const clusters = model.clusters.map((cluster) => {
    const body = scalesByCluster(cluster.id);
    if (!body) return "";
    return `
      <section class="pdq-cluster">
        <h2>${esc(cluster.name)}</h2>
        <p class="scl-sub">${esc(cluster.note)}</p>
        <div class="sefs-dims">${body}</div>
      </section>
    `;
  }).join("");
  const totalNote = model.total.present && model.total.value != null
    ? "合计把第 60 题算了两次。要看的是每个维度自己的划界，不是这一个总数。"
    : "";
  const notes = [compositeLine("边缘型的冲动题", model.impulse, "边缘型"), compositeLine("反社会型的早年行为", model.conduct, "反社会型")]
    .filter(Boolean);
  const guidance = model.guidance.length
    ? `<section class="sefs-insight"><ul class="scl-guidance">${model.guidance.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></section>`
    : "";
  const extra = model.interpretation.length
    ? `<section class="sefs-insight">${model.interpretation.map((line) => `<p>${esc(line)}</p>`).join("")}</section>`
    : "";
  const impulseLine = model.impulse.present
    ? `<p>边缘型的冲动分：第 106–111 题里至少 2 个「是」，整组记 1 分，否则记 0 分。这次是 ${esc(showNum(model.impulse.count))} 个「是」，记 ${esc(showNum(model.impulse.point))} 分。</p>`
    : "";
  const conductLine = model.conduct.present
    ? `<p>反社会型的早年行为：第 112–126 题里至少 3 个「是」，整组记 1 分，否则记 0 分。这次是 ${esc(showNum(model.conduct.count))} 个「是」，记 ${esc(showNum(model.conduct.point))} 分。</p>`
    : "";
  return `
    <div class="pdq-map">
      <p class="kicker">测评结果${model.completedAt ? ` · ${esc(when(model.completedAt))}` : ""}</p>
      ${personLine(model.nickname)}
      <h1>${esc(model.verdict.title || model.name)}</h1>
      ${model.verdict.title ? `<p class="sub">${esc(model.name)}</p>` : ""}
      <p class="sub">筛查不是诊断。达到划界只说明值得再了解，不能代替面谈。</p>
      ${model.verdict.text ? `<p class="lead">${esc(model.verdict.text)}</p>` : ""}
      ${model.hitLine ? `<p class="lead">${esc(model.hitLine)}</p>` : ""}
      ${model.rushed ? `<p class="lead quiet scl-rush"><strong>作答偏快。</strong>超过一半的间隔不到 1.5 秒，分数仍按选择计算。</p>` : ""}
      ${model.empty ? `<p class="state">这份结果里没有可显示的分数。</p>` : ""}
      <div class="metrics">
        <div class="metric"><b>${esc(showNum(model.positiveCount))}</b><span>达到划界</span></div>
        <div class="metric"><b>${esc(showNum(model.total.present ? model.total.value : null))}</b><span>十二维合计</span></div>
      </div>
      ${totalNote ? `<p class="sub">${esc(totalNote)}</p>` : ""}
      <h2>作答效度</h2>
      <p class="sub">掩饰和怀疑不计入十二个维度。先看这里，再看分量表。</p>
      <section class="pdq-valid">
        ${validityArticle("掩饰", model.tooGood, "没有达到掩饰划界。第 12、25、38 题答「否」，或第 51 题答「是」，才会记入这一项。", "有几道几乎人人都会承认的小题被否认了，回答可能偏完美。分数仍然列出，卷面可能比实际更轻。")}
        ${validityArticle("怀疑", model.suspect, "第 64 题和第 76 题都没有答「是」，这次没有按可疑处理。", "有题目提示这份问卷可疑。分数照常列出，请先看效度，再决定要不要把它们当作参考。")}
      </section>
      ${clusters}
      <div class="formulas">
        <p>临床题答「是」记 1 分，答「否」记 0 分。各维度把自己的题目相加，大于等于划界分即为筛查阳性。</p>
        <p>反社会型划界 3 分。偏执型、分裂样、回避型、强迫型、被动攻击型划界 4 分。分裂型、表演型、自恋型、边缘型、依赖型、抑郁型划界 5 分。</p>
        ${impulseLine}
        ${conductLine}
        <p>第 98–105 题保留在问卷中，不计入这 12 个分量表。掩饰和怀疑的 6 题也不计入。这是筛查，不是诊断。</p>
      </div>
      ${pdqLedger(report)}
      ${notes.length ? `<section class="notes">${notes.map((line) => `<p>${esc(line)}</p>`).join("")}</section>` : ""}
      ${guidance}
      ${extra}
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </div>
  `;
}

// ECR 阅读约定：不按 36 题重算。字段对齐即将写入 mindtest ecr/js/cloud-payload.js 的 buildEcrResult。
// viewModel 优先，其次 result / dimensions，再退到 extensionData.score（scoreEcr 的返回）。
// 回避、焦虑的 score 或 mean 是 1–7 均分，4 是量表中点。四型用判别分 m，最高的一项是类型。
// 缺数字留「—」，不补 0，也不用 answers 重算均分或类型。题详只在作答完整时列出。页上写明筛查不是诊断。
const ECR_NOTICE = "这是筛查，不是诊断，也不能代替面谈。类型来自回避均分和焦虑均分的判别式，说的是恋爱经历里常常有的感觉，不能据此判断一段关系该不该继续。";
const ECR_KICKER = "筛查不是诊断。类型是四个判别分里最高的一项，不能代替面谈。";
const ECR_READER_GAP = "统一阅读页目前只重绘";
const ECR_DIM_ORDER = ["avoidance", "anxiety"];
const ECR_DIM_META = {
  avoidance: {
    name: "依恋回避",
    about: "对亲近、依赖、把心里话说出来有多不自在。越高，越倾向于退开。",
    levels: {
      low: "低于量表中点。亲近、依赖、把事情讲给恋人，对你相对自在。",
      mid: "正好落在量表中点。亲近和后退都没有明显偏向。",
      high: "高于量表中点。太近会紧。你更常把感受留在自己这边，靠着恋人不那么容易。",
    },
  },
  anxiety: {
    name: "依恋焦虑",
    about: "对关系会不会失去、对方是不是足够在乎有多担心。越高，越容易不安。",
    levels: {
      low: "低于量表中点。关系里的波动，不太会马上变成“我要被抛弃了”。",
      mid: "正好落在量表中点。担心和放心都没有明显偏向。",
      high: "高于量表中点。你容易盯着对方还在不在、在不在乎。回应少的时候，不安来得比较快。",
    },
  },
};
const ECR_LEVELS = { low: "低于中点", mid: "处于中点", high: "高于中点" };
const ECR_LEVEL_NAME = { 低于中点: "low", 处于中点: "mid", 高于中点: "high" };
const ECR_DIM_ALIAS = {
  avoidance: "avoidance",
  avoidant: "avoidance",
  avo: "avoidance",
  回避: "avoidance",
  依恋回避: "avoidance",
  anxiety: "anxiety",
  anxious: "anxiety",
  anx: "anxiety",
  焦虑: "anxiety",
  依恋焦虑: "anxiety",
};
const ECR_TYPE_ORDER = ["secure", "fearful", "preoccupied", "dismissing"];
const ECR_TYPE_META = {
  secure: {
    name: "安全型",
    short: "靠近不觉得别扭，分开也不容易慌。",
    text: "你比较能把亲近和独立放在一起。需要对方时，依赖不太羞耻；对方暂时不在，也不容易立刻觉得关系要散。心里话说得出口，也不必时时确认对方还爱不爱你。",
  },
  fearful: {
    name: "恐惧型",
    short: "想靠近，也怕靠太近。",
    text: "你既希望被靠近，又对太近保持戒备。一边担心被留下，一边在对方真的走近时想退开。关系里容易出现拉近又推开。不是不在乎，而是在乎和防备一起上来。",
  },
  preoccupied: {
    name: "专注型",
    short: "想靠近，又怕自己不够被在乎。",
    text: "你愿意靠近，也常常希望靠得更近。对方回应变少、注意不够、或者人不在身边时，不安来得比较快。你会想再确认一次，或者把关系拉紧一点。",
  },
  dismissing: {
    name: "冷漠型",
    short: "不太怕被丢下，但怕靠得太近。",
    text: "“会不会被丢掉”不太缠着你，但过度亲近、依赖和掏心会让你不自在。你更习惯自己扛，也更需要一点距离。对方若一直要求更多情绪上的靠近，你会想往后退。",
  },
};
const ECR_TYPE_ALIAS = {
  secure: "secure",
  安全型: "secure",
  fearful: "fearful",
  fear: "fearful",
  恐惧型: "fearful",
  preoccupied: "preoccupied",
  专注型: "preoccupied",
  先占型: "preoccupied",
  dismissing: "dismissing",
  dismissive: "dismissing",
  冷漠型: "dismissing",
  疏离型: "dismissing",
};

function ecrDimId(raw) {
  if (!raw || typeof raw !== "object") return "";
  const id = text(raw.id).toLowerCase();
  if (ECR_DIM_ALIAS[id]) return ECR_DIM_ALIAS[id];
  const name = text(raw.name);
  if (ECR_DIM_ALIAS[name]) return ECR_DIM_ALIAS[name];
  return "";
}

function ecrTypeId(raw) {
  if (!raw || typeof raw !== "object") return "";
  const id = text(raw.id).toLowerCase().replace(/[\s_-]/g, "");
  if (ECR_TYPE_ALIAS[id]) return ECR_TYPE_ALIAS[id];
  const name = text(raw.name);
  if (ECR_TYPE_ALIAS[name]) return ECR_TYPE_ALIAS[name];
  return "";
}

function looksLikeTypeName(value) {
  const name = text(value);
  if (!name || name.length > 24 || /[。！？]/.test(name)) return "";
  if (ECR_TYPE_ALIAS[name] || name.endsWith("型")) return name;
  return "";
}

function emptyEcrDim(id) {
  const meta = ECR_DIM_META[id];
  return {
    id,
    name: meta.name,
    about: meta.about,
    score: null,
    max: 7,
    sum: null,
    count: null,
    level: "",
    levelLabel: "",
    narrative: "",
  };
}

function emptyEcrType(id) {
  return {
    id,
    name: ECR_TYPE_META[id].name,
    short: "",
    text: "",
    m: null,
    win: null,
  };
}

function ecrLevelId(raw) {
  const id = text(raw.level).toLowerCase();
  if (ECR_LEVELS[id]) return id;
  const label = text(raw.levelLabel);
  if (ECR_LEVEL_NAME[label]) return ECR_LEVEL_NAME[label];
  const asLabel = text(raw.level);
  if (ECR_LEVEL_NAME[asLabel]) return ECR_LEVEL_NAME[asLabel];
  return "";
}

function ecrLevelFromMean(mean) {
  if (mean == null) return "";
  if (mean < 4) return "low";
  if (mean > 4) return "high";
  return "mid";
}

function applyEcrDim(slots, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const id = ecrDimId(raw);
  if (!id || !slots.has(id)) return;
  const slot = slots.get(id);
  const extra = asObj(raw.extra) || {};
  const name = text(raw.name);
  if (name) slot.name = name;
  const about = text(raw.about) || text(extra.about);
  if (about) slot.about = about;
  const mean = num(raw.mean);
  const score = num(raw.score);
  const exact = num(raw.exactMean);
  if (mean != null) slot.score = mean;
  else if (score != null) slot.score = score;
  else if (exact != null) slot.score = exact;
  const sum = num(raw.sum);
  if (sum != null) slot.sum = sum;
  const count = num(raw.count);
  if (count != null) slot.count = count;
  const max = num(raw.max);
  if (max != null && max > 0) slot.max = max;
  const level = ecrLevelId(raw);
  if (level) slot.level = level;
  const label = text(raw.levelLabel) || text(extra.levelLabel);
  if (label) slot.levelLabel = label;
  const narrative = text(raw.narrative) || text(extra.narrative);
  if (narrative) slot.narrative = narrative;
}

function applyEcrDimList(slots, list) {
  if (!Array.isArray(list)) return;
  list.forEach((item) => applyEcrDim(slots, item));
}

function applyNamedEcrDim(slots, id, raw) {
  const obj = asObj(raw);
  if (!obj) return;
  applyEcrDim(slots, { ...obj, id });
}

function applyEcrType(slots, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const id = ecrTypeId(raw);
  if (!id || !slots.has(id)) return;
  const slot = slots.get(id);
  const name = text(raw.name);
  if (name) slot.name = name;
  const short = text(raw.short);
  if (short) slot.short = short;
  const body = text(raw.text) || text(raw.narrative);
  if (body) slot.text = body;
  if (owns(raw, "m") && num(raw.m) != null) slot.m = num(raw.m);
  else if (owns(raw, "score") && num(raw.score) != null) slot.m = num(raw.score);
  else if (num(raw.exactM) != null) slot.m = num(raw.exactM);
  if (typeof raw.win === "boolean") slot.win = raw.win;
  else if (typeof raw.winner === "boolean") slot.win = raw.winner;
}

function applyEcrTypeList(slots, list) {
  if (!Array.isArray(list)) return;
  list.forEach((item) => applyEcrType(slots, item));
}

function packEcrType(raw) {
  const obj = asObj(raw);
  if (!obj) return null;
  const id = ecrTypeId(obj);
  const name = text(obj.name);
  const short = text(obj.short);
  const body = text(obj.text) || text(obj.narrative);
  if (!id && !name && !short && !body) return null;
  return { id, name, short, text: body };
}

function firstBool(values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function readEcrQuadrant(sources) {
  for (const obj of sources) {
    if (!obj || (!owns(obj, "quadrant") && !owns(obj, "quadrantName"))) continue;
    const id = ecrTypeId({ id: obj.quadrant, name: obj.quadrantName });
    const name = text(obj.quadrantName) || (id ? ECR_TYPE_META[id].name : "");
    return { id, name };
  }
  return { id: "", name: "" };
}

function finishEcrDims(slots) {
  slots.forEach((slot) => {
    if (!slot.level) slot.level = ecrLevelFromMean(slot.score);
    if (!slot.levelLabel && slot.level) slot.levelLabel = ECR_LEVELS[slot.level] || "";
    if (!slot.narrative && slot.level) slot.narrative = ECR_DIM_META[slot.id].levels[slot.level] || "";
  });
}

function finishEcrTypes(types) {
  const explicit = types.some((type) => typeof type.win === "boolean");
  if (!explicit && types.some((type) => type.m != null)) {
    const max = Math.max(...types.map((type) => (type.m == null ? -Infinity : type.m)));
    types.forEach((type) => {
      type.win = type.m != null && Math.abs(type.m - max) < 1e-8;
    });
    return;
  }
  types.forEach((type) => {
    if (type.win == null) type.win = false;
  });
}

function readEcrHeadline(pack, types) {
  const result = pack.result;
  const viewType = packEcrType(pack.viewModel.type) || packEcrType(pack.viewScore && pack.viewScore.type);
  const scoreType = packEcrType(pack.score && pack.score.type);
  const picked = {
    id: (viewType && viewType.id) || "",
    name: (viewType && viewType.name) || "",
    short: (viewType && viewType.short) || "",
    text: (viewType && viewType.text) || "",
  };
  if (!viewType) {
    if (!picked.id) {
      picked.id = ecrTypeId({ id: result.code })
        || ecrTypeId({ name: result.headline })
        || ecrTypeId({ name: result.label })
        || "";
    }
    if (!picked.name) picked.name = looksLikeTypeName(result.headline) || looksLikeTypeName(result.label) || "";
    const label = text(result.label);
    if (!picked.short && label && label !== picked.name && !label.includes("不是诊断") && !label.includes("筛查")) {
      picked.short = label;
    }
    if (!picked.text) picked.text = text(result.summary);
    if (scoreType && (!picked.id || !scoreType.id || picked.id === scoreType.id)) {
      if (!picked.id) picked.id = scoreType.id;
      if (!picked.name) picked.name = scoreType.name;
      if (!picked.short) picked.short = scoreType.short;
      if (!picked.text) picked.text = scoreType.text;
    }
  }
  const winners = types.filter((type) => type.win);
  if (!picked.name && winners.length) picked.name = winners.map((type) => type.name).join("、");
  if (!picked.id && winners.length === 1) picked.id = winners[0].id;
  const slot = picked.id ? types.find((type) => type.id === picked.id) : null;
  if (slot) {
    if (!picked.name) picked.name = slot.name;
    if (!picked.short) picked.short = slot.short;
    if (!picked.text) picked.text = slot.text;
  }
  const ids = winners.length ? winners.map((type) => type.id) : (picked.id ? [picked.id] : []);
  if (!picked.short && ids.length === 1) picked.short = ECR_TYPE_META[ids[0]].short;
  if (!picked.short && ids.length > 1) picked.short = "两个类型的判别分相同。";
  if (!picked.text && ids.length) picked.text = ids.map((id) => ECR_TYPE_META[id].text).join("");
  if (picked.text && picked.text === picked.short) picked.text = "";
  return picked;
}

function ecrBar(slot) {
  if (slot.score == null) return 0;
  return Math.max(0, Math.min(100, ((slot.score - 1) / 6) * 100));
}

function ecrDimArticle(slot) {
  const levelClass = slot.level ? ` ecr-level-${slot.level}` : "";
  const foot = slot.count != null && slot.sum != null
    ? `${showCount(slot.count)} 题合计 ${showCount(slot.sum)}`
    : (slot.sum != null ? `合计 ${showCount(slot.sum)}` : "");
  const narrative = slot.narrative && slot.narrative !== slot.about ? slot.narrative : "";
  return `
    <section class="factor">
      <header>
        <h3>${esc(slot.name)}</h3>
        <span class="sefs-score${levelClass}">${esc(fixed2(slot.score))} <small>/ ${esc(showCount(slot.max))}</small></span>
      </header>
      <em class="about">${esc(slot.about)}</em>
      <div class="bar ecr-track" aria-hidden="true">
        <b style="width:${ecrBar(slot).toFixed(1)}%"></b>
        <i style="left:50%"></i>
      </div>
      ${narrative ? `<p>${esc(narrative)}</p>` : ""}
      ${slot.levelLabel ? `<p class="sub">${esc(slot.levelLabel)}</p>` : ""}
      ${foot ? `<p class="scl-foot">${esc(foot)}</p>` : ""}
    </section>
  `;
}

function ecrPlane(model) {
  const avoid = model.dimensions[0];
  const anxiety = model.dimensions[1];
  if (!avoid || !anxiety || avoid.score == null || anxiety.score == null) return "";
  const x = Math.max(0, Math.min(100, ((avoid.score - 1) / 6) * 100));
  const y = Math.max(0, Math.min(100, ((anxiety.score - 1) / 6) * 100));
  return `
    <div class="plane" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%" role="img" aria-label="回避 ${esc(fixed2(avoid.score))}，焦虑 ${esc(fixed2(anxiety.score))}">
      <div class="plot"><b class="dot"></b></div>
      <span class="axis-x">回避</span>
      <span class="axis-y">焦虑</span>
    </div>
    <p class="fine plane-note">十字是量表中点，不是分型的切线。点越靠右回避越高，越靠上焦虑越高。</p>
  `;
}

function ecrMetrics(model) {
  return `<div class="metrics">${model.dimensions.map((slot) => `
    <div class="metric">
      <strong>${esc(fixed2(slot.score))}</strong>
      <span>${esc(slot.name)}</span>
      <em>${esc(slot.levelLabel || "—")}${slot.sum != null ? ` · 总分 ${esc(showCount(slot.sum))}` : ""}</em>
    </div>
  `).join("")}</div>`;
}

function ecrAxis(model) {
  if (model.dimensions.some((slot) => slot.score == null || !slot.levelLabel)) return "";
  return `${model.dimensions.map((slot) => `${slot.name} ${fixed2(slot.score)}，${slot.levelLabel}`).join("。")}。中点是 4 分。`;
}

function ecrTypeArticle(type) {
  const mark = type.win ? " · 最高" : "";
  return `<li class="${type.win ? "ecr-win" : ""}"><span>${esc(type.name)}${esc(mark)}</span><b>${esc(fixed2(type.m))}</b></li>`;
}

function readEcr(report) {
  report = report || {};
  const pack = sourcesOf(report);
  const dims = new Map(ECR_DIM_ORDER.map((id) => [id, emptyEcrDim(id)]));
  const typeSlots = new Map(ECR_TYPE_ORDER.map((id) => [id, emptyEcrType(id)]));
  applyEcrDimList(dims, pack.score && pack.score.dimensions);
  applyNamedEcrDim(dims, "avoidance", pack.score && pack.score.avoidance);
  applyNamedEcrDim(dims, "anxiety", pack.score && pack.score.anxiety);
  applyEcrDimList(dims, report.dimensions);
  applyNamedEcrDim(dims, "avoidance", pack.viewScore && pack.viewScore.avoidance);
  applyNamedEcrDim(dims, "anxiety", pack.viewScore && pack.viewScore.anxiety);
  applyEcrDimList(dims, pack.viewModel.dimensions);
  applyNamedEcrDim(dims, "avoidance", pack.viewModel.avoidance);
  applyNamedEcrDim(dims, "anxiety", pack.viewModel.anxiety);
  finishEcrDims(dims);
  applyEcrTypeList(typeSlots, pack.score && pack.score.types);
  applyEcrTypeList(typeSlots, pack.viewScore && pack.viewScore.types);
  applyEcrTypeList(typeSlots, pack.viewModel.types);
  const types = ECR_TYPE_ORDER.map((id) => typeSlots.get(id));
  finishEcrTypes(types);
  const headline = readEcrHeadline(pack, types);
  const flagText = Array.isArray(pack.result.flags) ? pack.result.flags.map((flag) => text(flag).toLowerCase()) : [];
  let tied = firstBool([pack.viewModel.tied, pack.viewScore && pack.viewScore.tied, pack.score && pack.score.tied]);
  if (tied == null && (flagText.includes("tied") || flagText.includes("tie"))) tied = true;
  if (tied == null) {
    const wins = types.filter((type) => type.win).length;
    if (wins > 1) tied = true;
    else if (wins === 1) tied = false;
  }
  const margin = pickState([pack.viewModel, pack.viewScore, pack.score], ["margin"]);
  let closeCall = firstBool([pack.viewModel.closeCall, pack.viewScore && pack.viewScore.closeCall, pack.score && pack.score.closeCall]);
  if (closeCall == null && (flagText.includes("close-call") || flagText.includes("closecall") || flagText.includes("close_call"))) closeCall = true;
  if (closeCall == null && margin.present && margin.value != null) closeCall = margin.value < 0.5 && tied !== true;
  const meansReady = ECR_DIM_ORDER.every((id) => dims.get(id).score != null);
  let nearMidpoint = firstBool([pack.viewModel.nearMidpoint, pack.viewScore && pack.viewScore.nearMidpoint, pack.score && pack.score.nearMidpoint]);
  if (nearMidpoint == null && (flagText.includes("near-midpoint") || flagText.includes("nearmidpoint"))) nearMidpoint = true;
  if (nearMidpoint == null && meansReady) {
    nearMidpoint = ECR_DIM_ORDER.every((id) => Math.abs(dims.get(id).score - 4) < 0.25);
  }
  const quadrant = readEcrQuadrant([pack.viewModel, pack.viewScore, pack.score]);
  let differs = firstBool([
    pack.viewModel.differsFromQuadrant,
    pack.viewScore && pack.viewScore.differsFromQuadrant,
    pack.score && pack.score.differsFromQuadrant,
  ]);
  if (differs == null && (flagText.includes("differs") || flagText.includes("differs-from-quadrant"))) differs = true;
  if (differs == null && quadrant.id && headline.id) differs = quadrant.id !== headline.id;
  if (differs == null) differs = false;
  const said = `${headline.short}${headline.text}`;
  const notes = [];
  if (tied === true && !said.includes("判别分相同")) notes.push("两个类型的判别分相同，并列写在上面。");
  else if (closeCall === true && margin.present && margin.value != null && tied !== true) {
    notes.push(`第一型只比第二型高 ${fixed2(margin.value)} 分。可以当作倾向，不必当成唯一标签。`);
  }
  if (nearMidpoint === true) notes.push("两个均分都贴着中点。类型仍然按判别分最高的一项给出，风格并不鲜明。");
  if (differs === true && quadrant.name && headline.name) {
    notes.push(`若只按 4 分切成四格，会落到${quadrant.name}。这份量表用判别式，最高的是${headline.name}。`);
  }
  const blocks = blocksOf(report.interpretation).concat(blocksOf(report.recommendations))
    .filter((block) => !block.text.includes("阅读页还没接上") && !block.text.includes(ECR_READER_GAP));
  const screen = blocks.find((block) => (
    block.id === "screen" || block.id === "disclaimer" || block.id === "notice"
    || (block.text.includes("不是诊断") && block.text.includes("不能代替"))
  ));
  const notice = screen && screen.text.includes("不能代替") ? screen.text : ECR_NOTICE;
  const seen = [headline.name, headline.short, headline.text, notice, ECR_KICKER]
    .concat(notes, [...dims.values()].flatMap((slot) => [slot.about, slot.narrative, slot.levelLabel]))
    .filter(Boolean);
  const extra = fresh(blocks
    .filter((block) => block !== screen)
    .map((block) => (block.title && block.title !== headline.name ? `${block.title}：${block.text}` : block.text)), seen);
  const quality = asObj(pack.extension.quality) || {};
  const rushBag = asObj(pack.viewModel.rush) || asObj(quality.rush);
  const rushed = quality.rushed === true || quality.tooFast === true
    || pack.viewModel.rushed === true || pack.viewModel.tooFast === true
    || (pack.score && (pack.score.rushed === true || pack.score.tooFast === true))
    || (rushBag && rushBag.tooFast === true);
  const dimensions = ECR_DIM_ORDER.map((id) => dims.get(id));
  const anyNumber = dimensions.some((slot) => slot.score != null) || types.some((type) => type.m != null);
  return {
    scaleName: text(report.assessmentName) || "成人依恋关系测评 ECR",
    type: headline,
    dimensions,
    types,
    notes,
    extra,
    notice,
    rushed,
    empty: !anyNumber,
    nickname: report.nickname,
    completedAt: report.completedAt,
    version: report.assessmentVersion,
  };
}

export function renderEcrReport(report) {
  const model = readEcr(report || {});
  const heading = model.type.name || model.scaleName;
  const who = model.type.name ? `<p class="sub">${esc(model.scaleName)}</p>` : "";
  const axis = ecrAxis(model);
  const notes = model.notes.length
    ? `<div class="notes">${model.notes.map((line) => `<p>${esc(line)}</p>`).join("")}</div>`
    : "";
  const extra = model.extra.length
    ? `<section class="sefs-insight">${model.extra.map((line) => `<p>${esc(line)}</p>`).join("")}</section>`
    : "";
  return `
    <div class="ecr-map">
      <p class="kicker">测评结果</p>
      ${who}
      ${personLine(model.nickname)}
      <h1 class="sefs-name">${esc(heading)}</h1>
      <p class="sub">${esc(ECR_KICKER)}</p>
      ${model.type.short ? `<p class="ename">${esc(model.type.short)}</p>` : ""}
      ${axis ? `<p class="lead">${esc(axis)}</p>` : ""}
      ${model.type.name ? "" : `<p class="state">这份结果里没有可显示的类型。</p>`}
      ${model.rushed ? `<p class="scl-rush"><strong>作答偏快。</strong>超过一半的题目间隔不到 1.5 秒。下面的分数仍然按作答计算。</p>` : ""}
      ${model.empty ? `<p class="state">这份结果里没有可显示的分数。</p>` : ""}
      ${ecrPlane(model)}
      ${ecrMetrics(model)}
      ${model.dimensions.map(ecrDimArticle).join("")}
      <h2>四个判别分</h2>
      <p class="sub">类型是分数最高的一项。回避均分记为 A，焦虑均分记为 B。</p>
      <ol class="scores ecr-types">${model.types.map(ecrTypeArticle).join("")}</ol>
      ${notes}
      ${model.type.text ? `<h2>这一型在说什么</h2><p class="story">${esc(model.type.text)}</p>` : ""}
      <h2>怎么看</h2>
      <ul class="guidance">
        <li>先看两个均分离 4 有多远。4 是量表从 1 到 7 的中点，不是诊断界值。</li>
        <li>再看四个判别分。最高的一项才是类型，不按“超过 4 分就划进高的一边”来切。</li>
        <li>这是你在恋爱经历里常常有的感觉，不是对某一次吵架的结论，也不能代替两个人具体怎么相处。</li>
      </ul>
      ${ecrLedger(report)}
      <div class="formulas">
        <p>回避均分 A = 奇数题之和 ÷ 18。焦虑均分 B = 偶数题之和 ÷ 18。</p>
        <p>安全型 = A×3.2893296 + B×5.4725318 − 11.5307833</p>
        <p>恐惧型 = A×7.2371075 + B×8.1776448 − 32.3553266</p>
        <p>专注型 = A×3.9246754 + B×9.7102446 − 28.4573220</p>
        <p>冷漠型 = A×7.3654621 + B×4.9392039 − 22.2281088</p>
        <p>四个数里取最高的一项。这是筛查式的自评，不是诊断。</p>
      </div>
      ${extra}
      ${model.notice ? `<p class="sefs-notice">${esc(model.notice)}</p>` : ""}
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </div>
  `;
}

// 寻根之旅 · 生命成长地图阅读约定：不按 33 题重算。assessmentId 必须是 root。
// 云端 assessmentVersion 是 root-h5-v1；页面上的「2.0」或其他版本只照字段展示，不报错。
// viewModel 优先（abilities / modules / familyClimate），其次 dimensions / result，再退到 extensionData.score。
// 八项能力在前，四个模块 id 是 subjectivity、emotion、relationship、value。分数多在 15–92，max 100。
// 模块分用显式 score；都没有时，才用该模块下两个能力分的四舍五入平均数。
// 状态优先 levelLabel，其次 level（strong / good / stable / room / watch / focus / explore）。没有分数就留「—」，不补 0。
// 关键发现用 findings 或 result.summary，不从高低分现编。家庭氛围可在 viewModel，也可在 extensionData.score.familyClimate。
// 1–5 分换成「很少 / 较少 / 一般 / 较明显 / 明显」。不读 answers，也不把长度超过 5 的数字数组当成氛围。
const ROOT_NOTICE = "自我探索，不是医学或心理诊断。";
const ROOT_SCALE = "寻根之旅 · 生命成长地图";
const ROOT_READER_GAP = "尚未重绘";
const ROOT_MODULE_ORDER = ["subjectivity", "emotion", "relationship", "value"];
const ROOT_MODULE_META = {
  subjectivity: { name: "主体性", dimIds: ["self_awareness", "autonomy_boundary"], about: "主体性看你如何认识自己，并守住自己的选择。" },
  emotion: { name: "情感力", dimIds: ["emotion_awareness", "emotional_independence"], about: "情感力看你如何觉察情绪，并在关系里回到自己的生活。" },
  relationship: { name: "关系力", dimIds: ["listening_understanding", "gentle_expression"], about: "关系力看你如何听懂别人，并真实、有边界地表达。" },
  value: { name: "价值力", dimIds: ["self_worth", "value_realization"], about: "价值力看你如何感受自身价值，并把它做成现实里的事。" },
};
const ROOT_MODULE_ALIAS = {
  subjectivity: "subjectivity",
  agency: "subjectivity",
  subject: "subjectivity",
  zhuti: "subjectivity",
  主体性: "subjectivity",
  emotion: "emotion",
  emotional: "emotion",
  emotionforce: "emotion",
  qinggan: "emotion",
  情感力: "emotion",
  relationship: "relationship",
  relation: "relationship",
  relations: "relationship",
  guanxi: "relationship",
  关系力: "relationship",
  value: "value",
  values: "value",
  valueforce: "value",
  jiazhi: "value",
  价值力: "value",
};
const ROOT_DIM_ORDER = [
  "self_awareness",
  "autonomy_boundary",
  "emotion_awareness",
  "emotional_independence",
  "listening_understanding",
  "gentle_expression",
  "self_worth",
  "value_realization",
];
const ROOT_DIM_META = {
  self_awareness: { name: "自我认知", module: "主体性", about: "了解自己是谁、真正想要什么，并能够辨认自己的需要与价值取向。" },
  autonomy_boundary: { name: "自主边界", module: "主体性", about: "能够为自己做选择并承担责任，同时区分自己与他人的需要、情绪与责任。" },
  emotion_awareness: { name: "情绪觉察", module: "情感力", about: "能够感知、辨认并理解自己的情绪，以及情绪背后正在发生什么。" },
  emotional_independence: { name: "情感独立", module: "情感力", about: "在重要关系中既能够保持连接，也能够维持自己的判断、生活重心和内在稳定。" },
  listening_understanding: { name: "倾听理解", module: "关系力", about: "能够暂时放下自己的立场，理解他人的观点、感受、需要与行为。" },
  gentle_expression: { name: "柔和表达", module: "关系力", about: "能够真实而有边界地表达自己，并在分歧和冲突中促进理解与修复。" },
  self_worth: { name: "自我价值感", module: "价值力", about: "对自身价值具有相对稳定的感受，不完全依赖成绩、身份或他人认可。" },
  value_realization: { name: "价值实现力", module: "价值力", about: "能够识别自己的能力与价值，并逐步将其转化为行动、贡献与现实结果。" },
};
const ROOT_DIM_ALIAS = {
  self_awareness: "self_awareness",
  selfawareness: "self_awareness",
  自我认知: "self_awareness",
  autonomy_boundary: "autonomy_boundary",
  autonomyboundary: "autonomy_boundary",
  boundary: "autonomy_boundary",
  自主边界: "autonomy_boundary",
  emotion_awareness: "emotion_awareness",
  emotionawareness: "emotion_awareness",
  情绪觉察: "emotion_awareness",
  emotional_independence: "emotional_independence",
  emotionalindependence: "emotional_independence",
  情感独立: "emotional_independence",
  listening_understanding: "listening_understanding",
  listeningunderstanding: "listening_understanding",
  listening: "listening_understanding",
  倾听理解: "listening_understanding",
  gentle_expression: "gentle_expression",
  gentleexpression: "gentle_expression",
  expression: "gentle_expression",
  柔和表达: "gentle_expression",
  self_worth: "self_worth",
  selfworth: "self_worth",
  worth: "self_worth",
  自我价值感: "self_worth",
  value_realization: "value_realization",
  valuerealization: "value_realization",
  realization: "value_realization",
  价值实现力: "value_realization",
};
const ROOT_CLIMATE_ORDER = ["high_expectation", "emotional_suppression", "control_intervention", "criticism", "warmth"];
const ROOT_CLIMATE_META = {
  high_expectation: { name: "高期待" },
  emotional_suppression: { name: "情感压抑" },
  control_intervention: { name: "控制干预" },
  criticism: { name: "批评指责" },
  warmth: { name: "温暖支持" },
};
const ROOT_LEVEL_LABEL = {
  strong: "优势明显",
  good: "发展较好",
  stable: "较为稳定",
  room: "有提升空间",
  watch: "值得关注",
  focus: "当前成长重点",
  explore: "值得深入探索",
};
const ROOT_CLIMATE_ALIAS = {
  high_expectation: "high_expectation",
  highexpectation: "high_expectation",
  expectation: "high_expectation",
  expectations: "high_expectation",
  高期待: "high_expectation",
  emotional_suppression: "emotional_suppression",
  emotionalsuppression: "emotional_suppression",
  suppression: "emotional_suppression",
  情感压抑: "emotional_suppression",
  control: "control_intervention",
  control_intervention: "control_intervention",
  controlintervention: "control_intervention",
  intervention: "control_intervention",
  控制干预: "control_intervention",
  criticism: "criticism",
  criticism_blame: "criticism",
  blame: "criticism",
  批评指责: "criticism",
  warmth: "warmth",
  warmth_support: "warmth",
  support: "warmth",
  温暖支持: "warmth",
};
const ROOT_CLIMATE_LABELS = ["很少", "较少", "一般", "较明显", "明显"];
const ROOT_FINDING_KEYS = ["findings", "keyFindings", "key_findings", "keyFinding"];
const ROOT_CLIMATE_KEYS = ["familyClimate", "familyClimates", "climates", "climate"];

function aliasLookup(table, value) {
  const raw = text(value);
  if (!raw) return "";
  if (Object.prototype.hasOwnProperty.call(table, raw)) return table[raw];
  const keyed = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (Object.prototype.hasOwnProperty.call(table, keyed)) return table[keyed];
  const compact = keyed.replace(/_/g, "");
  if (Object.prototype.hasOwnProperty.call(table, compact)) return table[compact];
  return "";
}

function rootModuleId(raw) {
  if (typeof raw === "string") return aliasLookup(ROOT_MODULE_ALIAS, raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  return aliasLookup(ROOT_MODULE_ALIAS, raw.id) || aliasLookup(ROOT_MODULE_ALIAS, raw.name);
}

function rootDimId(raw) {
  if (typeof raw === "string") return aliasLookup(ROOT_DIM_ALIAS, raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  return aliasLookup(ROOT_DIM_ALIAS, raw.id) || aliasLookup(ROOT_DIM_ALIAS, raw.name);
}

function rootClimateId(raw) {
  const direct = aliasLookup(ROOT_CLIMATE_ALIAS, raw);
  if (direct) return direct;
  const name = text(raw);
  if (!name) return "";
  const tail = name.split(/[-–—]/).pop();
  if (tail && tail !== name) return aliasLookup(ROOT_CLIMATE_ALIAS, tail);
  return "";
}

function rootStatus(score) {
  if (score == null) return "";
  if (score >= 85) return "优势明显";
  if (score >= 75) return "发展较好";
  if (score >= 65) return "较为稳定";
  if (score >= 55) return "有提升空间";
  if (score >= 45) return "值得关注";
  if (score >= 35) return "当前成长重点";
  return "值得深入探索";
}

function statusText(value) {
  const raw = text(value);
  if (!raw || raw.length > 24) return "";
  if (/[。！？]/.test(raw)) return "";
  if (raw === "—" || raw === "-" || raw === "－") return "";
  return raw;
}

function rootStatusLabel(value) {
  const raw = statusText(value);
  if (!raw) return "";
  return ROOT_LEVEL_LABEL[raw.toLowerCase()] || raw;
}

function showScore(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function versionText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function emptyRootModule(id) {
  const meta = ROOT_MODULE_META[id];
  return { id, name: meta.name, about: meta.about, score: null, max: 100, status: "", dimIds: meta.dimIds };
}

function emptyRootDim(id) {
  const meta = ROOT_DIM_META[id];
  return { id, name: meta.name, module: meta.module, about: meta.about, score: null, max: 100, status: "" };
}

function emptyRootClimate(id) {
  return { id, name: ROOT_CLIMATE_META[id].name, score: null, label: "" };
}

function rootScoreOf(obj) {
  if (!obj || typeof obj !== "object") return null;
  const keys = ["score", "mean", "value"];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!owns(obj, key)) continue;
    if (key === "value" && typeof obj.value !== "number" && typeof obj.value !== "string") continue;
    const score = num(obj[key]);
    if (score != null) return score;
  }
  return null;
}

function applyRootModule(slots, raw) {
  if (raw == null) return;
  const obj = typeof raw === "number" || typeof raw === "string" ? { score: raw } : asObj(raw);
  if (!obj) return;
  const id = rootModuleId(obj);
  if (!id || !slots.has(id)) return;
  const slot = slots.get(id);
  const name = text(obj.name);
  if (name && !rootModuleId(name)) slot.name = name;
  const score = rootScoreOf(obj);
  const status = rootStatusLabel(obj.status) || rootStatusLabel(obj.levelLabel) || rootStatusLabel(obj.level);
  if (score != null) {
    if (slot.score !== score && !status) slot.status = "";
    slot.score = score;
  }
  if (status) slot.status = status;
  const max = num(obj.max);
  if (max != null && max > 0) slot.max = max;
  const about = text(obj.narrative) || text(obj.about) || text(obj.explanation);
  if (about) slot.about = about;
}

function applyRootModuleMap(slots, map) {
  const obj = asObj(map);
  if (!obj) return;
  Object.keys(obj).forEach((key) => {
    const id = rootModuleId(key);
    if (!id) return;
    const value = obj[key];
    if (typeof value === "number" || typeof value === "string") {
      applyRootModule(slots, { id, score: value });
      return;
    }
    const raw = asObj(value);
    if (!raw) return;
    applyRootModule(slots, { ...raw, id: raw.id || id });
  });
}

function applyRootModuleList(slots, list) {
  if (!Array.isArray(list)) return;
  const positional = list.length === ROOT_MODULE_ORDER.length
    && list.every((item) => item == null || typeof item === "number" || typeof item === "string" || (asObj(item) && !rootModuleId(item)));
  list.forEach((item, index) => {
    if (item == null) return;
    if (positional) {
      const id = ROOT_MODULE_ORDER[index];
      if (typeof item === "number" || typeof item === "string") applyRootModule(slots, { id, score: item });
      else applyRootModule(slots, { ...item, id });
      return;
    }
    applyRootModule(slots, item);
  });
}

function applyRootNamedModules(slots, bag) {
  if (!bag) return;
  ROOT_MODULE_ORDER.forEach((id) => {
    const name = ROOT_MODULE_META[id].name;
    if (owns(bag, id)) applyRootModule(slots, namedRootValue(bag[id], id));
    if (owns(bag, name)) applyRootModule(slots, namedRootValue(bag[name], id));
  });
}

function namedRootValue(value, id) {
  if (typeof value === "number" || typeof value === "string") return { id, score: value };
  const obj = asObj(value);
  if (!obj) return null;
  return { ...obj, id: obj.id || id };
}

function applyRootDim(slots, raw) {
  const obj = asObj(raw);
  if (!obj) return;
  const id = rootDimId(obj);
  if (!id || !slots.has(id)) return;
  const slot = slots.get(id);
  const extra = asObj(obj.extra) || {};
  const name = text(obj.name);
  if (name && !rootDimId(name)) slot.name = name;
  const direct = rootScoreOf(obj);
  const score = direct != null ? direct : rootScoreOf(extra);
  const status = rootStatusLabel(obj.status) || rootStatusLabel(obj.levelLabel) || rootStatusLabel(obj.level)
    || rootStatusLabel(extra.status) || rootStatusLabel(extra.levelLabel);
  if (score != null) {
    if (slot.score !== score && !status) slot.status = "";
    slot.score = score;
  }
  if (status) slot.status = status;
  const max = num(obj.max);
  if (max != null && max > 0) slot.max = max;
  const about = text(obj.narrative) || text(obj.explanation) || text(obj.about) || text(obj.brief)
    || text(extra.narrative) || text(extra.explanation) || text(extra.about);
  if (about) slot.about = about;
  const moduleName = text(obj.module) || text(obj.moduleId) || text(extra.module) || text(extra.moduleId);
  if (moduleName) {
    const moduleId = rootModuleId(moduleName);
    slot.module = moduleId ? ROOT_MODULE_META[moduleId].name : moduleName;
  }
}

function applyRootDimMap(slots, map) {
  const obj = asObj(map);
  if (!obj) return;
  Object.keys(obj).forEach((key) => {
    const id = rootDimId(key);
    if (!id) return;
    const value = obj[key];
    if (typeof value === "number" || typeof value === "string") {
      applyRootDim(slots, { id, score: value });
      return;
    }
    const raw = asObj(value);
    if (!raw) return;
    applyRootDim(slots, { ...raw, id: raw.id || id });
  });
}

function applyRootStatusMap(slots, map) {
  const obj = asObj(map);
  if (!obj) return;
  Object.keys(obj).forEach((key) => {
    const id = rootDimId(key);
    if (!id || !slots.has(id)) return;
    const value = obj[key];
    const packed = asObj(value);
    const status = rootStatusLabel(value) || rootStatusLabel(packed && (packed.status || packed.levelLabel || packed.level || packed.label));
    if (status) slots.get(id).status = status;
  });
}

function applyRootDimList(slots, list) {
  if (!Array.isArray(list)) return;
  const recognized = list.some((item) => rootDimId(item));
  const positional = !recognized && list.length === ROOT_DIM_ORDER.length;
  list.forEach((item, index) => {
    if (item == null) return;
    if (positional) {
      const id = ROOT_DIM_ORDER[index];
      if (typeof item === "number" || typeof item === "string") applyRootDim(slots, { id, score: item });
      else if (asObj(item)) applyRootDim(slots, { ...item, id: item.id || id });
      return;
    }
    applyRootDim(slots, item);
  });
}

function applyRootScoreArray(slots, list) {
  if (!Array.isArray(list) || list.length !== ROOT_DIM_ORDER.length) return;
  if (list.some((item) => item && typeof item === "object")) return;
  list.forEach((item, index) => {
    const score = num(item);
    if (score == null) return;
    const slot = slots.get(ROOT_DIM_ORDER[index]);
    if (slot.score !== score) slot.status = "";
    slot.score = score;
  });
}

function applyRootNamedDims(slots, bag) {
  if (!bag) return;
  ROOT_DIM_ORDER.forEach((id) => {
    const name = ROOT_DIM_META[id].name;
    if (owns(bag, id)) applyRootDim(slots, namedRootValue(bag[id], id));
    if (owns(bag, name)) applyRootDim(slots, namedRootValue(bag[name], id));
  });
}

function applyRootDimBag(slots, bag) {
  if (!bag) return;
  applyRootScoreArray(slots, bag.scores);
  applyRootDimList(slots, bag.dimensions);
  applyRootDimMap(slots, bag.dimensionScores);
  applyRootNamedDims(slots, bag);
  applyRootDimList(slots, bag.abilities);
  applyRootStatusMap(slots, bag.dimensionStatuses);
}

function applyRootModuleBag(slots, bag) {
  if (!bag) return;
  applyRootModuleMap(slots, bag.moduleScores);
  applyRootModuleList(slots, bag.modules);
  applyRootNamedModules(slots, bag);
}

function climateLabelFromScore(score) {
  if (score == null || !Number.isFinite(score)) return "";
  const rounded = Math.round(score);
  if (Math.abs(score - rounded) > 1e-8) return "";
  if (rounded < 1 || rounded > 5) return "";
  return ROOT_CLIMATE_LABELS[rounded - 1];
}

function applyRootClimate(slots, raw, indexHint) {
  if (typeof raw === "number" || typeof raw === "string") {
    if (!Number.isInteger(indexHint) || indexHint < 0 || indexHint >= ROOT_CLIMATE_ORDER.length) return;
    const slot = slots.get(ROOT_CLIMATE_ORDER[indexHint]);
    const score = num(raw);
    if (score != null) slot.score = score;
    else if (text(raw)) slot.label = text(raw);
    return;
  }
  const obj = asObj(raw);
  if (!obj) return;
  let id = rootClimateId(obj.id) || rootClimateId(obj.name) || rootClimateId(obj.key);
  if (!id && Number.isInteger(indexHint) && indexHint >= 0 && indexHint < ROOT_CLIMATE_ORDER.length) {
    id = ROOT_CLIMATE_ORDER[indexHint];
  }
  if (!id || !slots.has(id)) return;
  const slot = slots.get(id);
  const name = text(obj.name);
  if (name && !rootClimateId(name)) slot.name = name;
  const score = rootScoreOf(obj);
  if (score != null) slot.score = score;
  const label = text(obj.label) || text(obj.levelLabel) || statusText(obj.level) || text(obj.text);
  if (label && label !== slot.name && !rootClimateId(label)) slot.label = label;
}

function finishRootClimate(slot) {
  if (!slot.label) slot.label = climateLabelFromScore(slot.score);
}

function readRootClimates(raw) {
  if (raw == null || typeof raw === "boolean") return null;
  const slots = new Map(ROOT_CLIMATE_ORDER.map((id) => [id, emptyRootClimate(id)]));
  if (Array.isArray(raw)) {
    const answerVector = raw.length > ROOT_CLIMATE_ORDER.length
      && raw.every((item) => item == null || typeof item === "number" || typeof item === "string");
    if (answerVector) return null;
    raw.forEach((item, index) => applyRootClimate(slots, item, index));
  } else if (asObj(raw)) {
    Object.keys(raw).forEach((key) => {
      const id = rootClimateId(key);
      const value = raw[key];
      if (id && (typeof value === "number" || typeof value === "string")) {
        applyRootClimate(slots, { id, score: num(value), label: num(value) == null ? text(value) : "" }, -1);
        return;
      }
      const obj = asObj(value);
      if (obj) applyRootClimate(slots, { ...obj, id: obj.id || id || key, name: obj.name || (id ? ROOT_CLIMATE_META[id].name : key) }, -1);
      else if (id) applyRootClimate(slots, { id }, -1);
    });
  } else {
    return null;
  }
  const items = ROOT_CLIMATE_ORDER.map((id) => {
    const slot = slots.get(id);
    finishRootClimate(slot);
    return slot;
  });
  const any = items.some((item) => item.label || item.score != null);
  if (!any && !Array.isArray(raw)) return null;
  return items;
}

function ownedClimate(bag) {
  if (!bag) return undefined;
  const key = ROOT_CLIMATE_KEYS.find((name) => owns(bag, name));
  if (!key) return undefined;
  return bag[key];
}

function readFindingList(raw) {
  if (raw == null) return [];
  if (typeof raw === "string") return text(raw) ? [text(raw)] : [];
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === "string") return text(item);
      const obj = asObj(item);
      if (!obj) return "";
      const body = text(obj.text) || text(obj.body) || text(obj.x) || text(obj.summary);
      const title = text(obj.title);
      if (title && body && title !== body) return `${title}：${body}`;
      return body || title;
    }).filter(Boolean);
  }
  const obj = asObj(raw);
  if (!obj) return [];
  const body = text(obj.text) || text(obj.body) || text(obj.x) || text(obj.summary);
  const title = text(obj.title);
  if (title && body && title !== body) return [`${title}：${body}`];
  return body || title ? [body || title] : [];
}

function findingsFrom(bag) {
  if (!bag) return null;
  const key = ROOT_FINDING_KEYS.find((name) => owns(bag, name));
  const summary = text(bag.summary);
  if (!key && !summary) return null;
  const lines = key ? readFindingList(bag[key]) : [];
  if (summary && !lines.some((line) => line === summary || line.includes(summary))) lines.push(summary);
  return lines;
}

function rootSkipBlock(block) {
  if (!block) return true;
  if (block.id === "disclaimer" || block.id === "notice" || block.id === "screen" || block.id === "reader" || block.id === "climate") return true;
  if (rootDimId(block.id) || rootModuleId(block.id)) return true;
  if (block.text.includes("不是医学或心理诊断")) return true;
  if (block.text.includes(ROOT_READER_GAP) || block.text.includes("阅读页还没接上") || block.text.includes("尚未重绘")) return true;
  return false;
}

function rootRushed(bags) {
  for (const bag of bags) {
    if (!bag) continue;
    if (typeof bag.rushed === "boolean") return bag.rushed;
    if (typeof bag.tooFast === "boolean") return bag.tooFast;
    const quality = asObj(bag.quality);
    if (quality && (typeof quality.rushed === "boolean" || typeof quality.tooFast === "boolean")) {
      return quality.rushed === true || quality.tooFast === true;
    }
  }
  return false;
}

function rootBar(slot) {
  if (slot.score == null) return 0;
  const max = slot.max != null && slot.max > 0 ? slot.max : 100;
  return Math.max(0, Math.min(100, (slot.score / max) * 100));
}

function readRoot(report) {
  report = report && typeof report === "object" ? report : {};
  let pack;
  try {
    pack = sourcesOf(report);
  } catch {
    pack = { viewModel: {}, viewScore: null, score: null, extension: {}, result: {} };
  }
  const viewModel = asObj(pack.viewModel) || {};
  const viewScore = asObj(pack.viewScore);
  const score = asObj(pack.score);
  const extension = asObj(pack.extension) || {};
  const result = asObj(pack.result) || {};
  const modules = new Map(ROOT_MODULE_ORDER.map((id) => [id, emptyRootModule(id)]));
  const dims = new Map(ROOT_DIM_ORDER.map((id) => [id, emptyRootDim(id)]));

  [extension, score].forEach((bag) => {
    applyRootModuleBag(modules, bag);
    applyRootDimBag(dims, bag);
  });
  if (Array.isArray(report.dimensions)) {
    applyRootDimList(dims, report.dimensions);
    applyRootModuleList(modules, report.dimensions);
  } else if (asObj(report.dimensions)) {
    applyRootDimMap(dims, report.dimensions);
    applyRootModuleMap(modules, report.dimensions);
  }
  applyRootModuleBag(modules, result);
  applyRootDimBag(dims, result);
  [viewScore, viewModel].forEach((bag) => {
    applyRootModuleBag(modules, bag);
    applyRootDimBag(dims, bag);
  });

  const dimList = ROOT_DIM_ORDER.map((id) => dims.get(id));
  const moduleList = ROOT_MODULE_ORDER.map((id) => {
    const slot = modules.get(id);
    if (slot.score == null) {
      const pair = slot.dimIds.map((dimId) => dims.get(dimId).score);
      if (pair.every((value) => value != null)) slot.score = Math.round((pair[0] + pair[1]) / 2);
    }
    if (!slot.status) slot.status = rootStatus(slot.score);
    return slot;
  });
  dimList.forEach((slot) => {
    if (!slot.status) slot.status = rootStatus(slot.score);
  });

  let findings = null;
  for (const bag of [viewModel, viewScore, result, score, extension]) {
    const got = findingsFrom(bag);
    if (got) {
      findings = got;
      break;
    }
  }
  if (findings == null) {
    const blocks = blocksOf(report.interpretation).concat(blocksOf(report.recommendations)).filter((block) => !rootSkipBlock(block));
    findings = blocks.map((block) => (block.title && block.title !== block.text ? `${block.title}：${block.text}` : block.text));
  }
  const headline = pickText([viewModel, viewScore, result], ["headline", "title"]);
  let climates = null;
  for (const bag of [viewModel, viewScore, result, score, extension]) {
    if (ownedClimate(bag) === undefined) continue;
    climates = readRootClimates(ownedClimate(bag));
    break;
  }
  const scaleName = text(report.assessmentName) || ROOT_SCALE;
  return {
    scaleName,
    headline: headline && headline !== scaleName ? headline : "",
    modules: moduleList,
    dimensions: dimList,
    findings: findings || [],
    climates,
    rushed: rootRushed([viewModel, viewScore, result, score, extension]),
    notice: ROOT_NOTICE,
    nickname: text(report.nickname),
    completedAt: report.completedAt,
    version: versionText(report.assessmentVersion),
    empty: !moduleList.some((slot) => slot.score != null) && !dimList.some((slot) => slot.score != null),
  };
}

function rootModuleArticle(slot, index) {
  return `
    <article class="life-module module-${index}">
      <h3>${esc(slot.name)}</h3>
      <div class="score-orbit"><p class="sefs-score">${esc(showScore(slot.score))}</p></div>
      <p>${esc(slot.status || "—")}</p>
    </article>
  `;
}

function rootDimArticle(slot) {
  return `
    <article>
      <div><h3>${esc(slot.name)}</h3><span>${esc(slot.about || slot.module || "")}</span></div>
      <p class="sefs-score">${esc(showScore(slot.score))} <small>${esc(slot.status || "—")}</small></p>
    </article>
  `;
}

function rootRadar(dimensions) {
  if (dimensions.some((slot) => slot.score == null)) return "";
  const center = 145;
  const radius = 91;
  const point = (index, value) => {
    const angle = -Math.PI / 2 + index * Math.PI / 4;
    return [center + Math.cos(angle) * radius * value, center + Math.sin(angle) * radius * value];
  };
  const polygon = (value) => dimensions.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  const values = dimensions.map((slot, index) => point(index, slot.score / 100).map((n) => n.toFixed(1)).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map((value) => `<polygon points="${polygon(value)}" class="radar-grid"></polygon>`).join("");
  const axes = dimensions.map((_, index) => {
    const [x, y] = point(index, 1);
    return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar-axis"></line>`;
  }).join("");
  const dots = dimensions.map((slot, index) => {
    const [x, y] = point(index, slot.score / 100);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.8" class="radar-point"></circle>`;
  }).join("");
  const labels = dimensions.map((slot, index) => {
    const [x, y] = point(index, 1.27);
    return `<span style="left:${(x / 2.9).toFixed(2)}%;top:${(y / 2.9).toFixed(2)}%">${esc(slot.name)}<b>${esc(showScore(slot.score))}</b></span>`;
  }).join("");
  return `<div class="radar radar-eight"><svg viewBox="0 0 290 290" role="img" aria-label="八维核心能力雷达图">${rings}${axes}<polygon points="${values}" class="radar-shape"></polygon>${dots}</svg>${labels}</div>`;
}

function rootClimateArticle(slot) {
  return `<div><span>${esc(slot.name)}</span><b>${esc(slot.label || "—")}</b></div>`;
}

function rootGrowth(model) {
  if (model.dimensions.some((slot) => slot.score == null)) return "";
  const sorted = model.dimensions.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh"));
  const highest = sorted.slice(0, 2);
  const lowest = sorted[sorted.length - 1];
  const gap = sorted[0].score - lowest.score;
  const edges = gap < 8 ? [] : sorted.slice().reverse().slice(0, 2);
  const advantage = `<section class="growth-diagnosis"><h2>我的成长优势</h2>${highest.map((item) => `<article><b>${esc(item.name)}</b><p>${esc(item.about)}</p><small>从本次作答看，这是你目前相对更稳定的部分。</small></article>`).join("")}</section>`;
  const weak = edges.length
    ? `<section class="growth-diagnosis"><h2>我的当前薄弱区</h2>${edges.map((item) => `<article><b>${esc(item.name)}</b><p>${esc(item.about)}</p><small>${esc(item.status)}，适合从真实困惑里继续观察。</small></article>`).join("")}</section>`
    : `<section class="growth-diagnosis"><h2>目前相对更稳定的部分</h2><p>你的八个维度目前比较接近，暂时没有特别突出的单一短板。接下来更值得结合真实困惑继续判断。</p></section>`;
  const themes = edges.length
    ? edges.map((item) => item.name)
    : ["结合真实困惑继续探索"];
  const next = `<section class="growth-diagnosis growth-themes"><h2>我的下一阶段成长课题</h2>${themes.map((name) => `<article><b>${esc(name)}</b></article>`).join("")}</section>`;
  return advantage + weak + next;
}

export function renderRootReport(report) {
  const model = readRoot(report);
  const nick = visibleNickname(model.nickname);
  const rawTitle = model.headline || "我的生命成长地图";
  const mapTitle = rawTitle === "我的生命成长地图" || rawTitle === "生命成长地图";
  const head = mapTitle
    ? `<h1 class="sefs-name">${nickMark(model.nickname)}的生命成长地图</h1>`
    : `${rawTitle.includes(nick) ? "" : personLine(model.nickname)}<h1 class="sefs-name">${esc(rawTitle)}</h1>`;
  const findings = model.findings.length
    ? `<section class="life-findings"><h2>关键发现</h2>${model.findings.map((line, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><p>${esc(line)}</p></article>`).join("")}</section>`
    : "";
  const climates = model.climates
    ? `<section class="family-climate"><h2>家庭氛围关键词</h2><p>这些是你对成长环境的主观体验，不代表对任何家庭成员的评价或诊断。</p>${model.climates.map(rootClimateArticle).join("")}</section>`
    : "";
  const radar = rootRadar(model.dimensions);
  return `
    <section class="life-map root-map">
      <div class="life-map-head">
        <div>
          <span>觉塑 · 成长诊断</span>
          ${head}
          <p>你已有一些可依靠的成长资源；下一步更值得把注意力放在现实选择与关系中的具体反应上。分数用于观察相对状态，不代表医学或人格诊断。</p>
          <p class="sub">${esc(model.scaleName)}。${esc(ROOT_NOTICE)}</p>
        </div>
      </div>
      ${model.rushed ? `<p class="scl-rush"><strong>作答偏快。</strong>下面的分数仍然按交卷时的结果展示。</p>` : ""}
      ${model.empty ? `<p class="state">这份结果里没有可显示的分数。</p>` : ""}
      <section class="life-summary"><h2>我的四大生命能力</h2><div class="life-module-grid">${model.modules.map(rootModuleArticle).join("")}</div></section>
      ${radar ? `<section class="life-radar-card"><h2>8维核心能力雷达图</h2>${radar}</section>` : ""}
      <section class="dimension-list"><h2>八项生命能力</h2>${model.dimensions.map(rootDimArticle).join("")}</section>
      ${findings}
      ${climates}
      ${rootGrowth(model)}
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </section>
  `;
}

// 爱的 5 种语言：不按 30 道选择重算。assessmentId 必须是 loves5。
// 分数优先 dimensions，其次 viewModel.scores / extensionData.score.scores。
// id 可以是 A–E，也可以是 words / time / gifts / service / touch 或中文名。
// 主爱语看 result.code、viewModel.primaries，或 level / levelLabel。没有分数就留「—」。
const LOVES_NOTICE = "这是一份爱的语言整理，不是性格诊断，也不说明哪种语言更好。";
const LOVES_SCALE = "爱的 5 种语言";
const LOVES = [
  { id: "A", name: "肯定的言词", english: "Words of Affirmation", meaning: "赞美、鼓励、感激。口头和书面的肯定，是被看见的证据。", how: "认真称赞，说「我爱你」，写短笺，肯定对方的选择。" },
  { id: "B", name: "精心的时刻", english: "Quality Time", meaning: "全神贯注的陪伴。一起做事，或只是在一起，不被打断。", how: "放下手机，一起散步，把一段对话听完。" },
  { id: "C", name: "接受礼物", english: "Receiving Gifts", meaning: "礼物是看见与惦记的可见记号。贵重与否不重要，有心才重要。", how: "记得日子，带一个小物件回来，亲手做也算。" },
  { id: "D", name: "服务的行动", english: "Acts of Service", meaning: "愿意做对方希望被帮忙的事，把负担从对方肩上挪开。", how: "做饭、洗碗、代办琐事，不用等对方开口。" },
  { id: "E", name: "身体的接触", english: "Physical Touch", meaning: "靠近、触碰、被抱住。身体在场，才会觉得安全。", how: "牵手、拥抱、坐近一点，允许亲昵。" },
];
const LOVE_ALIAS = {
  a: "A", words: "A", wordsofaffirmation: "A", affirmation: "A", 肯定的言词: "A", 肯定言词: "A",
  b: "B", time: "B", qualitytime: "B", 精心的时刻: "B", 精心时刻: "B",
  c: "C", gifts: "C", gift: "C", receivinggifts: "C", 接受礼物: "C", 礼物: "C",
  d: "D", service: "D", actsofservice: "D", 服务的行动: "D", 服务行动: "D",
  e: "E", touch: "E", physicaltouch: "E", 身体的接触: "E", 身体接触: "E",
};

// 巨婴测评：总分、心理特征、行为特征和分档不按 20 项重算。
// 逐项分数用已上传的 answers 对照本地题库还原，不改上传协议。id 是 total / mind / act。分档 id 是 mature、partial、infant、child。
const JUYING_NOTICE = "这是讲座对照，不是诊断，也不是心理评估。";
const JUYING_DISCLAIMER = "非严肃科学，仅供讲座听众理解学习。";
const JUYING_SCALE = "巨婴测评";
const JUYING_BANDS = {
  mature: "心智成熟",
  partial: "有部分巨婴特质",
  infant: "巨婴",
  child: "儿童状态",
};
const JUYING_ORDER = [
  { id: "total", name: "总分", max: 100 },
  { id: "mind", name: "心理特征", max: 50 },
  { id: "act", name: "行为特征", max: 50 },
];
const JUYING_ALIAS = {
  total: "total", score: "total", sum: "total", 总分: "total",
  mind: "mind", psychology: "mind", 心理特征: "mind", 心理: "mind",
  act: "act", action: "act", behavior: "act", behaviour: "act", 行为特征: "act", 行为: "act",
};

function finiteNum(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function aliasId(table, value) {
  const raw = text(value).replace(/\s+/g, "");
  if (!raw) return "";
  return table[raw] || table[raw.toLowerCase()] || "";
}

function scoreBag(value) {
  const obj = asObj(value);
  if (!obj) return null;
  return asObj(obj.scores) || obj;
}

function freshLines(lines, seen) {
  const bag = new Set(seen.filter(Boolean));
  const out = [];
  for (const line of lines) {
    const body = text(line);
    if (!body || bag.has(body)) continue;
    bag.add(body);
    out.push(body);
  }
  return out;
}

function proseLines(report) {
  return blocksOf(report && report.interpretation)
    .concat(blocksOf(report && report.recommendations))
    .map((block) => (block.title && block.title !== block.text ? `${block.title}：${block.text}` : block.text));
}

function loveSlot(id) {
  const meta = LOVES.find((item) => item.id === id);
  return { ...meta, score: null, max: 12, primary: false, narrative: "" };
}

function readLoves5(report) {
  const safe = report || {};
  const slots = new Map(LOVES.map((item) => [item.id, loveSlot(item.id)]));
  const view = viewModelOf(safe);
  const score = calcOf(safe);
  const result = asObj(safe.result) || {};
  for (const bag of [scoreBag(score), scoreBag(view), scoreBag(view.score)]) {
    if (!bag) continue;
    for (const key of Object.keys(bag)) {
      const id = aliasId(LOVE_ALIAS, key);
      const value = finiteNum(bag[key]);
      if (id && value != null) slots.get(id).score = value;
    }
  }
  const dims = Array.isArray(safe.dimensions) ? safe.dimensions : [];
  for (const dim of dims) {
    if (!dim || typeof dim !== "object") continue;
    const id = aliasId(LOVE_ALIAS, dim.id) || aliasId(LOVE_ALIAS, dim.name);
    if (!id) continue;
    const slot = slots.get(id);
    const value = finiteNum(dim.score);
    if (value != null) slot.score = value;
    const max = finiteNum(dim.max);
    if (max != null && max > 0) slot.max = max;
    if (text(dim.narrative)) slot.narrative = text(dim.narrative);
    const level = text(dim.level).toLowerCase();
    const label = text(dim.levelLabel);
    if (level === "primary" || label.includes("主爱语")) slot.primary = true;
  }
  const code = text(result.code).toUpperCase().replace(/[^A-E]/g, "");
  const listed = Array.isArray(view.primaries) ? view.primaries : Array.isArray(score.primaries) ? score.primaries : [];
  for (const item of listed) {
    const id = aliasId(LOVE_ALIAS, item);
    if (id) slots.get(id).primary = true;
  }
  if (code) {
    for (const id of slots.keys()) slots.get(id).primary = code.includes(id);
  }
  const rankedRaw = Array.isArray(view.ranked) ? view.ranked : Array.isArray(score.ranked) ? score.ranked : [];
  const ranked = [];
  for (const item of rankedRaw) {
    const id = aliasId(LOVE_ALIAS, item);
    if (id && !ranked.includes(id)) ranked.push(id);
  }
  const rest = LOVES.map((item) => item.id)
    .filter((id) => !ranked.includes(id))
    .sort((a, b) => (slots.get(b).score ?? -1) - (slots.get(a).score ?? -1) || a.localeCompare(b));
  const order = ranked.concat(rest);
  const languages = order.map((id) => slots.get(id));
  const primaries = languages.filter((item) => item.primary);
  const headline = text(result.headline) || (primaries.length ? primaries.map((item) => item.name).join(" 与 ") : "");
  const summary = text(result.summary);
  return {
    scaleName: text(safe.assessmentName) || LOVES_SCALE,
    headline,
    summary: summary && summary !== headline ? summary : "",
    languages,
    tied: primaries.length > 1 || (Array.isArray(result.flags) && result.flags.includes("tied")),
    empty: languages.every((item) => item.score == null),
    notes: freshLines(proseLines(safe), [headline, summary, LOVES_NOTICE]),
    nickname: text(safe.nickname),
    completedAt: safe.completedAt,
    version: versionText(safe.assessmentVersion),
  };
}

function loveRows(model) {
  return model.languages.map((slot) => `
    <li>
      <div class="love-row">
        <span>${esc(slot.name)}${slot.primary ? "<em>主爱语</em>" : ""}</span>
        <span class="sefs-score">${esc(showScore(slot.score))} <small>/ ${esc(showScore(slot.max))}</small></span>
      </div>
      <div class="love-track" aria-hidden="true"><div class="love-fill" style="width:${barWidth(slot).toFixed(1)}%"></div></div>
    </li>
  `).join("");
}

function loveArticles(model) {
  return model.languages.map((slot) => `
    <article>
      <h2>${esc(slot.name)} <span>${esc(slot.english)}</span></h2>
      <p>${esc(slot.narrative || slot.meaning)}</p>
      <p class="love-how">可以这样表达：${esc(slot.how)}</p>
    </article>
  `).join("");
}

export function renderLoves5Report(report) {
  const model = readLoves5(report);
  const notes = model.notes.length
    ? `<section class="love-notes">${model.notes.map((line) => `<p>${esc(line)}</p>`).join("")}</section>`
    : "";
  const tie = model.tied ? `<p class="love-tie">两种语言同分，都算主爱语。</p>` : "";
  return `
    <div class="loves-map">
      <p class="sub">${esc(model.scaleName)}</p>
      ${personLine(model.nickname)}
      <h1 class="sefs-name">${esc(model.headline || model.scaleName)}</h1>
      ${tie}
      ${model.summary ? `<p class="lead">${esc(model.summary)}</p>` : ""}
      ${model.empty ? `<p class="state">这份结果里没有可显示的五种语言分数。</p>` : ""}
      <ul class="love-scores">${loveRows(model)}</ul>
      <section class="love-detail">${loveArticles(model)}</section>
      ${notes}
      <p class="sefs-notice">${esc(LOVES_NOTICE)}</p>
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </div>
  `;
}

function jyId(value) {
  return aliasId(JUYING_ALIAS, value);
}

function juyingItemScore(value) {
  if (typeof value === "boolean") return null;
  const n = finiteNum(value);
  if (n == null || !Number.isInteger(n) || n < 0 || n > 5) return null;
  return n;
}

function juyingAnswerList(report, view, score) {
  const extension = asObj(report && report.extensionData) || {};
  const lists = [view.answers, extension.answers, score.answers];
  for (const list of lists) {
    if (!Array.isArray(list) || list.length !== 20) continue;
    const values = list.map(juyingItemScore);
    if (values.every((value) => value != null)) return values;
  }
  return null;
}

function juyingRowsFromAnswers(answers) {
  const rows = [];
  let cursor = 0;
  for (const group of JUYING_GROUPS) {
    for (const item of group.items) {
      const value = answers[cursor];
      cursor += 1;
      const degree = JUYING_DEGREES.find((entry) => entry.value === value);
      rows.push({
        group: group.name,
        n: String(item.n),
        text: item.text,
        score: value,
        label: degree ? degree.label : "",
      });
    }
  }
  return rows;
}

function readJuying(report) {
  const safe = report || {};
  const slots = new Map(JUYING_ORDER.map((item) => [item.id, { ...item, score: null }]));
  const view = viewModelOf(safe);
  const score = calcOf(safe);
  const result = asObj(safe.result) || {};
  for (const bag of [score, view]) {
    for (const item of JUYING_ORDER) {
      const value = finiteNum(bag[item.id]);
      if (value != null) slots.get(item.id).score = value;
    }
  }
  const dims = Array.isArray(safe.dimensions) ? safe.dimensions : [];
  for (const dim of dims) {
    if (!dim || typeof dim !== "object") continue;
    const id = jyId(dim.id) || jyId(dim.name);
    if (!id) continue;
    const value = finiteNum(dim.score);
    if (value != null) slots.get(id).score = value;
    const max = finiteNum(dim.max);
    if (max != null && max > 0) slots.get(id).max = max;
  }
  const bandObj = asObj(view.band) || asObj(score.band) || {};
  const code = text(result.code) || text(bandObj.id) || text(view.bandId) || text(score.bandId);
  const bandFromCode = JUYING_BANDS[code] || "";
  const band = text(result.label) || text(bandObj.name) || bandFromCode || "";
  const bandId = JUYING_BAND_COPY.some((item) => item.id === code)
    ? code
    : (JUYING_BAND_COPY.find((item) => item.name === band)?.id || "");
  const markedList = Array.isArray(view.marked) ? view.marked : Array.isArray(score.marked) ? score.marked : null;
  let markedKnown = Array.isArray(markedList);
  const marked = [];
  for (const item of markedList || []) {
    if (!item || typeof item !== "object") continue;
    const body = text(item.text) || text(item.name);
    if (!body) continue;
    marked.push({
      group: text(item.group) || text(item.groupName),
      n: item.n == null ? "" : String(item.n),
      text: body,
      score: finiteNum(item.score),
      label: text(item.label),
    });
  }
  const rowLists = [view.rows, score.rows, view.items, score.items].filter(Array.isArray);
  const itemRows = [];
  for (const list of rowLists) {
    list.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const body = text(item.text) || text(item.name);
      if (!body) return;
      itemRows.push({
        group: text(item.group) || text(item.groupName) || text(item.groupId),
        n: item.n == null ? "" : String(item.n),
        text: body,
        score: finiteNum(item.score),
        label: text(item.label),
      });
    });
    if (itemRows.length) break;
  }
  if (!itemRows.length) {
    const answers = juyingAnswerList(safe, view, score);
    if (answers) {
      itemRows.push(...juyingRowsFromAnswers(answers));
      if (!markedKnown) {
        markedKnown = true;
        for (const row of itemRows) {
          if (row.score >= 4) marked.push({ ...row });
        }
      }
    }
  }
  const side = text(view.side) || text(score.side) || "";
  const summary = text(result.summary);
  const rows = JUYING_ORDER.map((item) => slots.get(item.id));
  return {
    scaleName: text(safe.assessmentName) || JUYING_SCALE,
    headline: text(result.headline) || (band ? `${band}${rows[0].score != null ? ` · ${showScore(rows[0].score)} 分` : ""}` : ""),
    band,
    bandId,
    markedKnown,
    side: side && side !== summary ? side : "",
    summary: summary && summary !== text(result.headline) ? summary : "",
    rows,
    marked,
    itemRows,
    empty: rows.every((item) => item.score == null),
    notes: freshLines(proseLines(safe), [text(result.headline), summary, side, JUYING_NOTICE, JUYING_DISCLAIMER]),
    nickname: text(safe.nickname),
    completedAt: safe.completedAt,
    version: versionText(safe.assessmentVersion),
  };
}

function jyScoreSpan(slot) {
  return `${esc(showScore(slot.score))} <small>/ ${esc(showScore(slot.max))}</small>`;
}

function jyMarked(model) {
  if (model.marked.length) {
    return `<ul class="high">${model.marked.map((row) => `
      <li>
        <strong>${esc([row.group, row.n].filter(Boolean).join(" "))}</strong>
        <span>${esc(row.text)}</span>
        ${row.score == null ? "" : `<em>${esc(showScore(row.score))}${row.label ? ` · ${esc(row.label)}` : ""}</em>`}
      </li>
    `).join("")}</ul>`;
  }
  if (model.markedKnown) {
    return "<p>没有单项达到 4 分。分数是很多「不太像」「有一点像」「有些像」加出来的，不是集中在某几项上。分档仍然按总分，不按某一项。</p>";
  }
  return "";
}

function jyLedger(model) {
  if (!model.itemRows.length) return "";
  const groups = JUYING_GROUPS.map((group) => {
    const rows = model.itemRows.filter((row) => row.group === group.id || row.group === group.name);
    if (!rows.length) return "";
    const known = model.rows.find((item) => item.id === group.id);
    return `
      <section class="ledger-group">
        <h3>${esc(group.name)} <span>${known && known.score != null ? jyScoreSpan(known) : ""}</span></h3>
        <ol>${rows.map((row) => `
          <li class="${row.score != null && row.score >= 4 ? "hot" : ""}">
            <strong>${esc(row.n)}</strong>
            <span>${esc(row.text)}</span>
            <em>${row.score == null ? "" : esc(showScore(row.score))}${row.label ? ` · ${esc(row.label)}` : ""}</em>
          </li>
        `).join("")}</ol>
      </section>
    `;
  }).join("");
  if (!groups.trim()) return "";
  return `<h2>逐项分数</h2><p class="about">0 到 5 都列在这里。4 分和 5 分用深色标出。</p>${groups}`;
}

export function renderJuyingReport(report) {
  const model = readJuying(report);
  const total = model.rows.find((item) => item.id === "total");
  const mind = model.rows.find((item) => item.id === "mind");
  const act = model.rows.find((item) => item.id === "act");
  const bandName = model.band || "总分";
  const title = total && total.score != null
    ? `${esc(showScore(total.score))}<span> 分 · ${esc(bandName)}</span>`
    : esc(model.headline || bandName || model.scaleName);
  const average = total && total.score != null ? (Math.round((total.score / 20) * 100) / 100) : null;
  const zones = [40, 19, 21, 20];
  const ruler = total && total.score != null ? `
    <div class="ruler" role="img" aria-label="总分 ${esc(showScore(total.score))}，${esc(bandName)}">
      <div class="track">
        ${JUYING_BAND_COPY.map((band, index) => `<span class="zone ${band.id === model.bandId ? "on" : ""}" style="flex:${zones[index]}"></span>`).join("")}
        <i class="needle" style="--p:${Math.max(0, Math.min(100, total.score))}"></i>
      </div>
      <div class="ticks" aria-hidden="true">
        <span style="left:0">0</span>
        <span style="left:40%">40</span>
        <span style="left:59%">59</span>
        <span style="left:80%">80</span>
        <span class="end">100</span>
      </div>
    </div>
  ` : "";
  const cuts = JUYING_BAND_COPY.map((band) => `
    <div class="${band.id === model.bandId ? "on" : ""}">
      <dt>${esc(band.range)}</dt>
      <dd>${esc(band.name)}${band.id === model.bandId ? " · 你在这里" : ""}</dd>
    </div>
  `).join("");
  const jumps = JUYING_BAND_COPY.map((band) => `<a href="#band-${band.id}" class="${band.id === model.bandId ? "on" : ""}">${esc(band.name)}</a>`).join("");
  const bands = JUYING_BAND_COPY.map((band) => {
    const yours = band.id === model.bandId;
    return `
      <section class="band${yours ? " on" : ""}" id="band-${band.id}">
        ${yours && total && total.score != null ? `<p class="you">你在这一档 · 总分 ${esc(showScore(total.score))}</p>` : ""}
        <h3>${esc(band.name)}</h3>
        <p class="range">${esc(band.range)} · ${esc(band.source)}</p>
        ${band.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}
      </section>
    `;
  }).join("");
  const notes = model.notes.length
    ? `<section class="jy-notes">${model.notes.map((line) => `<p>${esc(line)}</p>`).join("")}</section>`
    : "";
  const spread = !model.empty
    ? `<p>心理特征 ${esc(showScore(mind.score))} 分，满分 50。行为特征 ${esc(showScore(act.score))} 分，满分 50。${model.side ? esc(model.side) : ""}</p>
       <p class="sub">心理特征 ${jyScoreSpan(mind)}。行为特征 ${jyScoreSpan(act)}。分档名称不是诊断。</p>`
    : "";
  return `
    <div class="jy-map">
      <p class="sub">${esc(model.scaleName)}</p>
      ${personLine(model.nickname)}
      <h1>${title}</h1>
      ${model.empty ? `<p class="state">这份结果里没有可显示的分数。</p>` : ""}
      ${average == null ? "" : `<p class="lead">20 项平均 ${esc(String(average))} 分。0 是一点也不像，2 是有一点像，3 是有些像，4 是很像，5 是与我一样。</p>`}
      ${ruler}
      <p class="fine">${esc(JUYING_DISCLAIMER)}</p>
      ${spread ? `<h2>你的答卷怎么分布</h2>${spread}` : ""}
      ${model.summary ? `<p class="lead">${esc(model.summary)}</p>` : ""}
      ${model.marked.length || model.markedKnown ? `<h2>打到 4 分和 5 分的项</h2><p>4 分是很像，5 分是与我一样。读分档时对着这几条看，它们比总分更具体。</p>${jyMarked(model)}` : ""}
      <h2 id="ref">分值参考</h2>
      ${JUYING_REFERENCE_INTRO.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}
      <dl class="cuts">${cuts}</dl>
      <p class="jumps">写开在下面：${jumps}</p>
      ${bands}
      ${jyLedger(model)}
      ${notes}
      <p class="sefs-notice">${esc(JUYING_NOTICE)}</p>
      <p class="fine">${esc(JUYING_DISCLAIMER)} 不是诊断。分数只和这 20 项有关，不和其他测评相加。</p>
      <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
    </div>
  `;
}

export function renderHollandReport(report) {
  const safe = report && typeof report === "object" ? report : {};
  const html = renderHollandMap({ ...safe, nickname: visibleNickname(safe.nickname) });
  return html.replace(/<h2 class="r-title">([\s\S]*?)<\/h2>/, "<h1 class=\"r-title\">$1</h1>");
}

export function renderReport(report) {
  if (report && report.assessmentId === "star") return renderStarReport(report);
  if (report && report.assessmentId === "sefs") return renderSefsReport(report);
  if (report && report.assessmentId === "scl90") return renderScl90Report(report);
  if (report && report.assessmentId === "pdq4") return renderPdq4Report(report);
  if (report && report.assessmentId === "ecr") return renderEcrReport(report);
  if (report && report.assessmentId === "root") return renderRootReport(report);
  if (report && report.assessmentId === "loves5") return renderLoves5Report(report);
  if (report && report.assessmentId === "juying") return renderJuyingReport(report);
  if (report && report.assessmentId === "holland") return renderHollandReport(report);
  if (report && report.assessmentId === "zhenai") return renderZhenaiReport(report);
  if (report && report.assessmentId === "gcd") return renderGcdReport(report);
  if (report && report.assessmentId === "sensmap") return renderSensmapReport(report);
  if (report && isKnownReader(report.assessmentId) && String(report.assessmentId).startsWith("beattie-")) return renderBeattieReport(report);
  return `<p class="state">这份报告的阅读页还没接上。${esc(report && report.assessmentName || "")}</p>`;
}

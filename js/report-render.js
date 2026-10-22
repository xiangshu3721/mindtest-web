function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
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

export function renderStarReport(report) {
  const drive = report.reportContent?.viewModel?.driveOrder || report.dimensions?.find((item) => item.id === "drive")?.labels || [];
  const pursue = report.reportContent?.viewModel?.pursueOrder || report.dimensions?.find((item) => item.id === "pursue")?.labels || [];
  const notes = []
    .concat(report.interpretation || [], report.recommendations || [])
    .map((item) => item && item.text)
    .filter(Boolean);
  return `
    <p class="read-note">这是同一份结果的阅读页。词的顺序和交卷时一样，这里不能改。</p>
    <figure class="plate">
      <svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
        <polygon class="up" points="50,8 86.4,71 13.6,71" />
        <polygon class="down" points="50,92 13.6,29 86.4,29" />
      </svg>
      <figcaption>职业六芒星</figcaption>
    </figure>
    <section class="roster">
      <div>
        <h2 class="drive-name">底层动力</h2>
        <ol>${words(drive)}</ol>
      </div>
      <div>
        <h2 class="pursue-name">现实追求</h2>
        <ol>${words(pursue)}</ol>
      </div>
    </section>
    <ul class="notes">${notes.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>
    <p class="meta">${esc(report.nickname)} · ${esc(when(report.completedAt))} · ${esc(report.assessmentVersion)}</p>
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
    <article class="sefs-dim">
      <div class="sefs-dim-head">
        <h3>${esc(slot.name)}</h3>
        <p class="sefs-score">${esc(showNum(slot.score))} <small>/ ${esc(showNum(slot.max))}</small></p>
      </div>
      <div class="sefs-track"><div class="sefs-fill" style="width:${barWidth(slot).toFixed(1)}%;background:${slot.color}"></div></div>
      <p class="sefs-dim-meta"><span>${esc(slot.brief)}</span><span>${esc(levelText(slot))}</span></p>
    </article>
  `).join("");
  const totalBlock = model.total == null
    ? `<p class="state">这份结果里没有可显示的分数。</p>`
    : `<section class="sefs-total">
        <p class="sefs-total-num"><strong>${esc(showNum(model.total))}</strong><span> / ${esc(showNum(model.maxTotal))}</span></p>
        <p class="sefs-total-label">四个维度总计</p>
        ${model.totalLine ? `<p>${esc(model.totalLine)}</p>` : ""}
      </section>`;
  return `
    <p class="read-note">这是同一份结果的阅读页。分数和交卷时一样，这里不能改。</p>
    <h2 class="sefs-name">${esc(model.name)}</h2>
    <p class="sefs-kicker">你的主观体验地图。这些数字只是一次观察，不能定义完整的你。</p>
    ${totalBlock}
    <h2 class="sefs-section">四个维度，四种体验</h2>
    ${radar ? `<figure class="plate">${radar}</figure>` : ""}
    <section class="sefs-dims">${cards}</section>
    <section class="sefs-insight">
      <p class="sefs-tag">${esc(model.tag)}</p>
      ${model.lead ? `<h3>${esc(model.lead)}</h3>` : ""}
      ${model.summary ? `<p>${esc(model.summary)}</p>` : ""}
      ${model.paragraphs.map(paragraphHtml).join("")}
      ${model.order ? `<p class="sefs-order">${esc(model.order)}</p>` : ""}
    </section>
    ${model.notice ? `<p class="sefs-notice">${esc(model.notice)}</p>` : ""}
    <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
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
  if (model.total.present) items.push(["总分", showCount(model.total.value)]);
  if (model.positiveCount.present) items.push(["阳性项目", showCount(model.positiveCount.value)]);
  if (model.negativeCount.present) items.push(["阴性项目", showCount(model.negativeCount.value)]);
  if (model.positiveMean.present) items.push(["阳性症状均分", model.positiveMean.value == null ? "—" : fixed2(model.positiveMean.value)]);
  if (!items.length) return "";
  return `<section class="scl-stats">${items.map(([label, value]) => `
    <div class="scl-stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>
  `).join("")}</section>`;
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
    return `
      <article class="sefs-dim">
        <div class="sefs-dim-head">
          <h3>${esc(slot.name)}</h3>
          <p class="sefs-score${scoreClass}">${esc(fixed2(slot.score))} <small>/ ${esc(showCount(slot.max))}</small></p>
        </div>
        <div class="sefs-track" aria-hidden="true"><div class="sefs-fill${fillClass}" style="width:${sclBar(slot).toFixed(1)}%"></div></div>
        ${metaLeft || metaRight ? `<p class="sefs-dim-meta"><span>${esc(metaLeft)}</span><span>${esc(metaRight)}</span></p>` : ""}
        ${foot ? `<p class="scl-foot">${esc(foot)}</p>` : ""}
        ${slot.narrative ? `<p class="scl-narrative">${esc(slot.narrative)}</p>` : ""}
      </article>
    `;
  }).join("");
}

export function renderScl90Report(report) {
  const model = readScl90(report || {});
  const crisis = model.crisis
    ? `<aside class="scl-crisis ${model.crisis.level === "note" ? "scl-crisis-note" : "scl-crisis-hot"}" role="${model.crisis.level === "note" ? "note" : "alert"}">
        <strong>${esc(model.crisis.title)}</strong>
        <p>${esc(model.crisis.text)}</p>
      </aside>`
    : "";
  const rush = model.rushed
    ? `<p class="scl-rush"><strong>作答偏快。</strong>超过一半的题目间隔不到 1.5 秒。下面的分数仍然按作答计算，但可能没有反映最近一周的实际感觉。</p>`
    : "";
  const verdict = model.verdictTitle
    ? `<p class="scl-tag${model.verdictTitle.includes("阳性") ? " scl-tag-pos" : ""}">${esc(model.verdictTitle)}</p>`
    : "";
  const hero = model.gsi.present
    ? `<section class="sefs-total">
        <p class="sefs-total-num"><strong>${esc(fixed2(model.gsi.value))}</strong></p>
        <p class="sefs-total-label">总症状指数${model.gsiLabel ? ` · ${esc(model.gsiLabel)}` : ""}</p>
      </section>`
    : "";
  const rules = model.rules.length
    ? `<ul class="scl-rules">${model.rules.map((rule) => `
        <li><span class="scl-pill${rule.hit ? " scl-pill-hit" : ""}">${rule.hit ? "超过" : "未超过"}</span><span><strong>${esc(rule.label)}</strong>${rule.detail ? `<br />${esc(rule.detail)}` : ""}</span></li>
      `).join("")}</ul>`
    : "";
  const guidance = model.guidance.length
    ? `<section class="sefs-insight"><h2 class="sefs-section">怎么看下一步</h2><ul class="scl-guidance">${model.guidance.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></section>`
    : "";
  const extra = model.interpretation.concat(model.leftover);
  const extraHtml = extra.length
    ? `<section class="sefs-insight">${extra.map((line) => `<p>${esc(line)}</p>`).join("")}</section>`
    : "";
  let notable = "";
  if (model.notable) {
    notable = model.notable.length
      ? `<details class="scl-ledger"><summary>偏重和严重的条目（${model.notable.length}）</summary><ul class="scl-symptoms">${model.notable.map((item) => `
          <li><b>${item.n == null ? "" : esc(String(item.n).padStart(2, "0"))}</b><span>${esc(item.text)}</span><span>${esc(optionWord(item.score))}</span></li>
        `).join("")}</ul></details>`
      : `<p class="scl-sub">没有题目达到偏重或严重。</p>`;
  }
  const seenLead = new Set();
  const takeLead = (lines) => lines.filter(Boolean).filter((line) => {
    if (seenLead.has(line)) return false;
    seenLead.add(line);
    return true;
  });
  const before = takeLead([model.headline, model.verdictText]);
  const after = takeLead([model.gsiText, model.above, model.norms]);
  return `
    <p class="read-note">这是同一份结果的阅读页。分数和交卷时一样，这里不能改。</p>
    <h2 class="sefs-name">${esc(model.name)}</h2>
    <p class="sefs-kicker">最近一周的感受筛查。筛查不是诊断。</p>
    ${model.who ? `<p class="scl-who">${esc(model.who)}</p>` : ""}
    ${crisis}
    ${rush}
    ${verdict}
    ${before.map((line) => `<p class="scl-lead">${esc(line)}</p>`).join("")}
    ${model.youth ? `<p class="scl-sub">${esc(model.youth)}</p>` : ""}
    ${model.empty ? `<p class="state">这份结果里没有可显示的分数。</p>` : ""}
    ${hero}
    ${sclStats(model)}
    ${after.map((line) => `<p class="scl-lead">${esc(line)}</p>`).join("")}
    ${rules}
    <h2 class="sefs-section">十个方面</h2>
    <p class="scl-scale">横条左端 1 分，右端 5 分。2 分及以下为无明显症状，其后到 3 分为轻度，到 4 分为中度，再高为重度。</p>
    <section class="sefs-dims">${sclFactors(model.factors)}</section>
    ${guidance}
    ${extraHtml}
    ${notable}
    ${model.notice ? `<p class="sefs-notice">${esc(model.notice)}</p>` : ""}
    <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
  `;
}

export function renderReport(report) {
  if (report && report.assessmentId === "star") return renderStarReport(report);
  if (report && report.assessmentId === "sefs") return renderSefsReport(report);
  if (report && report.assessmentId === "scl90") return renderScl90Report(report);
  return `<p class="state">这份报告的阅读页还没接上。${esc(report && report.assessmentName || "")}</p>`;
}

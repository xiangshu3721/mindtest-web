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

// SEFS 阅读约定：不按 24 题重算。维度顺序与 my-react-app sefs/data.js 一致。
// id：breadth、contain、belong、agency。
// 分数优先 reportContent.viewModel，其次 dimensions，再次 extensionData.score（现网 calc()）。
// 洞察优先 viewModel.insight，其次 interpretation / recommendations；都没有时用现网展示句。
const SEFS_NOTICE = "本量表为所提供 SEFS 草案的 H5 测试版。题目、分段及类型解释尚未在此提供可核验的信效度、常模或临床验证信息。分数、主导方向和复合关注均是草案规则下的描述，不可用于确诊、排除疾病、决定治疗或判断安全风险。若困扰持续、影响生活，或测评引起明显不适，建议与合格的心理健康专业人员讨论；如有立即危险，请联系当地急救或危机支持服务。";
const SEFS_TAG = "探索性分析 · 非病理诊断";
const SEFS_IDS = [
  ["breadth", "breadth-of-experience", "range", "guangdu", "experience-breadth", "exp-breadth"],
  ["contain", "containment", "capacity", "holding", "rongna", "experience-contain", "exp-contain"],
  ["belong", "belonging", "ownership", "guishu", "experience-belong", "exp-belong"],
  ["agency", "autonomy", "self-direction", "zizhu", "experience-agency", "exp-agency"],
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
    const level = text(raw.level) || text(raw.levelLabel);
    if (level) slot.level = level;
    const brief = text(raw.narrative) || text(raw.brief);
    if (brief) slot.brief = brief;
    const type = text(raw.type) || text(raw.extra && raw.extra.type);
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
    .map((item) => ({ title: text(item.title), text: text(item.text) }));
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
  const leaders = readLeaders(report, slots);
  const complex = readComplex(report, slots);
  const insight = insightOf(report);
  const blocks = storedBlocks(report);
  const summary = text(report.result && report.result.summary) || text(viewModel.summary)
    || (total != null || summed != null ? `总分 ${showNum(total != null ? total : summed)} 分。它是四个体验维度的简单相加，不设未经验证的总体严重程度阈值。` : "");
  let paragraphs = [];
  let order = "";
  let lead = "";
  if (insight) {
    lead = insight.lead || text(report.result && report.result.headline) || leadLine(slots, leaders);
    paragraphs = insight.paragraphs;
    order = insight.order;
  } else if (blocks.length) {
    lead = text(report.result && report.result.headline);
    if (lead && blocks[0].text === lead) lead = "";
    paragraphs = blocks;
  } else if (slots.some((slot) => slot.score != null)) {
    lead = text(report.result && report.result.headline) || leadLine(slots, leaders);
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
  const narrative = [summary, lead, order].concat(paragraphs.map((item) => `${item.title}${item.text}`));
  const disclaimer = insight && insight.disclaimer;
  const notice = disclaimer || (narrative.join("\n").includes("可核验的信效度") ? "" : SEFS_NOTICE);
  return {
    name: text(report.assessmentName) || "SEFS 主观体验功能状态量表",
    total: total != null ? total : summed,
    maxTotal: num(viewModel.maxTotal) || 96,
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
  const totalBlock = model.total == null && !model.summary
    ? `<p class="state">这份结果里没有可显示的分数。</p>`
    : `<section class="sefs-total">
        ${model.total == null ? "" : `<p class="sefs-total-num"><strong>${esc(showNum(model.total))}</strong><span> / ${esc(showNum(model.maxTotal))}</span></p><p class="sefs-total-label">四个维度总计</p>`}
        ${model.summary ? `<p>${esc(model.summary)}</p>` : ""}
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
      ${model.paragraphs.map(paragraphHtml).join("")}
      ${model.order ? `<p class="sefs-order">${esc(model.order)}</p>` : ""}
    </section>
    ${model.notice ? `<p class="sefs-notice">${esc(model.notice)}</p>` : ""}
    <p class="meta">${esc(model.nickname)} · ${esc(when(model.completedAt))} · ${esc(model.version)}</p>
  `;
}

export function renderReport(report) {
  if (report && report.assessmentId === "star") return renderStarReport(report);
  if (report && report.assessmentId === "sefs") return renderSefsReport(report);
  return `<p class="state">这份报告的阅读页还没接上。${esc(report && report.assessmentName || "")}</p>`;
}

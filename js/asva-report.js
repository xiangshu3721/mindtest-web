/** 珍爱金字塔、个人充电、六套情绪测试、高敏感心力地图的阅读页。
 * 只重绘已保存的 viewModel，不重算分数。不放重测、导出、分享、打卡和自述。
 */

const ZHENAI_ORDER = ["A", "B", "C", "D", "E", "F"];
const ZHENAI_LEVEL_COLOR = {
  stable: "#8DB1A9",
  usable: "#BBD0C3",
  repair: "#E2C08D",
  care: "#D89B7D",
};
const ZHENAI_LEVELS = [
  { id: "care", name: "优先照顾层" },
  { id: "repair", name: "提醒修复层" },
  { id: "usable", name: "可用成长层" },
  { id: "stable", name: "稳定资源层" },
];
const GCD_BANDS = [
  { key: "low", label: "严重亏电" },
  { key: "drain", label: "持续耗电" },
  { key: "recover", label: "恢复充电" },
  { key: "full", label: "稳定丰盈" },
];
const GCD_BAND_COLOR = {
  low: "#a8553f",
  drain: "#c4803a",
  recover: "#4a7c64",
  full: "#2f5d4a",
};
const SENSMAP_DIMS = ["F", "R", "E", "M"];
const SENSMAP_QUESTIONS = [
  "F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08",
  "R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08",
  "E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08",
  "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08",
];
const RADAR_CAPTION = "分数越高，代表你在这个领域报告的困扰越多。";

export const ASVA_READER_IDS = [
  "zhenai",
  "gcd",
  "sensmap",
  "beattie-emotional-health",
  "beattie-anger",
  "beattie-fear",
  "beattie-drama",
  "beattie-guilt",
  "beattie-grief",
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asObj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function viewOf(report) {
  const content = asObj(report && report.reportContent);
  return asObj(content.viewModel);
}

function nick(report) {
  const name = text(report && report.nickname);
  return name || "我";
}

function personLine(report) {
  return `<p class="share-person"><span class="share-nick">${esc(nick(report))}</span></p>`;
}

function showNum(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(n) : "—";
}

function pct(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
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

function meta(report) {
  return `<p class="meta">${esc(nick(report))} · ${esc(when(report && report.completedAt))} · ${esc(text(report && report.assessmentVersion))}</p>`;
}

function paras(list, boldFirst) {
  return (Array.isArray(list) ? list : []).map((line, index) => {
    const body = esc(line);
    return `<p>${boldFirst && index === 0 ? `<b>${body}</b>` : body}</p>`;
  }).join("");
}

function footerNote(report) {
  const list = Array.isArray(report && report.recommendations) ? report.recommendations : [];
  const hit = list.find((item) => item && item.id === "footer" && text(item.text) && !item.text.includes("阅读页若尚未重绘"));
  return hit ? `<p class="footnote">${esc(hit.text)}</p>` : "";
}

function zhenaiRadar(scores, lowest, highest, names) {
  const cx = 200;
  const cy = 172;
  const radius = 100;
  const ang = (index) => ((-90 + index * 60) * Math.PI) / 180;
  const pt = (index, value) => [
    cx + Math.cos(ang(index)) * radius * (pct(value) / 100),
    cy + Math.sin(ang(index)) * radius * (pct(value) / 100),
  ];
  const round = (n) => Math.round(n * 10) / 10;
  let body = "";
  for (const level of [20, 40, 60, 80, 100]) {
    const points = ZHENAI_ORDER.map((_, index) => pt(index, level).map(round).join(",")).join(" ");
    const guide = level === 60;
    body += `<polygon points="${points}" fill="none" stroke="${guide ? "#B79B6E" : "#CFC3AA"}" stroke-width="${guide ? 1.1 : 0.8}" ${guide ? 'stroke-dasharray="3 3"' : ""}/>`;
  }
  ZHENAI_ORDER.forEach((_, index) => {
    const [x, y] = pt(index, 100);
    body += `<line x1="${cx}" y1="${cy}" x2="${round(x)}" y2="${round(y)}" stroke="#D8CDB6" stroke-width="0.8"/>`;
  });
  const poly = ZHENAI_ORDER.map((key, index) => pt(index, scores[key]).map(round).join(",")).join(" ");
  body += `<polygon points="${poly}" fill="rgba(93,122,120,0.28)" stroke="#4F6F6C" stroke-width="2" stroke-linejoin="round"/>`;
  ZHENAI_ORDER.forEach((key, index) => {
    const [x, y] = pt(index, scores[key]);
    const low = key === lowest;
    const high = key === highest;
    const color = low ? "#A8432F" : high ? "#3F6B66" : "#4F6F6C";
    body += `<circle cx="${round(x)}" cy="${round(y)}" r="${low || high ? 5.5 : 3.5}" fill="${low || high ? color : "#FBF8F0"}" stroke="${color}" stroke-width="2"/>`;
    const lx = cx + Math.cos(ang(index)) * (radius + 16);
    const ly = cy + Math.sin(ang(index)) * (radius + 16);
    const cos = Math.cos(ang(index));
    const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
    const dy = Math.sin(ang(index)) < -0.5 ? -14 : Math.sin(ang(index)) > 0.5 ? 6 : -6;
    const score = showNum(scores[key]);
    body += `<text x="${round(lx)}" y="${round(ly + dy)}" text-anchor="${anchor}" font-size="13" fill="#2A2521">${esc(names[key] || key)}</text>`;
    body += `<text x="${round(lx)}" y="${round(ly + dy + 15)}" text-anchor="${anchor}" font-size="12" fill="${low ? "#A8432F" : "#6A5F55"}">${esc(score)}${low ? " · 漏" : ""}</text>`;
  });
  return `<svg viewBox="0 0 400 350" role="img" aria-label="六维雷达图">${body}</svg>`;
}

function zhenaiBars(dims, lowest) {
  const byKey = new Map((dims || []).map((item) => [item.key, item]));
  const rows = [...ZHENAI_ORDER].reverse().map((key, index) => {
    const item = byKey.get(key) || { key, name: key, score: null, levelId: "" };
    const width = 46 + index * 9;
    const fill = pct(item.score);
    const color = ZHENAI_LEVEL_COLOR[item.levelId] || "#C9BBA6";
    const leak = key === lowest;
    return `<div class="za-layer" style="width:${width}%">
      <span>${esc(item.name)}${leak ? " · 漏" : ""}</span>
      <i><b style="width:${fill}%;background:${color}"></b></i>
      <em>${esc(showNum(item.score))}</em>
    </div>`;
  }).join("");
  const legend = ZHENAI_LEVELS.map((level) => `<span><i style="background:${ZHENAI_LEVEL_COLOR[level.id]}"></i>${esc(level.name)}</span>`).join("");
  return `<div class="za-pyr">${rows}</div><div class="za-legend">${legend}</div>`;
}

export function renderZhenaiReport(report) {
  const safe = report || {};
  const view = viewOf(safe);
  const result = asObj(safe.result);
  const dims = Array.isArray(view.dims) ? view.dims : [];
  const scores = asObj(view.scores);
  const hasScores = ZHENAI_ORDER.some((key) => Number.isFinite(Number(scores[key])));
  const names = Object.fromEntries(ZHENAI_ORDER.map((key) => {
    const hit = dims.find((item) => item && item.key === key);
    const raw = text(hit && hit.name).replace(/ · 漏$/, "");
    return [key, raw || key];
  }));
  const lowest = text(view.lowest) || text(result.code);
  const highest = text(view.highest);
  const totalLevel = asObj(view.totalLevel);
  const resource = asObj(view.resource);
  const leak = asObj(view.leak);
  const recommendation = asObj(view.recommendation);
  const practice = asObj(view.practice);
  const cards = Array.isArray(view.relationCards) ? view.relationCards : [];
  const headline = text(result.headline) || (lowest && names[lowest] ? `最薄的一层是「${names[lowest]}」` : "珍爱金字塔");
  return `
    <div class="za-map">
      <p class="kicker"><span class="seal" aria-hidden="true">爱</span>你的珍爱金字塔</p>
      ${personLine(safe)}
      <h1>${esc(headline)}</h1>
      ${text(view.opening) ? `<p class="opening">${esc(view.opening)}</p>` : ""}
      ${Number.isFinite(Number(view.total)) ? `<p class="total-chip">加权总分（参考）<b>${esc(showNum(view.total))}</b> · ${esc(totalLevel.name || "")}　<span>仅作参考，请更多看分项与短板</span></p>` : ""}
      ${hasScores ? "" : `<p class="state">这份结果里没有可显示的六维分数。</p>`}
      <section>
        <h2>珍爱金字塔</h2>
        <p class="cap">每一层填得越满，说明那一层越稳；带红“漏”字的是最薄的一层。阅读页用分层色条代替可旋转的立体图。</p>
        ${zhenaiBars(dims.length ? dims : ZHENAI_ORDER.map((key) => ({ key, name: names[key], score: scores[key], levelId: asObj(view.levels)[key] && asObj(view.levels)[key].id })), lowest)}
      </section>
      <section>
        <h2>六个维度的轮廓</h2>
        <p class="cap">虚线是 60 分参考线。红点是漏能量层，深绿点是你的资源。</p>
        <div class="chart">${hasScores ? zhenaiRadar(scores, lowest, highest, names) : ""}</div>
      </section>
      <section>
        <h2>你的资源 · 你的漏能量层</h2>
        ${text(resource.title) ? `<div class="card good"><h3>${esc(resource.title)} ${text(resource.tag) ? `<span class="tag">${esc(resource.tag)}</span>` : ""}</h3>${paras(resource.paras)}</div>` : ""}
        ${text(leak.title) ? `<div class="card leak"><h3>${esc(leak.title)} ${text(leak.tag) ? `<span class="tag">${esc(leak.tag)}</span>` : ""}</h3>${paras(leak.paras)}</div>` : ""}
      </section>
      <section>
        <h2>它们之间的关联</h2>
        ${cards.map((item) => `<div class="rel"><h3>${esc(item && item.title)}</h3><p>${esc(item && item.body)}</p></div>`).join("")}
      </section>
      <section>
        <h2>接下来怎么做</h2>
        ${text(recommendation.title) ? `<div class="card"><h3>${esc(recommendation.title)} ${text(recommendation.tag) ? `<span class="tag">${esc(recommendation.tag)}</span>` : ""}</h3>${paras(recommendation.paras, recommendation.boldFirst)}</div>` : ""}
        ${text(practice.sentence) ? `<div class="card"><h3>${esc(practice.title || "7天自我练习")}</h3><p>${esc(practice.intro)}</p><p class="practice">${esc(practice.sentence)}</p><p>${esc(practice.how)}</p></div>` : ""}
      </section>
      <section>
        <h2>六个维度明细</h2>
        <ul class="dimlist">${dims.map((item) => `<li><div class="dimrow"><b>${esc(item.name)}</b><span>${esc(showNum(item.score))} 分 · ${esc(item.levelName || "")}</span></div><div class="dimbar" aria-hidden="true"><i style="width:${pct(item.score)}%;background:${ZHENAI_LEVEL_COLOR[item.levelId] || "#C9BBA6"}"></i></div><small>${esc(item.sub || "")}　${esc(item.desc || "")}</small></li>`).join("")}</ul>
      </section>
      ${footerNote(safe)}
      ${meta(safe)}
    </div>
  `;
}

function gcdRadar(dims, metaRows) {
  const short = { body: "身体", emotion: "情绪", relation: "关系", world: "世界" };
  const order = (Array.isArray(metaRows) && metaRows.length ? metaRows : [
    { key: "body" },
    { key: "emotion" },
    { key: "relation" },
    { key: "world" },
  ]).slice(0, 4).map((dim) => ({ key: dim.key, name: short[dim.key] || dim.name || dim.key }));
  const cx = 150;
  const cy = 120;
  const rad = 82;
  const ang = [-90, 0, 90, 180];
  const pts = [];
  let axes = "";
  let labels = "";
  order.forEach((dim, index) => {
    const a = ang[index] * Math.PI / 180;
    const value = pct(dims[dim.key]) / 100;
    pts.push(`${(cx + Math.cos(a) * rad * Math.max(value, 0.04)).toFixed(1)},${(cy + Math.sin(a) * rad * Math.max(value, 0.04)).toFixed(1)}`);
    axes += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * rad).toFixed(1)}" y2="${(cy + Math.sin(a) * rad).toFixed(1)}" stroke="#d9d1b6"/>`;
    const lx = cx + Math.cos(a) * (rad + 22);
    const ly = cy + Math.sin(a) * (rad + 22) + 4;
    const anchor = index === 1 ? "start" : index === 3 ? "end" : "middle";
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="13" fill="#25362e">${esc(dim.name)} ${esc(showNum(dims[dim.key]))}</text>`;
  });
  const rings = [0.33, 0.66, 1].map((scale) => {
    const points = ang.map((deg) => {
      const a = deg * Math.PI / 180;
      return `${(cx + Math.cos(a) * rad * scale).toFixed(1)},${(cy + Math.sin(a) * rad * scale).toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${points}" fill="none" stroke="#e2dac2"/>`;
  }).join("");
  return `<svg class="radar" viewBox="0 0 300 240" role="img" aria-label="四维耗电地图">${rings}${axes}<polygon points="${pts.join(" ")}" fill="#c9a050" fill-opacity=".35" stroke="#b8862f" stroke-width="2"/>${labels}</svg>`;
}

export function renderGcdReport(report) {
  const safe = report || {};
  const view = viewOf(safe);
  const band = asObj(view.band);
  const dims = asObj(view.dims);
  const dimMeta = Array.isArray(view.dimMeta) ? view.dimMeta : [];
  const chain = Array.isArray(view.chain) ? view.chain : [];
  const active = chain.find((item) => item && item.on) || null;
  const insight = asObj(view.insight);
  const actions = Array.isArray(view.actions) ? view.actions : [];
  const steps = Array.isArray(view.steps) ? view.steps : [];
  const fields = Array.isArray(view.fields) ? view.fields : [];
  const trainings = Array.isArray(view.trainings) ? view.trainings : [];
  const labels = Array.isArray(view.sourceLabels) ? view.sourceLabels : [];
  const score = Number(view.score);
  const hasScore = Number.isFinite(score);
  const color = GCD_BAND_COLOR[band.key] || "#2f5d4a";
  const fill = pct(score);
  const minutes = actions.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
  const battery = hasScore ? `<svg viewBox="0 0 200 96" role="img" aria-label="今日电量 ${esc(showNum(score))} 分"><rect x="3" y="8" width="182" height="80" rx="20" fill="#fffdf6" stroke="#2f5d4a" stroke-width="3"/><rect x="188" y="34" width="9" height="28" rx="4" fill="#2f5d4a"/><rect x="9" y="14" width="${(fill * 1.7).toFixed(1)}" height="68" rx="15" fill="${color}" opacity=".28"/></svg>` : "";
  const bands = GCD_BANDS.map((item) => `<div class="${item.key === band.key ? "on" : ""}">${esc(item.label)}</div>`).join("");
  return `
    <div class="gcd-map">
      ${personLine(safe)}
      <h1>今天的电量</h1>
      ${hasScore ? "" : `<p class="state">这份结果里没有可显示的电量。</p>`}
      <section class="card hero">
        <div class="battery">${battery}<div class="num">${esc(showNum(score))}<small>/ 100</small></div></div>
        ${text(band.label) ? `<span class="pill ${esc(band.key)}">${esc(band.label)}</span>` : ""}
        <div class="bands" aria-hidden="true">${bands}</div>
        ${text(band.tagline) ? `<p class="tagline">${esc(band.tagline)}</p>` : ""}
        ${text(view.stateLine) ? `<p class="you-said">${esc(view.stateLine)}</p>` : ""}
      </section>
      <section class="card">
        <h2>四维耗电地图</h2>
        <p class="hint">数字越大，这一块漏得越多。</p>
        ${gcdRadar(dims, dimMeta)}
        ${dimMeta.map((dim) => `<div class="dim-row"><b>${esc(dim.name)}${dim.key === view.topDim && labels.length ? `<span class="top-tag">漏得最多</span>` : ""}</b><div class="bar" role="img" aria-label="${esc(dim.name)} ${esc(showNum(dims[dim.key]))}"><i style="width:${pct(dims[dim.key])}%"></i></div><em>${esc(showNum(dims[dim.key]))} · ${esc(asObj(view.dimLevels)[dim.key] || "")}</em></div><p class="dim-desc">${esc(dim.desc)}</p>`).join("")}
        ${labels.length ? `<div class="src-tags">${labels.map((label) => `<span class="tag">${esc(label)}</span>`).join("")}</div>` : ""}
      </section>
      <section class="card">
        <h2>耗电链路：你现在落在哪一环</h2>
        <p class="hint">${esc(chain.map((item) => item.name).filter(Boolean).join(" → "))}</p>
        <div class="chain">${chain.map((item, index) => `<div class="node${item.on ? " on" : ""}"><div class="dot">${index + 1}</div>${esc(item.name)}</div>`).join("")}</div>
        <div class="chain-text">${active ? `<p>${esc(active.now)}</p><p>${esc(active.next)}</p><p class="cut">${esc(active.cut)}</p>` : "<p>今天你的电没有明显落在耗电链路上，不用硬找问题，保持节奏就好。</p>"}</div>
      </section>
      <section class="card">
        <h2>今日洞察</h2>
        ${text(insight.band) ? `<p>${esc(insight.band)}</p>` : ""}
        ${text(insight.dim) ? `<p>${esc(insight.dim)}</p>` : ""}
        ${text(insight.check) ? `<p class="check">${esc(insight.check)}</p>` : ""}
        ${text(insight.shift) ? `<p>${esc(insight.shift)}</p>` : ""}
        ${text(insight.disclaimer) ? `<p class="disc">${esc(insight.disclaimer)}</p>` : ""}
      </section>
      <section class="card">
        <h2>今天的 3 分钟修复</h2>
        <p class="hint">不用全做。挑一个现在就能做的，做完就算赢。${view.low ? "你今天电量很低，只留了最轻的几个。" : ""}</p>
        ${steps.length ? `<div class="steps">${steps.map((step) => `<div class="${step.on ? "on" : ""}"><b>第 ${esc(step.n)} 步</b>${esc(step.name)}</div>`).join("")}</div>` : ""}
        ${actions.length ? `<h3>马上能做的 ${actions.length} 个小动作</h3><p class="hint">合起来大约 ${esc(String(minutes))} 分钟，一个一个来也行。</p>` : ""}
        ${actions.map((item, index) => `<article class="item"><h3><span>${index + 1}</span>${esc(item.title)}</h3><p class="badges">约 ${esc(showNum(item.minutes))} 分钟 · 第 ${esc(showNum(item.step))} 步 · ${esc(item.stepName || "")} · 充电来源 · ${esc(item.srcName || "")}</p><ol>${(item.how || []).map((line) => `<li>${esc(line)}</li>`).join("")}</ol><p class="why">为什么：${esc(item.why)}</p></article>`).join("")}
      </section>
      <section class="card">
        <h2>今天适合去的「好场」</h2>
        ${fields.map((item) => `<article class="item"><h3>${esc(item.title)}</h3><p class="why">${esc(item.why)}</p><p>怎么用：${esc(item.use)}</p></article>`).join("")}
        ${text(view.fieldAvoid) ? `<p class="disc">${esc(view.fieldAvoid)}</p>` : ""}
      </section>
      <section class="card">
        <h2>关系小训练</h2>
        ${trainings.map((item) => `<article class="item"><h3>${esc(item.title)}</h3><p class="why">什么时候用：${esc(item.when)}</p><ol>${(item.steps || []).map((line) => `<li>${esc(line)}</li>`).join("")}</ol><p class="say">可以这样说：${esc(item.say)}</p></article>`).join("")}
      </section>
      ${text(view.coreLine) ? `<p class="core">${esc(view.coreLine)}</p>` : ""}
      ${meta(safe)}
    </div>
  `;
}

function beattieDiagram(sections, total, maxPossible) {
  const rows = [
    { label: "评估", value: sections.assessment, max: 100 },
    { label: "选择", value: sections.mcq, max: 50 },
    { label: "判断", value: sections.tf, max: 80 },
  ];
  const bars = rows.map((row) => {
    const value = Number(row.value);
    const width = Number.isFinite(value) && row.max > 0 ? pct((value / row.max) * 100) : 0;
    return `<div class="bar-row"><div class="bar-label"><span>${row.label}</span><span>${esc(showNum(row.value))} / ${row.max}</span></div><div class="bar-track" role="img" aria-label="${row.label} ${esc(showNum(row.value))} 分，满分 ${row.max}"><span style="width:${width}%"></span></div></div>`;
  }).join("");
  const r = 46;
  const c = 2 * Math.PI * r;
  const ratio = maxPossible > 0 && Number.isFinite(Number(total)) ? Math.max(0, Math.min(1, Number(total) / maxPossible)) : 0;
  const ring = `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="总分 ${esc(showNum(total))}，满分 ${esc(showNum(maxPossible))}"><circle class="ring-track" cx="60" cy="60" r="${r}" fill="none"></circle><circle class="ring-value" cx="60" cy="60" r="${r}" fill="none" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - ratio)).toFixed(2)}" transform="rotate(-90 60 60)"></circle><text class="ring-num" x="60" y="58" text-anchor="middle">${esc(showNum(total))}</text><text class="ring-sub" x="60" y="76" text-anchor="middle">满分 ${esc(showNum(maxPossible))}</text></svg>`;
  return `<div class="score-diagram">${ring}<div class="bars">${bars}</div></div>`;
}

export function renderBeattieReport(report) {
  const safe = report || {};
  const view = viewOf(safe);
  const insight = asObj(view.insight);
  const band = asObj(view.band);
  const sections = asObj(view.sections);
  const title = text(view.title) || text(safe.assessmentName) || "情绪测试";
  const tone = text(insight.tone) || "gold";
  const means = Array.isArray(insight.means) ? insight.means : [];
  const actions = Array.isArray(insight.actions) ? insight.actions : [];
  const hasScore = Number.isFinite(Number(view.total));
  const lamp = text(insight.lamp);
  return `
    <div class="bt-map tone-${esc(tone)}">
      <section class="card">
        ${view.chapter ? `<p class="kicker">第 ${esc(view.chapter)} 章 · 学习解读</p>` : ""}
        <h1>${esc(nick(safe))}的${esc(title)}</h1>
        ${text(view.theme) ? `<p class="theme">${esc(view.theme)}</p>` : ""}
        ${text(view.studyNote) ? `<p class="study-note">${esc(view.studyNote)}</p>` : ""}
        <h2>状态一眼看懂</h2>
        ${hasScore ? "" : `<p class="state">这份结果里没有可显示的总分。</p>`}
        ${lamp ? `<div class="status-hero"><div class="lamp" aria-hidden="true"></div><div><div class="lamp-name">${esc(lamp)} <span>${esc(showNum(insight.min))}–${esc(showNum(insight.max))}</span></div><p class="headline">${esc(insight.headline)}</p><p class="score-line">总分 <strong>${esc(showNum(view.total))}</strong> / ${esc(showNum(view.maxPossible))}</p></div></div>` : (hasScore ? `<p class="headline">总分 ${esc(showNum(view.total))} / ${esc(showNum(view.maxPossible))}。</p>` : "")}
        <h2>分数结构图</h2>
        ${beattieDiagram(sections, view.total, view.maxPossible)}
        <h2>这意味着什么</h2>
        ${means.length ? `<ul class="points">${means.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : "<p>这一分数没有对上书中的分数段。</p>"}
        <h2>你可以怎么做</h2>
        ${actions.length ? `<ol class="actions">${actions.map((line) => `<li><span>${esc(line)}</span></li>`).join("")}</ol>` : ""}
        ${text(view.dramaNote) ? `<aside class="grief-remind"><strong>先看悲痛</strong><p>${esc(view.dramaNote)}</p></aside>` : ""}
        ${text(band.text) ? `<details class="book-band"><summary>书中原话 <span>${esc(showNum(band.min))}–${esc(showNum(band.max))}</span></summary><p>${esc(band.text)}</p></details>` : ""}
      </section>
      ${meta(safe)}
    </div>
  `;
}

function questionRefs(ids) {
  const list = Array.isArray(ids) ? ids : [];
  if (!list.length) return "";
  const labels = list.map((id) => {
    const index = SENSMAP_QUESTIONS.indexOf(id);
    return index >= 0 ? `第 ${index + 1} 题` : String(id);
  });
  return `参考 ${labels.join("、")}`;
}

function sensmapRadar(dimensions) {
  const byId = Object.fromEntries((dimensions || []).map((item) => [item.id, item]));
  const size = 320;
  const center = size / 2;
  const radius = 112;
  const axes = [
    { id: "F", angle: -90 },
    { id: "R", angle: 0 },
    { id: "E", angle: 90 },
    { id: "M", angle: 180 },
  ];
  const xy = (angle, distance) => {
    const rad = (angle * Math.PI) / 180;
    return `${(center + Math.cos(rad) * distance).toFixed(1)} ${(center + Math.sin(rad) * distance).toFixed(1)}`;
  };
  const ring = (level) => axes.map((axis) => xy(axis.angle, radius * level)).join(" ");
  const valuePoints = axes.map((axis) => xy(axis.angle, radius * (pct(byId[axis.id] && byId[axis.id].score) / 100))).join(" ");
  const marks = {
    F: "top",
    R: "right",
    E: "bottom",
    M: "left",
  };
  const labels = axes.map((axis) => {
    const item = byId[axis.id] || {};
    return `<div class="radar-label ${marks[axis.id]}"><span>${esc(item.name || axis.id)}</span><strong>${esc(showNum(item.score))}</strong></div>`;
  }).join("");
  return `<figure class="radar-layout">${labels}<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="四维雷达图">${[0.25, 0.5, 0.75, 1].map((level) => `<polygon points="${ring(level)}" fill="none" stroke="#e5d9cc"/>`).join("")}${axes.map((axis) => {
    const [x, y] = xy(axis.angle, radius).split(" ");
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="#d9cbbd"/>`;
  }).join("")}<polygon points="${valuePoints}" fill="rgba(141,70,54,.22)" stroke="#8d4636" stroke-width="2"/>${axes.map((axis) => {
    const [x, y] = xy(axis.angle, radius * (pct(byId[axis.id] && byId[axis.id].score) / 100)).split(" ");
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="#8d4636"/>`;
  }).join("")}</svg></figure>`;
}

function openSensmapDim(dimensions) {
  const ranked = (dimensions || [])
    .filter((item) => Number.isFinite(Number(item && item.score)))
    .sort((a, b) => Number(b.score) - Number(a.score) || SENSMAP_DIMS.indexOf(a.id) - SENSMAP_DIMS.indexOf(b.id));
  return (ranked[0] && ranked[0].id) || "F";
}

export function renderSensmapReport(report) {
  const safe = report || {};
  const view = viewOf(safe);
  const dimensions = Array.isArray(view.dimensions) ? view.dimensions : [];
  const patterns = Array.isArray(view.patterns) ? view.patterns : [];
  const clue = asObj(view.clue);
  const topic = asObj(view.topic);
  const opened = openSensmapDim(dimensions);
  const title = `${nick(safe)}的心力地图`;
  return `
    <div class="sm-map">
      <p class="kicker">${esc(text(view.productName) || "高敏感心力地图")}</p>
      <h1>${esc(title)}</h1>
      ${text(view.summary) ? `<p class="lead">${esc(view.summary)}</p>` : `<p class="state">这份结果里没有可显示的摘要。</p>`}
      ${text(view.helpNotice) ? `<p class="help-note">${esc(view.helpNotice)}</p>` : ""}
      <section>
        ${sensmapRadar(dimensions)}
        <p class="cap">${esc(RADAR_CAPTION)}</p>
      </section>
      <section>
        <h2>逐项看懂我的心力地图</h2>
        ${text(topic.closeNote) ? `<p>${esc(topic.closeNote)}</p>` : ""}
        ${dimensions.map((dim) => {
          const subs = Array.isArray(dim.subs) ? dim.subs : [];
          const highlights = Array.isArray(dim.highlights) ? dim.highlights : [];
          return `<details class="dim"${dim.id === opened ? " open" : ""}>
            <summary><strong>${esc(dim.name)}</strong><small>${esc(dim.summaryLine || "")}</small></summary>
            <div class="dim-body">
              <p class="score-line">${dim.deterministic ? `<b>${esc(showNum(dim.score))}</b> <span>${esc(dim.band || "")}</span>` : "<span>有效作答不足，不输出确定性解释</span>"}</p>
              <ul class="sub-bars">${subs.map((sub) => `<li><div><span>${esc(sub.name)}</span><b>${esc(showNum(sub.score))}</b></div><i><s style="width:${pct(sub.score)}%"></s></i></li>`).join("")}</ul>
              <h3>哪些回答支持这个结果</h3>
              ${highlights.length ? `<ul class="evidence">${Number(dim.score) <= 24 ? `<li class="quiet">只有个别题目较高，不把整维说成持续困扰。</li>` : ""}${highlights.map((item) => `<li>「${esc(item.text)}」你的回答是「${esc(item.answerLabel)}」。<small>${esc(questionRefs(item.questionIds || (item.questionId ? [item.questionId] : [])))}</small></li>`).join("")}</ul>` : "<p>这部分没有出现特别集中的信号。</p>"}
              <h3>日常表现</h3><p>${esc(dim.daily)}</p>
              <h3>另一种可能</h3><p>${esc(dim.alternative)}</p>
              <h3>可以试的一步</h3><p>${esc(dim.step)}</p>
              <h3>什么时候适合找人聊聊</h3><p>${esc(dim.human)}</p>
              ${text(dim.helpNote) ? `<p class="help-note">${esc(dim.helpNote)}</p>` : ""}
            </div>
          </details>`;
        }).join("")}
      </section>
      <section>
        <h2>个人模式画像</h2>
        <p class="cap">这里最多显示两条较明显的模式，再加一条需要你自己核对的线索。</p>
        ${patterns.length ? "" : "<p>目前没有足够集中的题目可以确认主要模式。</p>"}
        ${patterns.map((pattern) => `<article class="pattern"><h3>${esc(pattern.name)}</h3><ol class="chain">${(pattern.nodes || []).map((node) => `<li class="${esc(node.mode || "")}"><b>${esc(node.label)}</b><span>${esc(node.text)}</span><small>${node.mode === "ask" ? "还需要你自己核对" : esc(questionRefs(node.questionIds))}</small></li>`).join("")}</ol></article>`).join("")}
        ${text(clue.title) ? `<aside class="clue"><b>${esc(clue.title)}</b><p>${esc(clue.text)}</p></aside>` : ""}
      </section>
      <section>
        <h2>首要课题与下一步</h2>
        ${topic.showBoth && text(topic.companionText) ? `<p>${esc(topic.companionText)}</p>` : ""}
        <div class="topic-card">
          <p class="cap">首要课题</p>
          <h3>${esc(topic.primaryName || "")}<small>${esc(topic.primaryDimName || "")}</small></h3>
          ${text(topic.secondaryName) ? `<p>次要关注：${esc(topic.secondaryName)}${text(topic.secondaryReason) ? `。${esc(topic.secondaryReason)}` : ""}</p>` : ""}
          ${text(topic.action) ? `<p>可以试的一步：${esc(topic.action)}</p>` : ""}
        </div>
        <h3>为什么先看这里</h3>
        <ul class="basis">${(Array.isArray(topic.basis) ? topic.basis : []).map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
      </section>
      ${text(view.boundary) ? `<p class="disc">${esc(view.boundary)}</p>` : ""}
      <p class="cap">题库 ${esc(view.questionBankVersion || "")} · 规则 ${esc(view.ruleVersion || "")}</p>
      ${Array.isArray(view.anomalies) && view.anomalies.length ? `<p class="cap">记录的异常：${esc(view.anomalies.join("；"))}</p>` : ""}
      ${meta(safe)}
    </div>
  `;
}

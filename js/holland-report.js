/* 霍兰德分享页：与 holland-explore 结果页同一套 DOM。
 * 分数、holland_code、structure、bands、ranking、quality 只用云端已存字段，不按 60 题重算。
 * 长图文案来自同源静态模块。开放题只有存档里真有才显示。 */
import { HOLLAND_CONTENT as C } from "./holland-content.js";

const DIMS = ["R", "I", "A", "S", "E", "C"];
const NAVY = "#1f2d5c";
const RED = "#b8262b";
const COLORS = {
  R: { bg: "#ece6f6", ink: "#6b5aa6" },
  I: { bg: "#e2eff8", ink: "#2f6f9a" },
  A: { bg: "#fbe8d8", ink: "#bd6528" },
  S: { bg: "#f8e1e4", ink: "#b34d61" },
  E: { bg: "#e2f0e3", ink: "#3d8653" },
  C: { bg: "#eef2d6", ink: "#77872a" },
};
const ICONS = {
  R: "M3 11.5h18v8H3z M3 11.5l2.2-3.5h13.6l2.2 3.5 M9 8V5.5h6V8 M7.5 14.5v2 M16.5 14.5v2 M3 15.5h18",
  I: "M9.5 3.5l4 2-3.2 6.2-4-2z M12 8.6l2.2 1.1 M8.3 11.6L6.8 14.6 M5 20.5h14 M7.5 17.5h6 M14.6 11.4a5 5 0 0 1 .4 9.1",
  A: "M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.7-.7 1.7-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.9a4.8 4.8 0 0 0 4.8-4.8c0-3.8-4-6.8-9-6.8z M7.6 11.6h.01 M9.6 7.8h.01 M14.2 7.6h.01 M17 10.6h.01",
  S: "M14.5 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z M7.5 19.5v-1.5a4.5 4.5 0 0 1 9 0v1.5 M20 9.8a2 2 0 1 1-4 0 2 2 0 1 1 4 0z M21 18.5v-1a3.2 3.2 0 0 0-3-3.2 M8 9.8a2 2 0 1 1-4 0 2 2 0 1 1 4 0z M3 18.5v-1a3.2 3.2 0 0 1 3-3.2",
  E: "M3 8.5h18V19H3z M9 8.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.5 M3 13h18 M11 12v2.2h2V12",
  C: "M6 4.5h12V21H6z M9.5 3h5v3h-5z M8.8 10.2l1.3 1.3 2.3-2.4 M14 10.6h2 M8.8 15.2l1.3 1.3 2.3-2.4 M14 15.6h2",
};
const ALIAS = {
  r: "R", realistic: "R", 实际: "R", 实际型: "R",
  i: "I", investigative: "I", 研究: "I", 研究型: "I",
  a: "A", artistic: "A", 艺术: "A", 艺术型: "A",
  s: "S", social: "S", 社会: "S", 社会型: "S",
  e: "E", enterprising: "E", 企业: "E", 企业型: "E",
  c: "C", conventional: "C", 常规: "C", 常规型: "C",
};
const SCREEN = "这是兴趣探索，不是职业诊断，也不说明哪种类型更好。";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asObj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function finite(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function aliasId(value) {
  const raw = text(value).replace(/\s+/g, "");
  if (!raw) return "";
  return ALIAS[raw] || ALIAS[raw.toLowerCase()] || "";
}

function fill(template, map) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (map[key] != null ? map[key] : ""));
}

function uniq(list) {
  const out = [];
  list.forEach((item) => { if (out.indexOf(item) < 0) out.push(item); });
  return out;
}

function pairKey(a, b) {
  return DIMS.indexOf(a) < DIMS.indexOf(b) ? a + b : b + a;
}

function lab(id) {
  return `${C.dims[id].name} ${id}`;
}

function fmtDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

function viewOf(report) {
  const view = report && report.reportContent && report.reportContent.viewModel;
  return asObj(view) || {};
}

function scoreOf(report) {
  const score = report && report.extensionData && report.extensionData.score;
  return asObj(score) || {};
}

function bagScores(target, bag) {
  const scores = asObj(bag && bag.scores) || asObj(bag);
  if (!scores) return;
  Object.keys(scores).forEach((key) => {
    if (["dominance", "differentiation", "breadth", "consistency", "holland_code", "hollandCode", "version"].includes(key)) return;
    const id = aliasId(key);
    const value = finite(scores[key]);
    if (id && value != null) target[id] = value;
  });
}

function readStored(report) {
  const safe = report || {};
  const view = viewOf(safe);
  const score = scoreOf(safe);
  const result = asObj(safe.result) || {};
  const scores = {};
  bagScores(scores, score);
  bagScores(scores, view);
  const dims = Array.isArray(safe.dimensions) ? safe.dimensions : [];
  dims.forEach((dim) => {
    if (!dim || typeof dim !== "object") return;
    const id = aliasId(dim.id) || aliasId(dim.name);
    const value = finite(dim.score);
    if (id && value != null) scores[id] = value;
  });
  const codeRaw = [result.code, view.holland_code, view.hollandCode, score.holland_code, score.hollandCode, view.code]
    .map((item) => text(item))
    .find(Boolean) || "";
  const code = /^[RIASEC]{3}$/i.test(codeRaw) ? codeRaw.toUpperCase() : "";
  const looseCode = code ? "" : codeRaw;
  const ranking = [];
  const rankSource = Array.isArray(view.ranking) ? view.ranking : Array.isArray(score.ranking) ? score.ranking : code.split("");
  rankSource.forEach((item) => {
    const id = aliasId(item);
    if (id && !ranking.includes(id)) ranking.push(id);
  });
  DIMS.filter((id) => !ranking.includes(id))
    .sort((a, b) => (scores[b] ?? -1) - (scores[a] ?? -1) || a.localeCompare(b))
    .forEach((id) => ranking.push(id));
  const storedTop = Array.isArray(view.top_dimensions) ? view.top_dimensions : Array.isArray(score.top_dimensions) ? score.top_dimensions : null;
  const top = [];
  (storedTop || ranking.slice(0, 3)).forEach((item) => {
    const id = aliasId(item);
    if (id && !top.includes(id)) top.push(id);
  });
  while (top.length < 3 && ranking[top.length]) {
    if (!top.includes(ranking[top.length])) top.push(ranking[top.length]);
    else break;
  }
  const structure = asObj(view.structure) || asObj(score.structure) || {};
  const bands = asObj(view.bands) || asObj(score.bands) || {};
  const quality = [];
  []
    .concat(Array.isArray(view.quality) ? view.quality : [], Array.isArray(score.quality) ? score.quality : [], Array.isArray(result.flags) ? result.flags : [])
    .forEach((item) => {
      const key = text(item);
      if (C.quality[key] && !quality.includes(key)) quality.push(key);
    });
  const exploreRaw = asObj(view.explore) || asObj(safe.extensionData && safe.extensionData.openText) || {};
  const explore = {
    q1: text(exploreRaw.q1),
    q2: Array.isArray(exploreRaw.q2) ? exploreRaw.q2.map((item) => text(item)).filter(Boolean) : [],
    q2other: text(exploreRaw.q2other),
    q3: Array.isArray(exploreRaw.q3) ? exploreRaw.q3.map((item) => text(item)).filter(Boolean) : [],
  };
  const anyScore = DIMS.some((id) => scores[id] != null);
  return {
    nick: text(safe.nickname),
    completedAt: safe.completedAt,
    version: text(safe.assessmentVersion),
    scaleName: text(safe.assessmentName) || C.title,
    headline: text(result.headline),
    label: text(result.label),
    summary: text(result.summary),
    looseCode,
    code,
    scores,
    ranking: ranking.length === 6 ? ranking : DIMS.slice(),
    top: top.length === 3 ? top : [],
    structure,
    bands,
    quality,
    explore,
    empty: !code && !anyScore,
  };
}

function focusSet(q3) {
  const flags = {};
  (q3 || []).forEach((option) => {
    const key = C.focusMap[option];
    if (key) flags[key] = true;
  });
  return flags;
}

function buildSections(stored) {
  const sc = stored.scores;
  const st = stored.structure;
  const B = stored.bands;
  const rank = stored.ranking;
  const top = stored.top;
  const ex = stored.explore;
  const F = focusSet(ex.q3);
  const t1 = top[0];
  const t2 = top[1];
  const t3 = top[2];
  const low = rank[5];
  const sections = [];
  const ready = Boolean(t1 && t2 && t3);

  if (ready) {
    sections.push({
      id: "combo",
      title: C.sec.s1,
      blocks: [
        {
          t: "hero",
          letters: top,
          phrases: top.map((id) => C.dims[id].phrase),
          codeLine: `你的核心兴趣组合：${stored.code || top.join("")}`,
          nameLine: top.map(lab).join(" × "),
          caveat: C.codeCaveat,
        },
        { t: "radar", scores: sc, top },
      ],
    });
    sections.push({
      id: "attract",
      title: C.sec.s2,
      focus: Boolean(F.direction || F.strength),
      blocks: [
        { t: "dimcards", items: top.map((id) => ({ dim: id, title: C.dims[id].attractTitle, text: C.dims[id].attract })) },
        { t: "note", text: "这并不表示其他类型与你无关。" },
      ],
    });
    const interact = {
      id: "interact",
      title: C.sec.s3,
      focus: Boolean(F.self || F.strength),
      blocks: [
        { t: "lines", items: top.map((id) => ({ dim: id, text: `${C.dims[id].interact}。` })) },
        {
          t: "note",
          text: `另外三种方式（${rank.slice(3).map((id) => C.dims[id].interact.replace(/^我通过|与世界发生关系$/g, "")).join("、")}）也在你身上，只是这次没那么突出。`,
        },
      ],
    };
    if (F.strength) {
      interact.blocks.push({
        t: "module",
        title: "把兴趣用起来",
        focus: true,
        blocks: [{
          t: "p",
          text: `你最容易投入的，是需要“${C.dims[t1].phrase}”和“${C.dims[t2].phrase}”的事情。在这样的场合里，你往往更有劲、也更愿意多花心思。可以多找机会，把这两样放进你正在做的事里——兴趣带来的投入，常常会慢慢变成你做得好的地方。`,
        }],
      });
    }
    sections.push(interact);
  }

  const scoredRank = rank.filter((id) => sc[id] != null);
  if (scoredRank.length) {
    sections.push({
      id: "dims",
      title: C.sec.s4,
      focus: Boolean(F.self),
      blocks: [
        { t: "note", text: C.sec.s4note },
        {
          t: "dimcards",
          score: true,
          items: rank.map((id, index) => {
            const value = sc[id];
            const level = value == null ? "" : ((value >= 60 || (index < 3 && value >= 50)) ? "high" : value >= 35 ? "mid" : "low");
            return { dim: id, title: lab(id), score: value, text: level ? C.dims[id][level] : "这次没有送来这个方向的分数。" };
          }),
        },
        { t: "note", text: C.sec.s4tail },
      ],
    });
  }

  if (ready && B.dominance && B.differentiation && B.breadth && st.consistency) {
    const domText = st.near_tie_top12
      ? fill(C.structure.nearTie12, { a: `“${lab(t1)}”`, b: `“${lab(t2)}”`, pa: C.dims[t1].phrase, pb: C.dims[t2].phrase })
      : fill(C.structure.dom[B.dominance] || "", { a: `“${C.dims[t1].name}”`, b: `“${C.dims[t2].name}”` });
    let conText = fill(C.structure.con[st.consistency] || "", { a: `“${C.dims[t1].name}”`, b: `“${C.dims[t2].name}”` });
    if (st.consistency === "CROSS") {
      const extra = C.structure.cross[pairKey(t1, t2)];
      if (extra) conText += extra + C.structure.crossTail;
    }
    const kv = [
      { k: "主次", v: C.structure.domLabel[B.dominance] || "", text: domText },
      { k: "区分度", v: C.structure.difLabel[B.differentiation] || "", text: C.structure.dif[B.differentiation] || "" },
      { k: "一致性", v: C.structure.conLabel[st.consistency] || "", text: conText },
      {
        k: C.structure.breadthLabel,
        v: { ONE: "比较集中", FEW: "有几个中心", MANY: "比较宽" }[B.breadth] || "",
        text: C.structure.breadth[B.breadth] || "",
      },
    ];
    const structure = {
      id: "structure",
      title: C.sec.s5,
      focus: Boolean(F.self),
      blocks: [
        { t: "hex", top, link: [t1, t2], consistency: st.consistency },
        { t: "kv", items: kv },
      ],
    };
    if (st.near_tie_top34) {
      structure.blocks.push({ t: "callout", text: fill(C.structure.nearTie34, { c: `“${lab(t3)}”`, d: `“${lab(rank[3])}”` }) });
    }
    if (sc[t1] != null && sc[t1] < 50) structure.blocks.push({ t: "callout", text: C.structure.lowAll });
    if (F.self) {
      structure.blocks.push({
        t: "module",
        title: C.structure.motiveTitle,
        focus: true,
        blocks: [{ t: "p", text: `推动你的，主要是这几种满足感：${top.map((id) => `“${C.dims[id].attractTitle}”`).join("、")}。当一件事同时碰到其中两种，你可能会格外投入。` }],
      });
      const tension = st.consistency === "CROSS"
        ? fill(C.structure.tensionCross, { a: `“${C.dims[t1].name}”`, b: `“${C.dims[t2].name}”`, pa: `“${C.dims[t1].phrase}”`, pb: `“${C.dims[t2].phrase}”` })
        : st.near_tie_top12
          ? fill(C.structure.tensionNear, { a: `“${C.dims[t1].name}”`, b: `“${C.dims[t2].name}”` })
          : fill(C.structure.tensionGap, { a: `“${C.dims[t1].name}”`, z: `“${C.dims[low].name}”` });
      structure.blocks.push({
        t: "module",
        title: C.structure.tensionTitle,
        focus: true,
        blocks: [{ t: "p", text: tension }],
      });
    }
    sections.push(structure);

    const thrive = uniq(C.dims[t1].thrive.slice(0, 2).concat(C.dims[t2].thrive.slice(0, 2), C.dims[t3].thrive.slice(0, 1)));
    const drain = uniq(C.dims[t1].drain.slice(0, 2).concat(C.dims[t2].drain.slice(0, 1), [C.dims[low].lowDrain]));
    sections.push({
      id: "env",
      title: C.sec.s6,
      focus: Boolean(F.self),
      blocks: [
        { t: "env", a: { title: C.sec.s6a, items: thrive }, b: { title: C.sec.s6b, items: drain } },
        { t: "note", text: C.envNote },
      ],
    });

    const life = {
      id: "life",
      title: C.sec.s7,
      focus: Boolean(F.learn || F.collab),
      blocks: [{
        t: "cards",
        items: [
          { title: C.life.learn, focus: Boolean(F.learn), lines: [C.dims[t1].learn, C.dims[t2].learn] },
          { title: C.life.flow, lines: top.map((id) => C.dims[id].flow) },
          { title: C.life.collab, focus: Boolean(F.collab), lines: (F.collab ? top : [t1, t2]).map((id) => C.dims[id].collab) },
          { title: C.life.daily, lines: [C.dims[t1].daily, C.dims[t2].daily] },
        ],
      }],
    };
    if (F.learn && DIMS.every((id) => sc[id] != null)) {
      const axes = C.learning.axes;
      const tp = sc.I - sc.R > 10 ? "T" : sc.R - sc.I > 10 ? "P" : "B";
      const solo = (sc.I + sc.R) / 2;
      const inter = (sc.S + sc.E) / 2;
      const si = solo - inter > 10 ? "S" : inter - solo > 10 ? "I" : "B";
      const oc = sc.A - sc.C > 10 ? "O" : sc.C - sc.A > 10 ? "C" : "B";
      life.blocks.push({
        t: "module",
        title: C.learning.title,
        focus: true,
        blocks: [{
          t: "kv",
          items: [
            { k: axes.how, v: `${C.dims[t1].name}式`, text: C.dims[t1].learn },
            { k: axes.tp.name, v: { T: "偏理论", P: "偏实践", B: "两边都行" }[tp], text: axes.tp[tp] },
            { k: axes.si.name, v: { S: "偏独学", I: "偏互动", B: "两边都行" }[si], text: axes.si[si] },
            { k: axes.oc.name, v: { O: "偏开放", C: "偏结构", B: "两边都行" }[oc], text: axes.oc[oc] },
          ],
        }],
      });
    }
    sections.push(life);
  } else if (ready) {
    sections.push({
      id: "structure",
      title: C.sec.s5,
      blocks: [{ t: "hex", top, link: [t1, t2], consistency: st.consistency || "" }],
    });
  }

  if (ready) {
    const experience = [{ t: "p", text: C.experience.intro }];
    if (ex.q1) experience.push({ t: "quote", label: C.experience.q1Echo, text: ex.q1, tail: C.experience.q1Tail });
    const q2 = ex.q2.filter((option) => C.experience.q2[option]);
    if (q2.length) {
      experience.push({ t: "list", items: q2.map((option) => fill(C.experience.q2[option], { learn: C.dims[t1].learn })) });
    }
    if (ex.q2other) experience.push({ t: "p", text: `${C.experience.q2OtherPrefix}“${ex.q2other}”。可以想想，它和你的前两个兴趣方向有没有连接点。` });
    experience.push({ t: "h", text: C.experience.smallTitle });
    experience.push({ t: "dimlist", items: top.map((id) => ({ dim: id, text: C.dims[id].exp })) });
    const hobbyDims = F.hobby ? top : [t1, t2];
    experience.push({
      t: "module",
      title: C.experience.hobbyTitle,
      focus: Boolean(F.hobby),
      blocks: [{
        t: "kv",
        items: [
          { k: C.experience.hobbyAct, text: `${uniq(hobbyDims.flatMap((id) => C.dims[id].hobby.act)).join("；")}。` },
          { k: C.experience.hobbyMake, text: `${uniq(hobbyDims.flatMap((id) => C.dims[id].hobby.make)).join("；")}。` },
          { k: C.experience.hobbyTry, text: `${uniq(hobbyDims.flatMap((id) => C.dims[id].hobby.try)).join("；")}。` },
        ],
      }],
    });
    sections.push({ id: "experience", title: C.sec.s8, focus: Boolean(F.direction || F.hobby), blocks: experience });

    const career = C.career;
    const p12 = career.pairs[pairKey(t1, t2)];
    const p13 = career.pairs[pairKey(t1, t3)];
    const careerOpen = Boolean(F.career);
    const section = {
      id: "career",
      title: career.title,
      focus: Boolean(F.career),
      collapsible: true,
      collapsed: !careerOpen,
      blocks: [{ t: "p", text: career.intro }],
      more: [],
    };
    if (!careerOpen) section.blocks.push({ t: "note", text: career.collapsedNote });
    if (p12 && p13) {
      section.more = [
        {
          t: "levels",
          items: [
            { k: career.l1, v: top.map((id) => C.dims[id].phrase).join(" × ") },
            { k: career.l2, chips: uniq(C.dims[t1].career.acts.concat(C.dims[t2].career.acts, C.dims[t3].career.acts.slice(0, 1))) },
            { k: career.l3, chips: uniq(p12.worlds.concat(p13.worlds.slice(0, 2), C.dims[t1].career.worlds.slice(0, 2))).slice(0, 8) },
            { k: career.l4, v: `${C.dims[t1].career.env}；${C.dims[t2].career.env}。` },
            { k: career.l5, chips: uniq(p12.ex.concat(p13.ex.slice(0, 3))).slice(0, 8) },
          ],
        },
        { t: "note", text: career.exampleNote },
      ];
    }
    if (ex.q3.includes("专业选择")) section.more.push({ t: "callout", text: career.major });
    if (ex.q3.includes("转型方向")) section.more.push({ t: "callout", text: career.shift });
    sections.push(section);
  }

  sections.forEach((section, index) => { section.no = index + 1; });
  const focusList = ex.q3.filter((option) => C.focusMap[option]);
  return {
    banner: focusList.length
      ? fill(C.focusBanner, { list: focusList.map((option) => `“${option}”`).join("、") })
      : C.focusNone,
    sections,
  };
}

function pt(index, radius, cx, cy) {
  const angle = (-90 + index * 60) * Math.PI / 180;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function hexDist(i, j) {
  const distance = Math.abs(i - j);
  return Math.min(distance, 6 - distance);
}

function f1(value) {
  return Math.round(value * 10) / 10;
}

function icon(id, color, size) {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size || 22}" height="${size || 22}" fill="none" stroke="${color || "currentColor"}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[id]}"/></svg>`;
}

function relHex(top, link) {
  const cx = 160;
  const cy = 150;
  const radius = 98;
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    for (let j = i + 1; j < 6; j += 1) {
      const a = pt(i, radius, cx, cy);
      const b = pt(j, radius, cx, cy);
      const distance = hexDist(i, j);
      const isLink = link && ((DIMS[i] === link[0] && DIMS[j] === link[1]) || (DIMS[j] === link[0] && DIMS[i] === link[1]));
      body += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${distance === 3 ? RED : NAVY}" stroke-width="${isLink ? 3.2 : distance === 1 ? 1.8 : 1.1}" stroke-opacity="${isLink ? 1 : distance === 1 ? 0.85 : 0.55}"${distance === 2 ? ' stroke-dasharray="7 4 1.5 4"' : distance === 3 ? ' stroke-dasharray="5 4"' : ""}/>`;
    }
  }
  DIMS.forEach((id, index) => {
    const point = pt(index, radius, cx, cy);
    const on = top.indexOf(id) >= 0;
    const label = pt(index, radius + 34, cx, cy);
    body += `<circle cx="${f1(point[0])}" cy="${f1(point[1])}" r="17" fill="${on ? COLORS[id].ink : "#fff"}" stroke="${on ? COLORS[id].ink : NAVY}" stroke-width="1.6"/>`;
    body += `<text x="${f1(point[0])}" y="${f1(point[1] + 5.5)}" text-anchor="middle" font-size="16" font-weight="800" fill="${on ? "#fff" : NAVY}">${id}</text>`;
    body += `<text x="${f1(label[0])}" y="${f1(label[1] + 4)}" text-anchor="middle" font-size="12.5" font-weight="${on ? 700 : 500}" fill="${on ? COLORS[id].ink : "#5d6275"}">${C.dims[id].name}</text>`;
  });
  return `<svg class="rel-hex" viewBox="0 0 320 300" role="img" aria-label="兴趣六边形">${body}</svg><div class="legend"><span><i class="lg solid"></i>相邻</span><span><i class="lg dashdot"></i>隔一位</span><span><i class="lg dash"></i>相对</span></div>`;
}

function radar(scores, top) {
  const cx = 170;
  const cy = 160;
  const radius = 106;
  let body = "";
  [25, 50, 75, 100].forEach((grid) => {
    const points = DIMS.map((_, index) => pt(index, radius * grid / 100, cx, cy).map(f1).join(",")).join(" ");
    body += `<polygon points="${points}" fill="${grid === 100 ? "#fff" : "none"}" stroke="#d9cfbd" stroke-width="1"/>`;
  });
  DIMS.forEach((_, index) => {
    const point = pt(index, radius, cx, cy);
    body += `<line x1="${cx}" y1="${cy}" x2="${f1(point[0])}" y2="${f1(point[1])}" stroke="#e4dccd"/>`;
  });
  const poly = DIMS.map((id, index) => pt(index, radius * Math.max(scores[id] == null ? 2 : scores[id], 2) / 100, cx, cy));
  body += `<polygon points="${poly.map((point) => point.map(f1).join(",")).join(" ")}" fill="rgba(31,45,92,.14)" stroke="${NAVY}" stroke-width="2" stroke-linejoin="round"/>`;
  DIMS.forEach((id, index) => {
    const point = poly[index];
    const on = top.indexOf(id) >= 0;
    const label = pt(index, radius + 30, cx, cy);
    const shown = scores[id] == null ? "—" : String(Math.round(scores[id]));
    body += `<circle cx="${f1(point[0])}" cy="${f1(point[1])}" r="${on ? 4.5 : 3.2}" fill="${on ? RED : NAVY}"/>`;
    body += `<text x="${f1(label[0])}" y="${f1(label[1] - 3)}" text-anchor="middle" font-size="13" font-weight="700" fill="${on ? COLORS[id].ink : NAVY}">${C.dims[id].name} ${id}</text>`;
    body += `<text x="${f1(label[0])}" y="${f1(label[1] + 13)}" text-anchor="middle" font-size="12" fill="#6b6f80">${shown}</text>`;
  });
  return `<svg class="radar" viewBox="0 0 340 320" role="img" aria-label="六维雷达图">${body}</svg>`;
}

function focusTag(on) {
  return on ? `<span class="ftag">${esc(C.focusTag)}</span>` : "";
}

function block(item) {
  switch (item.t) {
    case "p": return `<p class="bp">${esc(item.text)}</p>`;
    case "note": return `<p class="bnote">${esc(item.text)}</p>`;
    case "h": return `<h4 class="bh">${esc(item.text)}</h4>`;
    case "callout": return `<div class="callout">${esc(item.text)}</div>`;
    case "hero":
      return `<div class="hero"><div class="code">${item.letters.map((id, index) => `${index ? '<i class="dot">·</i>' : ""}<b style="color:${COLORS[id].ink}">${id}</b>`).join("")}</div><div class="phr">${item.phrases.map(esc).join(" <i>×</i> ")}</div><div class="codeline">${esc(item.codeLine)}</div><div class="nameline">${esc(item.nameLine)}</div><p class="caveat">${esc(item.caveat)}</p></div>`;
    case "radar": return `<div class="chart">${radar(item.scores, item.top)}</div>`;
    case "hex": return `<div class="chart hexwrap">${relHex(item.top, item.link)}</div>`;
    case "dimcards":
      return `<div class="dimcards">${item.items.map((card) => {
        const color = COLORS[card.dim];
        const score = item.score
          ? `<span class="dc-score">${card.score == null ? "—" : Math.round(card.score)}</span>`
          : `<span class="dc-letter">${esc(C.dims[card.dim].name)} ${card.dim}</span>`;
        const bar = item.score && card.score != null ? `<div class="bar"><i style="width:${Math.max(2, card.score)}%"></i></div>` : "";
        return `<div class="dimcard" style="--bg:${color.bg};--ink:${color.ink}"><div class="dc-head"><span class="dc-ic">${icon(card.dim, color.ink, 22)}</span><span class="dc-title">${esc(card.title)}</span>${score}</div>${bar}<p class="dc-text">${esc(card.text)}</p></div>`;
      }).join("")}</div>`;
    case "lines":
      return `<ul class="lines">${item.items.map((line) => `<li style="--ink:${COLORS[line.dim].ink};--bg:${COLORS[line.dim].bg}"><span class="ln-ic">${icon(line.dim, COLORS[line.dim].ink, 20)}</span><span>${esc(line.text)}</span></li>`).join("")}</ul>`;
    case "dimlist":
      return `<ul class="dimlist">${item.items.map((line) => `<li><span class="dl-dot" style="background:${COLORS[line.dim].ink}"></span><span>${esc(line.text)}</span></li>`).join("")}</ul>`;
    case "list": return `<ul class="blist">${item.items.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>`;
    case "quote": return `<div class="quote"><span class="q-label">${esc(item.label)}</span><blockquote>“${esc(item.text)}”</blockquote><p>${esc(item.tail)}</p></div>`;
    case "kv":
      return `<dl class="kv">${item.items.map((row) => `<div class="kv-row"><dt>${esc(row.k)}${row.v ? `<em>${esc(row.v)}</em>` : ""}</dt><dd>${esc(row.text)}</dd></div>`).join("")}</dl>`;
    case "env":
      return `<div class="env"><div class="env-col good"><h5>${esc(item.a.title)}</h5><ul>${item.a.items.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></div><div class="env-col drain"><h5>${esc(item.b.title)}</h5><ul>${item.b.items.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></div></div>`;
    case "cards":
      return `<div class="lcards">${item.items.map((card) => `<div class="lcard${card.focus ? " is-focus" : ""}"${card.focus ? ' data-focus="1"' : ""}><h5>${esc(card.title)}${focusTag(card.focus)}</h5>${card.lines.map((line) => `<p>${esc(line)}</p>`).join("")}</div>`).join("")}</div>`;
    case "levels":
      return `<ol class="levels">${item.items.map((row, index) => `<li><div class="lv-k"><span class="lv-n">${index + 1}</span>${esc(row.k)}</div><div class="lv-v">${row.chips ? row.chips.map((chip) => `<span class="chip">${esc(chip)}</span>`).join("") : esc(row.v)}</div></li>`).join("")}</ol>`;
    case "module":
      return `<div class="module${item.focus ? " is-focus" : ""}"${item.focus ? ' data-focus="1"' : ""}><h4 class="mod-t">${esc(item.title)}${focusTag(item.focus)}</h4>${item.blocks.map(block).join("")}</div>`;
    default: return "";
  }
}

function section(item) {
  let body = item.blocks.map(block).join("");
  if (item.collapsible) {
    body += `<div class="more"${item.collapsed ? " hidden" : ""}>${(item.more || []).map(block).join("")}</div><button type="button" class="btn-ghost toggle-career" aria-expanded="${!item.collapsed}">${item.collapsed ? C.career.expand : C.career.collapse}</button>`;
  }
  const no = item.no < 10 ? `0${item.no}` : String(item.no);
  return `<section class="rsec${item.focus ? " is-focus" : ""}${item.collapsed ? " is-collapsed" : ""}" id="sec-${item.id}"${item.focus ? ' data-focus="1"' : ""}><h3 class="rsec-t"><span class="no">${no}</span>${esc(item.title)}${focusTag(item.focus)}</h3>${body}</section>`;
}

function reportHtml(stored, built) {
  const when = fmtDate(stored.completedAt);
  const quality = stored.quality.map((key) => C.quality[key]).filter(Boolean);
  return `<header class="r-head"><p class="r-kicker">${esc(C.title)}</p><h2 class="r-title"><span class="r-nick">${esc(stored.nick)}</span><span class="red">的兴趣地图</span></h2>${when ? `<p class="r-date">${esc(when)}</p>` : ""}<div class="pill">✦ ${esc(C.homeTag)} ✦</div><p class="banner">${esc(built.banner)}</p>${quality.length ? `<div class="quality">${quality.map((line) => `<p>${esc(line)}</p>`).join("")}</div>` : ""}</header>${built.sections.map(section).join("")}<footer class="r-foot"><p>${esc(C.footer)}</p></footer>`;
}

function strayLines(stored) {
  const lines = [];
  const push = (value) => {
    const body = text(value);
    if (body && !lines.includes(body)) lines.push(body);
  };
  if (stored.empty) {
    push(stored.headline);
    push(stored.label);
    push(stored.summary);
    push(stored.looseCode);
  }
  return lines;
}

export function renderHollandReport(report) {
  const stored = readStored(report);
  const built = stored.empty ? { banner: C.focusNone, sections: [] } : buildSections(stored);
  const stray = strayLines(stored).map((line) => `<p class="bp">${esc(line)}</p>`).join("");
  const quote = stored.empty && stored.explore.q1
    ? `<div class="quote"><span class="q-label">${esc(C.experience.q1Echo)}</span><blockquote>“${esc(stored.explore.q1)}”</blockquote></div>`
    : "";
  const empty = stored.empty ? `<p class="state">这份结果里没有可显示的兴趣分数。</p><p class="bnote">${esc(SCREEN)}</p>` : "";
  return `<div class="holland-map">${empty}${stray}${quote}${reportHtml(stored, built)}</div>`;
}

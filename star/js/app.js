import { CULL_FIRST, CULL_SECOND, CULL_THIRD, GROUPS, KEEP, REVIVE, WORDS } from "./data.js";

const app = document.querySelector("#app");
const STORAGE = "career-star-v2";
const RK_MAX = 30;
const RK = window.ResultKit;
const WORD_SET = new Set(WORDS);

const DRIVE_SLOTS = [
  { place: "左上", className: "at-ul" },
  { place: "右上", className: "at-ur" },
  { place: "底部", className: "at-bot" },
];

const PURSUE_SLOTS = [
  { place: "顶部", className: "at-top" },
  { place: "左下", className: "at-ll" },
  { place: "右下", className: "at-lr" },
];

const state = {
  step: "cover",
  cull1: [],
  cull2: [],
  cull3: [],
  revived: [],
  driveOrder: [],
  pursueOrder: [],
  pick: null,
  block: "",
  recId: "",
};

let animateStar = false;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function clean(list, max) {
  const out = [];
  for (const id of list || []) {
    if (!WORD_SET.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function sameSet(a, b) {
  if (!a || a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function struckIds() {
  return [...state.cull1, ...state.cull2, ...state.cull3];
}

function keptIds() {
  const gone = new Set(struckIds());
  return WORDS.filter((word) => !gone.has(word));
}

function discardedIds() {
  const gone = new Set(struckIds());
  return WORDS.filter((word) => gone.has(word));
}

function reconcile() {
  state.cull1 = clean(state.cull1, CULL_FIRST);
  const first = new Set(state.cull1);
  state.cull2 = clean(state.cull2, CULL_SECOND).filter((id) => !first.has(id));
  const second = new Set([...first, ...state.cull2]);
  state.cull3 = clean(state.cull3, CULL_THIRD).filter((id) => !second.has(id));
  const gone = new Set(struckIds());
  state.revived = clean(state.revived, REVIVE).filter((id) => gone.has(id));

  const kept = keptIds();
  if (kept.length === KEEP && sameSet(state.driveOrder, kept)) {
    state.driveOrder = state.driveOrder.slice();
  } else if (kept.length === KEEP) {
    state.driveOrder = kept.slice();
  } else {
    state.driveOrder = [];
  }

  if (state.revived.length === REVIVE && sameSet(state.pursueOrder, state.revived)) {
    state.pursueOrder = state.pursueOrder.slice();
  } else if (state.revived.length === REVIVE) {
    state.pursueOrder = state.revived.slice();
  } else {
    state.pursueOrder = [];
  }

  const cull1Done = state.cull1.length === CULL_FIRST;
  const cull2Done = state.cull2.length === CULL_SECOND;
  const keptDone = kept.length === KEEP;
  const revivedDone = state.revived.length === REVIVE;
  if (state.step === "cull2" && !cull1Done) state.step = "cull1";
  if (state.step === "cull3" && !(cull1Done && cull2Done)) state.step = cull1Done ? "cull2" : "cull1";
  if (state.step === "revive" && !(cull1Done && cull2Done && keptDone)) {
    state.step = !cull1Done ? "cull1" : (!cull2Done ? "cull2" : "cull3");
  }
  if (state.step === "result" && !(keptDone && revivedDone)) {
    if (keptDone) state.step = "revive";
    else if (!cull1Done) state.step = "cull1";
    else if (!cull2Done) state.step = "cull2";
    else state.step = "cull3";
  }
  if (!["cover", "cull1", "cull2", "cull3", "revive", "result"].includes(state.step)) state.step = "cover";
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.step = saved.step || "cover";
    state.cull1 = saved.cull1;
    state.cull2 = saved.cull2;
    state.cull3 = saved.cull3;
    state.revived = saved.revived;
    state.driveOrder = saved.driveOrder;
    state.pursueOrder = saved.pursueOrder;
    state.recId = typeof saved.recId === "string" ? saved.recId : "";
  } catch {
    sessionStorage.removeItem(STORAGE);
  }
  reconcile();
}

function save() {
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify({
      step: state.step,
      cull1: state.cull1,
      cull2: state.cull2,
      cull3: state.cull3,
      revived: state.revived,
      driveOrder: state.driveOrder,
      pursueOrder: state.pursueOrder,
      recId: state.recId,
    }));
  } catch {
    /* 这台设备若禁用了会话存储，当次选择仍然有效。 */
  }
}

function starSvg(draw) {
  return `
    <svg class="mark${draw ? " draw" : ""}" viewBox="0 0 100 100" aria-hidden="true">
      <polygon class="up" pathLength="1" points="50,8 86.4,71 13.6,71" />
      <polygon class="down" pathLength="1" points="50,92 13.6,29 86.4,29" />
    </svg>
  `;
}

function shell(inner) {
  return `<main class="frame"><article class="sheet">${inner}</article></main>`;
}

function joinWords(list) {
  return list.map((word) => esc(word)).join("、");
}

function pickWords(list, size) {
  return Array.isArray(list) && list.length === size && list.every((word) => WORD_SET.has(word));
}

function summarize() {
  return {
    headline: `底层动力：${state.driveOrder.join("、")}`,
    sub: `现实追求：${state.pursueOrder.join("、")}`,
    metrics: [],
    notes: [
      `倒三角（底层动力）是划了三轮之后留下的 ${KEEP} 个词，是对你最要紧的。`,
      `正三角（现实追求）是从划掉的词里复活的 ${REVIVE} 个，是你现在想去够的。`,
      "这是一次自我整理，不是打分，也不是职业诊断。",
    ],
  };
}

// 旧版的「做过的六芒星」(career-star-archive-v1) 并入统一历史记录 (rk.v1.star)，只做一次，成功后才删旧数据。
function migrateOldArchive() {
  const OLD = "career-star-archive-v1";
  const KEY = "rk.v1.star";
  try {
    const rawOld = localStorage.getItem(OLD);
    if (!rawOld) return;
    const old = JSON.parse(rawOld);
    if (!Array.isArray(old)) { localStorage.removeItem(OLD); return; }
    const moved = old
      .filter((item) => item && typeof item.id === "string" && pickWords(item.driveOrder, KEEP) && pickWords(item.pursueOrder, REVIVE))
      .map((item) => ({
        id: `m${item.id}`,
        t: Number.isFinite(Number(item.at)) ? Number(item.at) : Date.now(),
        title: "职业六芒星",
        s: {
          headline: `底层动力：${item.driveOrder.join("、")}`,
          sub: `现实追求：${item.pursueOrder.join("、")}`,
          who: "",
          metrics: [],
          notes: [
            `倒三角（底层动力）是划了三轮之后留下的 ${KEEP} 个词，是对你最要紧的。`,
            `正三角（现实追求）是从划掉的词里复活的 ${REVIVE} 个，是你现在想去够的。`,
            "这是一次自我整理，不是打分，也不是职业诊断。",
          ],
        },
      }));
    let current = [];
    const rawNew = localStorage.getItem(KEY);
    if (rawNew) {
      const parsed = JSON.parse(rawNew);
      if (parsed && Array.isArray(parsed.items)) current = parsed.items;
    }
    const have = new Set(current.map((item) => item && item.id));
    const merged = current.concat(moved.filter((item) => !have.has(item.id)))
      .filter((item) => item && typeof item.t === "number")
      .sort((a, b) => b.t - a.t)
      .slice(0, RK_MAX);
    localStorage.setItem(KEY, JSON.stringify({ v: 1, items: merged }));
    const back = JSON.parse(localStorage.getItem(KEY) || "{}");
    const ids = new Set((back && Array.isArray(back.items) ? back.items : []).map((item) => item.id));
    if (merged.every((item) => ids.has(item.id))) localStorage.removeItem(OLD);
  } catch {
    /* 存不下或旧数据坏了：保留旧数据原样，不影响做题和看结果。 */
  }
}

function rememberResult() {
  if (!RK) return;
  if (state.driveOrder.length !== KEEP || state.pursueOrder.length !== REVIVE) return;
  // 在结果页调整顺序后再次保存：替换掉这一次做题的上一条，不重复堆记录
  if (state.recId) RK.remove(state.recId);
  const res = RK.save(summarize());
  state.recId = (res && res.id) || "";
  save();
}

function wordList(words) {
  return words.map((word) => `<li>${esc(word)}</li>`).join("");
}

function hasProgress() {
  return state.cull1.length + state.cull2.length + state.cull3.length + state.revived.length > 0;
}

function renderCover() {
  return shell(`
    <h1 tabindex="-1">职业六芒星</h1>
    <p class="lead">划掉的，是对你没那么重要的。留下的，一轮比一轮更要紧。${WORDS.length} 个词这样划三轮，最后剩下的 ${KEEP} 个最重要。</p>
    <div class="intro">
      <figure class="mini">
        ${starSvg(false)}
        <figcaption>
          <span class="drive-name">倒三角 · 底层动力</span>
          <span class="pursue-name">正三角 · 现实追求</span>
        </figcaption>
      </figure>
      <ol class="steps">
        <li>先划掉 ${CULL_FIRST} 个。这 ${CULL_FIRST} 个相对没那么重要，还剩 ${WORDS.length - CULL_FIRST} 个。</li>
        <li>再划掉 ${CULL_SECOND} 个。留下的 ${WORDS.length - CULL_FIRST - CULL_SECOND} 个，比这一轮划掉的更重要。</li>
        <li>再划掉 ${CULL_THIRD} 个。最后剩下的 ${KEEP} 个最重要，是底层动力，写在倒三角上。</li>
        <li>从划掉的 ${CULL_FIRST + CULL_SECOND + CULL_THIRD} 个里复活 ${REVIVE} 个。这 ${REVIVE} 个是现实追求，写在正三角上。</li>
      </ol>
    </div>
    <div class="actions">
      <button class="primary" type="button" data-action="start">${esc(resumeLabel())}</button>
      ${RK ? RK.historyButton({ className: "ghost" }) : ""}
      ${hasProgress() ? `<button class="ghost" type="button" data-action="retest">重新测试</button>` : ""}
      <a class="ghost" href="../index.html">回到目录</a>
    </div>
    <p class="fine">这是一次自我整理，不是打分，也不是职业诊断。选择留在这台设备上，不会上传。</p>
  `);
}

function columns(pool, mode) {
  const allowed = new Set(pool);
  return GROUPS.map((group) => {
    const words = group.filter((word) => allowed.has(word));
    if (!words.length) return "";
    const buttons = words.map((word) => {
      const struck = mode === "cull1" ? state.cull1 : (mode === "cull2" ? state.cull2 : state.cull3);
      const on = mode === "revive" ? state.revived.includes(word) : struck.includes(word);
      const label = mode === "revive"
        ? (on ? `已复活，${word}。再点一次放回去。` : `${word}。点一下复活。`)
        : (on ? `已划掉，${word}。再点一次收回。` : `${word}。点一下划掉。`);
      const klass = mode === "revive" ? (on ? "back" : "on") : (on ? "on" : "");
      return `<button type="button" class="word ${klass}" data-word="${esc(word)}" aria-pressed="${on}" aria-label="${esc(label)}"><span>${esc(word)}</span></button>`;
    }).join("");
    return `<div class="col">${buttons}</div>`;
  }).join("");
}

function dock(count, total, label, status, action, actionLabel, pendingLabel, ready) {
  return `
    <div class="dock">
      <div>
        <p class="count"><b>${count}</b> <span>/ ${total} ${esc(label)}</span></p>
        <p class="status${state.block ? " warn" : ""}" role="status">${esc(state.block || status)}</p>
      </div>
      <div class="actions">
        <button class="ghost" type="button" data-action="${esc(action.back)}">${esc(action.backLabel)}</button>
        <button class="primary" type="button" data-action="${esc(action.next)}" ${ready ? "" : "disabled"}>${esc(ready ? actionLabel : pendingLabel)}</button>
      </div>
    </div>
  `;
}

function renderCull1() {
  const n = state.cull1.length;
  const left = CULL_FIRST - n;
  const ready = left === 0;
  const status = ready
    ? `还剩 ${WORDS.length - CULL_FIRST} 个，进入下一轮。`
    : `还要再划掉 ${left} 个。`;
  return shell(`
    <header class="bar">
      <h1 tabindex="-1">先划掉 ${CULL_FIRST} 个</h1>
    </header>
    <p class="about">划掉对你没那么重要的。这一轮先拿开 ${CULL_FIRST} 个，留下的会更要紧。点一下画一道，再点一次收回。</p>
    <div class="cols board">${columns(WORDS, "cull1")}</div>
    ${dock(n, CULL_FIRST, "已划掉", status, { back: "cover", backLabel: "回到说明", next: "to-cull2" }, "看剩下的词", `还差 ${left} 个`, ready)}
  `);
}

function renderCull2() {
  const pool = WORDS.filter((word) => !state.cull1.includes(word));
  const n = state.cull2.length;
  const left = CULL_SECOND - n;
  const ready = left === 0;
  const status = ready
    ? `还剩 ${pool.length - CULL_SECOND} 个，比这一轮划掉的更重要。`
    : `还要再划掉 ${left} 个。`;
  return shell(`
    <header class="bar">
      <h1 tabindex="-1">再划掉 ${CULL_SECOND} 个</h1>
    </header>
    <p class="about">上一轮划掉的 ${CULL_FIRST} 个，是相对不重要的，先收着。这里还剩 ${pool.length} 个。再划掉 ${CULL_SECOND} 个没那么要紧的，留下的会更重要。</p>
    <div class="cols board">${columns(pool, "cull2")}</div>
    ${dock(n, CULL_SECOND, "已划掉", status, { back: "to-cull1", backLabel: "返回上一轮", next: "to-cull3" }, `再划掉 ${CULL_THIRD} 个`, `还差 ${left} 个`, ready)}
  `);
}

function renderCull3() {
  const pool = WORDS.filter((word) => !state.cull1.includes(word) && !state.cull2.includes(word));
  const n = state.cull3.length;
  const left = CULL_THIRD - n;
  const ready = left === 0;
  const status = ready
    ? `最后这 ${KEEP} 个最重要，是底层动力。`
    : `还要再划掉 ${left} 个。`;
  return shell(`
    <header class="bar">
      <h1 tabindex="-1">再划掉 ${CULL_THIRD} 个</h1>
    </header>
    <p class="about">还剩 ${pool.length} 个，都比前面划掉的更要紧。再划掉 ${CULL_THIRD} 个。最后留下的 ${KEEP} 个最重要，是底层动力，写在倒三角上。</p>
    <div class="cols board">${columns(pool, "cull3")}</div>
    ${dock(n, CULL_THIRD, "已划掉", status, { back: "to-cull2", backLabel: "返回上一轮", next: "to-revive" }, `去复活 ${REVIVE} 个`, `还差 ${left} 个`, ready)}
  `);
}

function renderRevive() {
  const pool = discardedIds();
  const kept = keptIds();
  const n = state.revived.length;
  const ready = n === REVIVE;
  const status = ready
    ? "三个都捡回来了，可以画星。"
    : `还要再复活 ${REVIVE - n} 个。`;
  const chips = kept.map((word) => `<span class="chip">${esc(word)}</span>`).join("");
  return shell(`
    <header class="bar">
      <h1 tabindex="-1">复活 ${REVIVE} 个</h1>
    </header>
    <p class="about">下面是划掉的 ${pool.length} 个。捡回 ${REVIVE} 个你还是想要的。它们是现实追求，写在正三角上。</p>
    <p class="kept"><b>已经留下的底层动力</b>${chips}</p>
    <div class="cols board revive">${columns(pool, "revive")}</div>
    ${dock(n, REVIVE, "已复活", status, { back: "to-cull3", backLabel: "返回上一轮", next: "to-result" }, "画成六芒星", `还差 ${REVIVE - n} 个`, ready)}
  `);
}

function tagButton(word, role, index, slot) {
  const roleName = role === "drive" ? "底层动力" : "现实追求";
  const picked = state.pick && state.pick.role === role && state.pick.index === index;
  return `
    <button
      type="button"
      class="tag ${role}${picked ? " is-picked" : ""} ${slot.className}"
      data-slot="${role}:${index}"
      aria-pressed="${picked}"
      aria-label="${esc(`${roleName}，${slot.place}，${word}。点一下，再点同一层的另一个词，交换位置。`)}"
    ><span class="ink">${esc(word)}</span></button>
  `;
}

function renderResult() {
  const driveTags = state.driveOrder.map((word, index) => tagButton(word, "drive", index, DRIVE_SLOTS[index])).join("");
  const pursueTags = state.pursueOrder.map((word, index) => tagButton(word, "pursue", index, PURSUE_SLOTS[index])).join("");
  let bar = "";
  if (RK) {
    // 与其他测试同样的按钮条（导出图片 / 历史记录），导出的长图含六芒星图、两组词和说明
    bar = RK.bar(summarize(), { restart: false, export: false })
      .replace('<div class="rk-btns">', '<div class="rk-btns"><button type="button" class="rk-btn primary" data-action="save-image">导出图片</button>');
  } else {
    bar = '<div class="actions"><button class="primary" type="button" data-action="save-image">导出图片</button></div>';
  }
  return shell(`
    <div class="capture">
      <figure class="plate">
        <p class="aside drive">底层动力</p>
        <p class="aside pursue">现实追求</p>
        <div class="sky">
          ${starSvg(animateStar)}
          ${driveTags}
          ${pursueTags}
        </div>
        <h1 class="spine" tabindex="-1">职业六芒星</h1>
      </figure>
      <section class="roster">
        <div>
          <h2 class="drive-name">底层动力</h2>
          <ul>${wordList(state.driveOrder)}</ul>
        </div>
        <div>
          <h2 class="pursue-name">现实追求</h2>
          <ul>${wordList(state.pursueOrder)}</ul>
        </div>
      </section>
    </div>
    ${bar}
    <div class="actions" style="margin-top:22px">
      <button class="ghost" type="button" data-action="retest">重新测试</button>
      <a class="ghost" href="../index.html">回到目录</a>
    </div>
  `);
}

function view() {
  if (state.step === "cull1") return renderCull1();
  if (state.step === "cull2") return renderCull2();
  if (state.step === "cull3") return renderCull3();
  if (state.step === "revive") return renderRevive();
  if (state.step === "result") return renderResult();
  return renderCover();
}

function render({ keepScroll = false, focusWord = "" } = {}) {
  if (RK) RK.guard(["cull1", "cull2", "cull3", "revive"].includes(state.step), () => go("cover"));
  const y = keepScroll ? window.scrollY : 0;
  app.innerHTML = view();
  animateStar = false;
  if (keepScroll) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  if (focusWord) {
    const node = app.querySelector(`[data-word="${CSS.escape(focusWord)}"]`);
    node?.focus();
  } else if (!keepScroll) {
    app.querySelector("h1")?.focus();
  }
}

function go(step, extra = {}) {
  state.step = step;
  state.block = "";
  state.pick = null;
  reconcile();
  animateStar = step === "result";
  if (step === "result") rememberResult();
  save();
  render(extra);
}

function toggleLimited(list, id, max, message) {
  const index = list.indexOf(id);
  if (index >= 0) {
    list.splice(index, 1);
    state.block = "";
    return true;
  }
  if (list.length >= max) {
    state.block = message;
    return false;
  }
  list.push(id);
  state.block = "";
  return true;
}

function onWord(word) {
  if (state.step === "cull1") {
    const added = !state.cull1.includes(word) && state.cull1.length < CULL_FIRST;
    toggleLimited(state.cull1, word, CULL_FIRST, `这一轮只能划掉 ${CULL_FIRST} 个。先点回一个，再划别的。`);
    if (added) {
      state.cull2 = state.cull2.filter((id) => id !== word);
      state.cull3 = state.cull3.filter((id) => id !== word);
      state.revived = state.revived.filter((id) => id !== word);
    }
  } else if (state.step === "cull2") {
    if (state.cull1.includes(word)) return;
    const added = !state.cull2.includes(word) && state.cull2.length < CULL_SECOND;
    toggleLimited(state.cull2, word, CULL_SECOND, `这一轮只能再划掉 ${CULL_SECOND} 个。先点回一个，再划别的。`);
    if (added) {
      state.cull3 = state.cull3.filter((id) => id !== word);
      state.revived = state.revived.filter((id) => id !== word);
    }
  } else if (state.step === "cull3") {
    if (state.cull1.includes(word) || state.cull2.includes(word)) return;
    const added = !state.cull3.includes(word) && state.cull3.length < CULL_THIRD;
    toggleLimited(state.cull3, word, CULL_THIRD, `这一轮只能再划掉 ${CULL_THIRD} 个。先点回一个，再划别的。`);
    if (added) state.revived = state.revived.filter((id) => id !== word);
  } else if (state.step === "revive") {
    if (!discardedIds().includes(word)) return;
    toggleLimited(state.revived, word, REVIVE, `只能复活 ${REVIVE} 个。先点回一个，再选别的。`);
  } else {
    return;
  }
  reconcile();
  save();
  render({ keepScroll: true, focusWord: word });
}

function onSlot(role, index) {
  if (!state.pick) {
    state.pick = { role, index };
  } else if (state.pick.role === role && state.pick.index === index) {
    state.pick = null;
  } else if (state.pick.role !== role) {
    state.pick = { role, index };
    state.block = "";
  } else {
    const order = role === "drive" ? state.driveOrder : state.pursueOrder;
    const from = state.pick.index;
    [order[from], order[index]] = [order[index], order[from]];
    state.pick = null;
  }
  if (state.step === "result") rememberResult();
  save();
  render({ keepScroll: true });
  const current = state.pick;
  if (current) {
    app.querySelector(`[data-slot="${current.role}:${current.index}"]`)?.focus();
  }
}

function resumeLabel() {
  const step = resumeStep();
  if (!hasProgress()) return "开始划掉";
  if (step === "result") return "看六芒星";
  if (step === "revive") return "继续复活";
  return "继续划掉";
}

function resumeStep() {
  const cull1Done = state.cull1.length === CULL_FIRST;
  const cull2Done = state.cull2.length === CULL_SECOND;
  if (keptIds().length === KEEP && state.revived.length === REVIVE) return "result";
  if (keptIds().length === KEEP && cull1Done && cull2Done) return "revive";
  if (cull1Done && cull2Done) return "cull3";
  if (cull1Done) return "cull2";
  return "cull1";
}

function startOver() {
  if (RK) RK.nickReset();
  state.step = "cull1";
  state.cull1 = [];
  state.cull2 = [];
  state.cull3 = [];
  state.revived = [];
  state.driveOrder = [];
  state.pursueOrder = [];
  state.pick = null;
  state.block = "";
  state.recId = "";
  save();
  render();
}

app.addEventListener("click", (event) => {
  const word = event.target.closest("[data-word]");
  if (word) {
    onWord(word.dataset.word);
    return;
  }
  const slot = event.target.closest("[data-slot]");
  if (slot) {
    const [role, index] = slot.dataset.slot.split(":");
    onSlot(role, Number(index));
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const name = action.dataset.action;
  if (name === "start") {
    if (RK) RK.ensureNick(() => go(resumeStep()));
    else go(resumeStep());
  } else if (name === "save-image") RK.exportImage(summarize());
  else if (name === "retest") startOver();
  else if (name === "cover") go("cover");
  else if (name === "to-cull1") go("cull1");
  else if (name === "to-cull2") go("cull2");
  else if (name === "to-cull3") go("cull3");
  else if (name === "to-revive" && keptIds().length === KEEP) go("revive");
  else if (name === "to-result" && state.revived.length === REVIVE) go("result");
  else if (name === "cancel-reset") {
      render({ keepScroll: true });
  }
});

function captureStar() {
  const sections = [{ t: "hex", drive: state.driveOrder.slice(), pursue: state.pursueOrder.slice() }];
  const roster = app.querySelector(".roster");
  if (roster) sections.push(...RK.capture(roster));
  sections.push({ t: "ul", it: summarize().notes.map((x) => ({ x, d: 0, n: 0 })) });
  return sections;
}

if (RK) RK.configure({ id: "star", start: ["[data-action=start]", "[data-action=resume]"], title: "职业六芒星", onRestart: startOver, capture: captureStar });
migrateOldArchive();
load();
if (state.step === "result") {
  animateStar = true;
  rememberResult();
  save();
}
render();

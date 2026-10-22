import { ASSESSMENT_CLOUD_CONFIG } from "./assessment-cloud-config.js";
import {
  backoffMs,
  buildShareUrl,
  createCloudStore,
  createSubmissionIds,
  gateSubmit,
  isoShanghai,
  orderKey,
  resolveEndpoint,
  resolveReportBase,
} from "./cloud-client.js";
import { buildStarResult } from "../star/js/cloud-payload.js";

const STYLE = `
.sc-panel{margin-top:28px;padding:16px 16px 18px;border:1px solid rgba(36,28,24,.14);border-radius:6px 18px 6px 18px;background:#fffaf7;color:#241c18;font-family:"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif;line-height:1.6}
.sc-panel h2{margin:0 0 8px;font-family:"Songti SC","STSong","Noto Serif SC",serif;font-size:22px;font-weight:500}
.sc-panel p{margin:0 0 10px;font-size:14px;color:#4e433d}
.sc-check{display:flex;gap:8px;align-items:flex-start;margin:8px 0 12px;font-size:15px}
.sc-check input{margin-top:4px}
.sc-actions{display:flex;flex-wrap:wrap;gap:8px}
.sc-btn{appearance:none;border:1px solid #241c18;background:transparent;color:#241c18;font:inherit;font-size:15px;min-height:44px;padding:8px 14px;border-radius:999px;cursor:pointer}
.sc-btn.primary{background:#2f5d4a;border-color:#2f5d4a;color:#fff}
.sc-btn:disabled{opacity:.45;cursor:default}
.sc-link{width:100%;margin:8px 0;padding:8px 10px;border:1px solid rgba(36,28,24,.18);border-radius:8px;font:12px/1.4 ui-monospace,monospace;color:#241c18;background:#fff}
.sc-warn{color:#9b5b3c}
`;

let styled = false;
let current = null;
let slotEl = null;
let timer = 0;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function config() {
  return { ...ASSESSMENT_CLOUD_CONFIG, ...(globalThis.ASSESSMENT_CLOUD_CONFIG || {}) };
}

function endpoint() {
  return resolveEndpoint(globalThis.location || {}, config());
}

function store() {
  return createCloudStore(globalThis.localStorage);
}

function paint() {
  if (!slotEl || !slotEl.isConnected || !current) return;
  slotEl.innerHTML = view(current);
}

function indexNote(index) {
  if (index === "已同步") return "飞书镜像已记下这条短索引。完整结果不在飞书里。";
  if (index === "待重试" || index === "失败") return "报告已经在云端。飞书镜像还没写上，链接仍然可以用。不能用飞书里有没有这一行来判断报告丢了没有。";
  return "飞书写入默认关着，这一轮没有写入飞书。";
}

function view(input) {
  const key = orderKey(input.driveOrder, input.pursueOrder);
  const saved = store().links()[key];
  const pending = store().pending().find((item) => item.orderKey === key);
  const agreed = Boolean(input.agreed);
  if (saved && saved.status === "revoked") {
    return panel(`<p>这条链接已经失效。结果还在这台设备上。</p>`);
  }
  if (saved && saved.status === "active") {
    return panel(`
      <p>报告链接已经生成。${esc(indexNote(saved.index))}</p>
      <input class="sc-link" readonly value="${esc(saved.reportUrl)}" />
      <div class="sc-actions">
        <button class="sc-btn primary" type="button" data-cloud="copy">复制链接</button>
        <button class="sc-btn" type="button" data-cloud="revoke">使链接失效</button>
      </div>
    `);
  }
  const disabled = agreed && input.nickname ? "" : "disabled";
  const pendingNote = pending
    ? `<p class="sc-warn">链接还没生成，结果仍在这台设备上。${esc(pending.lastError || "")}</p>`
    : (input.note ? `<p class="sc-warn">${esc(input.note)}</p>` : "");
  return panel(`
    <p>勾选后，才会把这一次的两组词、页面上的说明和昵称保存到腾讯云报告库，并生成一条换设备也能打开的链接。不保存手机号，不注册账号。不勾选的话，结果只留在这台设备，和现在一样。</p>
    <p>拿到链接的人能看完整结果。这台设备上可以让链接失效；清掉浏览器数据后，需要联系管理员。生成链接前，一份副本会暂存在这台设备。</p>
    ${pendingNote}
    <label class="sc-check"><input type="checkbox" data-cloud="consent" ${agreed ? "checked" : ""} />我同意保存这一次结果，并生成可转发的链接</label>
    <div class="sc-actions">
      <button class="sc-btn primary" type="button" data-cloud="save" ${disabled}>${pending ? "再试一次" : "生成报告链接"}</button>
      ${pending ? `<button class="sc-btn" type="button" data-cloud="drop">放弃上云</button>` : ""}
    </div>
  `);
}

function panel(inner) {
  return `<section class="sc-panel"><h2>保存并分享这一次</h2>${inner}</section>`;
}

function ensureStyle() {
  if (styled || !globalThis.document) return;
  styled = true;
  const node = document.createElement("style");
  node.id = "star-cloud-style";
  node.textContent = STYLE;
  document.head.appendChild(node);
}

function hideForDebug() {
  const search = String((globalThis.location && globalThis.location.search) || "");
  return /(?:^|[?&])(debug|preview)=/.test(search);
}

export function mountStarCloud(slot, input) {
  ensureStyle();
  slotEl = slot;
  if (hideForDebug()) {
    slot.innerHTML = "";
    return;
  }
  const key = orderKey(input.driveOrder, input.pursueOrder);
  current = {
    ...input,
    agreed: Boolean(current && current.orderKey === key && current.agreed),
    orderKey: key,
  };
  if (!slot.dataset.bound) {
    slot.dataset.bound = "1";
    slot.addEventListener("click", onClick);
    slot.addEventListener("change", onChange);
  }
  paint();
  const pending = store().pending().find((item) => item.orderKey === key);
  if (pending && pending.attempts > 0 && pending.attempts < 8) {
    const wait = Math.max(0, (pending.nextAt || 0) - Date.now());
    clearTimeout(timer);
    timer = setTimeout(() => { void submit({ auto: true }); }, wait);
  }
}

function onChange(event) {
  const box = event.target.closest("[data-cloud=consent]");
  if (!box || !current) return;
  current.agreed = box.checked;
  paint();
}

function onClick(event) {
  const button = event.target.closest("[data-cloud]");
  if (!button) return;
  event.stopPropagation();
  const name = button.getAttribute("data-cloud");
  if (name === "save") void submit({ auto: false });
  if (name === "copy") void copyLink();
  if (name === "revoke") void revoke();
  if (name === "drop") dropPending();
}

function dropPending() {
  if (!current) return;
  clearTimeout(timer);
  const cloud = store();
  const pending = cloud.pending().find((item) => item.orderKey === current.orderKey);
  if (pending) cloud.removePending(pending.reportId);
  paint();
}

async function submit({ auto }) {
  if (!current || current.saving) return;
  if (auto && store().links()[current.orderKey]) return;
  const cloud = store();
  const target = endpoint();
  const gate = gateSubmit({ agreed: current.agreed || auto, endpoint: target, nickname: current.nickname });
  if (!current.agreed && !auto) {
    paint();
    return;
  }
  if (!gate.ok && gate.reason === "endpoint") {
    rememberError("云端报告服务还没接到这个页面。结果仍在这台设备上。");
    return;
  }
  if (!gate.ok && gate.reason === "nickname") {
    rememberError("先有昵称，才能保存。结果仍在这台设备上。");
    return;
  }
  current.saving = true;
  let item = null;
  try {
  item = ensurePending(cloud);
  if (!item) {
    rememberError("这一次结果不完整，没有上传。");
    return;
  }
    const response = await fetch(`${target}/v1/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: item.payload, linkSecret: item.linkSecret, ownerToken: item.ownerToken }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 200 && body.reportId) {
      rememberLink(cloud, item, body.index, body.byteSize);
      return;
    }
    if (response.status === 409) {
      const saved = await fetch(`${target}/v1/results/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId: item.reportId, linkSecret: item.linkSecret }),
      });
      if (saved.status === 200) {
        rememberLink(cloud, item, "off", 0);
        return;
      }
      item.lastError = "这一份编号已用过。结果仍在这台设备上。";
      item.attempts = 8;
      cloud.upsertPending(item);
      paint();
      return;
    }
    if (response.status === 422) {
      item.lastError = "这份结果没有通过校验，没有上传。结果仍在这台设备上。";
      item.attempts = 8;
      cloud.upsertPending(item);
      paint();
      return;
    }
    failPending(item, response.status === 429 ? "提交太频繁，稍后再试。" : "这次没有保存成功。");
  } catch {
    if (item) failPending(item, "链接还没生成，结果仍在这台设备上。");
    else rememberError("链接还没生成，结果仍在这台设备上。");
  } finally {
    if (current) current.saving = false;
  }
}

function rememberLink(cloud, item, index, size) {
  const reportUrl = buildShareUrl(resolveReportBase(location, config()), item.reportId, item.linkSecret);
  cloud.removePending(item.reportId);
  cloud.saveLink(current.orderKey, {
    reportId: item.reportId,
    reportUrl,
    status: "active",
    index: index || "off",
    byteSize: size || 0,
  });
  if (current) current.note = "";
  paint();
}

function ensurePending(cloud) {
  const found = cloud.pending().find((item) => item.orderKey === current.orderKey);
  if (found) return found;
  const ids = createSubmissionIds();
  if (ids.linkSecret === ids.ownerToken) ids.ownerToken = createSubmissionIds().ownerToken;
  const payload = buildStarResult({
    ...current,
    reportId: ids.reportId,
    clientSubmissionId: ids.clientSubmissionId,
    completedAt: isoShanghai(new Date()),
  });
  if (!payload) return null;
  const item = {
    ...ids,
    orderKey: current.orderKey,
    payload,
    attempts: 0,
    nextAt: 0,
    lastError: "",
  };
  cloud.upsertPending(item);
  cloud.saveOwner(ids.reportId, ids.ownerToken);
  return item;
}

function failPending(item, message) {
  const cloud = store();
  item.attempts += 1;
  item.lastError = message;
  item.nextAt = Date.now() + backoffMs(item.attempts);
  cloud.upsertPending(item);
  paint();
  if (item.attempts < 8) {
    clearTimeout(timer);
    timer = setTimeout(() => { void submit({ auto: true }); }, backoffMs(item.attempts));
  }
}

function rememberError(message) {
  if (!current) return;
  current.note = message;
  paint();
}

async function copyLink() {
  if (!current) return;
  const saved = store().links()[current.orderKey];
  if (!saved) return;
  try {
    await navigator.clipboard.writeText(saved.reportUrl);
  } catch {
    const input = slotEl && slotEl.querySelector(".sc-link");
    if (input) {
      input.focus();
      input.select();
    }
  }
}

async function revoke() {
  if (!current) return;
  const cloud = store();
  const saved = cloud.links()[current.orderKey];
  const ownerToken = saved && cloud.owners()[saved.reportId];
  const target = endpoint();
  if (!saved || !ownerToken || !target) return;
  try {
    const response = await fetch(`${target}/v1/results/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportId: saved.reportId, ownerToken }),
    });
    if (response.status !== 200) return;
    cloud.saveLink(current.orderKey, { ...saved, status: "revoked" });
    paint();
  } catch {
    /* 撤销失败时原链接保持原样，结果页不动。 */
  }
}

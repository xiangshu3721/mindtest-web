/** 结果页自动提交并复制短链接。没有同意勾选，同意在提交时记为已同意。不上传 angerFill。 */
import { ASSESSMENT_CLOUD_CONFIG } from '../../js/assessment-cloud-config.js';
import {
  backoffMs,
  buildShareUrl,
  createCloudStore,
  createSubmissionIds,
  gateSubmit,
  isoShanghai,
  resolveEndpoint,
  resolveReportBase,
} from '../../js/cloud-client.js';
import { beattieOrderKey, buildBeattieResult } from './cloud-payload';

type Store = ReturnType<typeof createCloudStore>;

type ShareInput = {
  testId: string;
  nickname: string;
  likert: unknown[];
  mcq: unknown[];
  tf: unknown[];
};

type Current = ShareInput & {
  orderKey: string;
  saving: boolean;
  note: string;
  generation: object | null;
};

let current: Current | null = null;
let slotEl: HTMLElement | null = null;
let timer = 0;
let copyTimer = 0;

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] || char));
}

function config() {
  const extra = (globalThis as { ASSESSMENT_CLOUD_CONFIG?: Record<string, string> }).ASSESSMENT_CLOUD_CONFIG || {};
  return { ...ASSESSMENT_CLOUD_CONFIG, ...extra };
}

function endpoint() {
  return resolveEndpoint(globalThis.location || {}, config());
}

function cloudStore(): Store {
  return createCloudStore(globalThis.localStorage);
}

function activeSaved(key: string) {
  const saved = cloudStore().links()[key];
  if (!saved || saved.status !== 'active' || !saved.reportUrl) return null;
  return saved;
}

function pendingItem(key: string) {
  return cloudStore().pending().find((item: { orderKey: string }) => item.orderKey === key) || null;
}

function still(generation: object | null, key: string) {
  return Boolean(current && current.generation === generation && current.orderKey === key);
}

function view(input: Current) {
  const saved = activeSaved(input.orderKey);
  const pending = pendingItem(input.orderKey);
  const failed = Boolean(!saved && !input.saving && pending && pending.attempts > 0 && pending.lastError);
  let note = input.note || '';
  if (!note && input.saving && !saved) note = '链接生成中';
  if (!note && failed && pending) note = pending.lastError || '这次没生成链接';
  const warn = Boolean(note && note !== '链接已复制' && note !== '链接生成中');
  const retry = failed ? `<button class="sc-retry" type="button" data-cloud="retry">重试</button>` : '';
  return `
    <div class="sc-share">
      <button class="sc-btn" type="button" data-cloud="share"${input.saving && !saved ? ' aria-busy="true"' : ''}>分享结果</button>
      ${retry}
      ${note ? `<p class="sc-note${warn ? ' warn' : ''}">${esc(note)}</p>` : ''}
    </div>
  `;
}

function paint() {
  if (!slotEl || !slotEl.isConnected || !current) return;
  slotEl.innerHTML = view(current);
}

function rememberError(message: string) {
  if (!current) return;
  current.note = message;
  paint();
}

export function mountBeattieCloud(slot: HTMLElement, input: ShareInput) {
  slotEl = slot;
  const key = beattieOrderKey(input.testId, input.likert, input.mcq, input.tf);
  const previous = current && current.orderKey === key ? current : null;
  current = {
    ...input,
    orderKey: key,
    saving: Boolean(previous && previous.saving),
    note: previous ? previous.note : '',
    generation: previous ? previous.generation : null,
  };
  if (!slot.dataset.bound) {
    slot.dataset.bound = '1';
    slot.addEventListener('click', onClick);
  }
  paint();
  if (current.saving || activeSaved(key)) return;
  const pending = pendingItem(key);
  if (pending && pending.attempts > 0 && pending.attempts < 8) {
    resumePending();
    return;
  }
  void submit();
}

function onClick(event: Event) {
  const target = event.target;
  if (!(target instanceof Element) || !current) return;
  const button = target.closest('[data-cloud]');
  if (!button) return;
  event.stopPropagation();
  const name = button.getAttribute('data-cloud');
  if (name === 'retry') {
    retry();
    return;
  }
  if (name !== 'share') return;
  if (activeSaved(current.orderKey)) {
    void copyLink();
    return;
  }
  if (current.saving) {
    current.note = '链接生成中，稍后再试';
    paint();
    return;
  }
  retry();
}

function resumePending() {
  if (!current || current.saving || activeSaved(current.orderKey)) return;
  const pending = pendingItem(current.orderKey);
  if (!pending || pending.attempts <= 0 || pending.attempts >= 8) return;
  const wait = Math.max(0, (pending.nextAt || 0) - Date.now());
  clearTimeout(timer);
  timer = setTimeout(() => { void submit(); }, wait);
}

function retry() {
  if (!current || current.saving) return;
  clearTimeout(timer);
  const cloud = cloudStore();
  const pending = pendingItem(current.orderKey);
  if (pending) {
    pending.attempts = 0;
    pending.lastError = '';
    pending.nextAt = 0;
    cloud.upsertPending(pending);
  }
  current.note = '';
  void submit();
}

async function submit() {
  if (!current || current.saving) return;
  const key = current.orderKey;
  if (activeSaved(key)) return;
  const cloud = cloudStore();
  const target = endpoint();
  const gate = gateSubmit({ agreed: true, endpoint: target, nickname: current.nickname });
  if (!gate.ok) {
    rememberError(gate.reason === 'nickname' ? '先填昵称，才能分享' : '现在没法生成链接');
    return;
  }
  const generation = {};
  current.generation = generation;
  current.saving = true;
  current.note = '';
  paint();
  let item: ReturnType<Store['pending']>[number] | null = null;
  try {
    item = ensurePending(cloud);
    if (!still(generation, key)) return;
    if (!item) {
      rememberError('这一次结果不完整，没法分享');
      return;
    }
    const response = await fetch(`${target}/v1/results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result: item.payload, linkSecret: item.linkSecret, ownerToken: item.ownerToken }),
    });
    if (!still(generation, key)) return;
    const body = await response.json().catch(() => ({}));
    if (!still(generation, key)) return;
    if (response.status === 200 && body.reportId) {
      rememberLink(cloud, item, key, generation);
      return;
    }
    if (response.status === 409) {
      const saved = await fetch(`${target}/v1/results/read`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId: item.reportId, linkSecret: item.linkSecret }),
      });
      if (!still(generation, key)) return;
      if (saved.status === 200) {
        rememberLink(cloud, item, key, generation);
        return;
      }
      item.lastError = '这次没生成链接';
      item.attempts = 8;
      cloud.upsertPending(item);
      return;
    }
    if (response.status === 422) {
      item.lastError = '这次没生成链接';
      item.attempts = 8;
      cloud.upsertPending(item);
      return;
    }
    failPending(item, response.status === 429 ? '刚才点得太快了，稍后再试' : '这次没生成链接', generation, key);
  } catch {
    if (!still(generation, key)) return;
    if (item) failPending(item, '这次没生成链接', generation, key);
    else rememberError('这次没生成链接');
  } finally {
    if (still(generation, key)) {
      current.saving = false;
      paint();
    }
  }
}

function rememberLink(cloud: Store, item: { reportId: string; linkSecret: string }, key: string, generation: object) {
  if (!still(generation, key) || !current) return;
  const reportUrl = buildShareUrl(resolveReportBase(globalThis.location, config()), item.reportId, item.linkSecret);
  cloud.removePending(item.reportId);
  cloud.saveLink(key, {
    reportId: item.reportId,
    reportUrl,
    status: 'active',
    byteSize: 0,
  });
  current.note = '';
}

function ensurePending(cloud: Store) {
  if (!current) return null;
  const found = pendingItem(current.orderKey);
  if (found) return found;
  const ids = createSubmissionIds();
  if (ids.linkSecret === ids.ownerToken) ids.ownerToken = createSubmissionIds().ownerToken;
  const payload = buildBeattieResult({
    testId: current.testId,
    nickname: current.nickname,
    likert: current.likert,
    mcq: current.mcq,
    tf: current.tf,
    rushed: false,
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
    lastError: '',
  };
  cloud.upsertPending(item);
  cloud.saveOwner(ids.reportId, ids.ownerToken);
  return item;
}

function failPending(item: NonNullable<ReturnType<typeof pendingItem>>, message: string, generation: object, key: string) {
  const cloud = cloudStore();
  item.attempts += 1;
  item.lastError = message;
  item.nextAt = Date.now() + backoffMs(item.attempts);
  cloud.upsertPending(item);
  if (!still(generation, key) || !current) return;
  current.note = '';
  if (item.attempts < 8) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (still(generation, key)) void submit();
    }, backoffMs(item.attempts));
  }
}

async function writeClipboard(text: string) {
  const nav = globalThis.navigator;
  if (nav && nav.clipboard && nav.clipboard.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return;
    } catch {
      /* 下面再试一次系统复制。 */
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy');
}

async function copyLink() {
  if (!current) return;
  const saved = activeSaved(current.orderKey);
  if (!saved) return;
  try {
    await writeClipboard(saved.reportUrl);
    current.note = '链接已复制';
  } catch {
    current.note = '没复制上，再点一次';
  }
  paint();
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    if (current && current.note === '链接已复制') {
      current.note = '';
      paint();
    }
  }, 2500);
}

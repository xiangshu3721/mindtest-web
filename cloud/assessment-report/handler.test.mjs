import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORDS } from "../../star/js/data.js";
import { buildStarResult } from "../../star/js/cloud-payload.js";
import { createHandler } from "./lib/handler.mjs";
import { createMemoryStore } from "./lib/store.mjs";
import { createFeishuIndex, MIRROR_FIELDS, TABLE_NAME } from "./lib/feishu.mjs";
import { assertDevCollection, randomSecret } from "./lib/ids.mjs";
import { createCloudBaseStore } from "./lib/store.mjs";
import { buildImportDraft } from "./lib/import-draft.mjs";

function ids() {
  return {
    reportId: `rpt_${randomSecret(18)}`,
    clientSubmissionId: `sub_${randomSecret(18)}`,
    linkSecret: randomSecret(32),
    ownerToken: randomSecret(32),
  };
}

function result(extra = {}, id = ids()) {
  const drive = extra.drive || WORDS.slice(28);
  const pursue = extra.pursue || WORDS.slice(0, 3);
  const payload = buildStarResult({
    nickname: "小林",
    driveOrder: drive,
    pursueOrder: pursue,
    cull1: WORDS.slice(0, 15),
    cull2: WORDS.slice(15, 25),
    cull3: WORDS.slice(25, 28),
    revived: pursue,
    completedAt: "2026-10-19T16:00:00+08:00",
    ...id,
  });
  return { payload, ...id };
}

function app(options = {}) {
  const feishu = options.feishu || createFeishuIndex({ FEISHU_INDEX_MODE: options.mode || "off" });
  const handler = createHandler({
    store: createMemoryStore("assessment_reports_dev"),
    feishu,
    importKey: "test-import-key",
    publicReportBase: "http://127.0.0.1:4173/r/",
    silent: true,
  });
  return { ...handler, feishu };
}

async function post(handler, path, body, extra = {}) {
  return handler.handle({
    method: "POST",
    path,
    headers: extra.headers || {},
    body,
    ip: extra.ip || "203.0.113.10",
    now: extra.now || 1_000,
  });
}

test("词表只有一份，服务端再导出的就是六芒星页面上的 31 个词", async () => {
  const serverWords = (await import("./words.mjs")).WORDS;
  assert.deepEqual(serverWords, WORDS);
  assert.equal(WORDS.length, 31);
});

test("默认不写飞书，云端仍能保存、读取和撤销", async () => {
  const { handle, store, feishu, logs } = app();
  const made = result();
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.index, "off");
  assert.equal(created.body.collection, "assessment_reports_dev");
  assert.equal(store.size(), 1);
  assert.equal(feishu.rows.length, 0);
  assert.ok(created.body.byteSize > 500 && created.body.byteSize < 8000);
  assert.equal(created.body.reportUrl.includes(made.linkSecret), true);
  assert.equal(created.body.reportUrl.includes("?"), false);

  const again = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  assert.equal(again.status, 200);
  assert.equal(store.size(), 1);

  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  });
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.dimensions.map((item) => item.score), [null, null]);
  assert.equal(JSON.stringify(read.body).includes(made.linkSecret), false);
  assert.equal(JSON.stringify(read.body).includes(made.ownerToken), false);

  const missing = await post({ handle }, "/v1/results/read", {
    reportId: `rpt_${"a".repeat(20)}`, linkSecret: made.linkSecret,
  });
  const wrong = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: randomSecret(32),
  });
  assert.equal(missing.status, 404);
  assert.deepEqual(wrong.body, missing.body);

  const revoked = await post({ handle }, "/v1/results/revoke", {
    reportId: made.reportId, ownerToken: made.ownerToken,
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.archiveStatus, "未归档");
  const after = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  });
  assert.equal(after.status, 410);
  assert.deepEqual(after.body, { error: "revoked" });
  assert.equal(JSON.stringify(logs).includes("小林"), false);
  assert.equal(JSON.stringify(logs).includes(made.linkSecret), false);
});

test("同一提交号内容变了不会覆盖，换词序是新报告，旧链接不变", async () => {
  const { handle } = app();
  const first = result();
  assert.equal((await post({ handle }, "/v1/results", {
    result: first.payload, linkSecret: first.linkSecret, ownerToken: first.ownerToken,
  })).status, 200);
  const changed = buildStarResult({
    nickname: "小林",
    driveOrder: [first.payload.reportContent.viewModel.driveOrder[1], first.payload.reportContent.viewModel.driveOrder[0], first.payload.reportContent.viewModel.driveOrder[2]],
    pursueOrder: first.payload.reportContent.viewModel.pursueOrder,
    completedAt: first.payload.completedAt,
    reportId: first.reportId,
    clientSubmissionId: first.clientSubmissionId,
  });
  const conflict = await post({ handle }, "/v1/results", {
    result: changed, linkSecret: first.linkSecret, ownerToken: first.ownerToken,
  });
  assert.equal(conflict.status, 409);
  const second = result({ drive: changed.reportContent.viewModel.driveOrder, pursue: changed.reportContent.viewModel.pursueOrder });
  assert.equal((await post({ handle }, "/v1/results", {
    result: second.payload, linkSecret: second.linkSecret, ownerToken: second.ownerToken,
  }, { ip: "203.0.113.11" })).status, 200);
  const oldRead = await post({ handle }, "/v1/results/read", {
    reportId: first.reportId, linkSecret: first.linkSecret,
  });
  assert.deepEqual(oldRead.body.reportContent.viewModel.driveOrder, first.payload.reportContent.viewModel.driveOrder);
});

test("飞书镜像按报告 ID 幂等，失败后重试，撤销不改归档状态", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock", failTimes: 1 });
  const { handle, store, retryMirrors } = app({ feishu });
  const made = result();
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  assert.equal(created.body.index, "待重试");
  assert.equal(feishu.rows.length, 0);
  assert.equal(store.size(), 1);
  const readable = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  });
  assert.equal(readable.status, 200);

  const retried = await retryMirrors();
  assert.equal(retried[0].feishuSync, "已同步");
  assert.equal(feishu.rows.length, 1);
  assert.deepEqual(Object.keys(feishu.rows[0]), MIRROR_FIELDS);
  assert.equal(feishu.rows[0]["报告状态"], "有效");
  assert.equal(feishu.rows[0]["客户归档状态"], "未归档");
  assert.equal(feishu.rows[0]["同步状态"], "已同步");
  assert.equal(feishu.rows[0]["核心结果摘要"].length <= 120, true);
  assert.equal(JSON.stringify(feishu.rows[0]).includes(made.linkSecret), false);
  assert.equal(JSON.stringify(feishu.rows[0]).includes("cull1"), false);
  assert.equal(TABLE_NAME, "ASVA 测评记录");

  const again = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  assert.equal(again.status, 200);
  assert.equal(feishu.rows.length, 1);

  feishu.failNext(1);
  const revoked = await post({ handle }, "/v1/results/revoke", {
    reportId: made.reportId, ownerToken: made.ownerToken,
  });
  assert.equal(revoked.status, 200);
  assert.equal(feishu.rows[0]["报告状态"], "有效");
  const doc = await store.getByReportId(made.reportId);
  assert.equal(doc.shareStatus, "revoked");
  assert.equal(doc.feishuSync, "待重试");
  assert.equal(doc.archiveStatus, "未归档");
  await retryMirrors();
  assert.equal(feishu.rows.length, 1);
  assert.equal(feishu.rows[0]["报告状态"], "已撤销");
  assert.equal(feishu.rows[0]["客户归档状态"], "未归档");
});

test("飞书 live 未确认时不调用 writer，报告仍在", async () => {
  let called = 0;
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "live" }, async () => { called += 1; });
  const { handle } = app({ feishu });
  const made = result();
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.index, "待重试");
  assert.equal(called, 0);
});

test("多次镜像失败后标失败，但报告还在", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock", failTimes: 1 });
  const { handle, store, retryMirrors } = app({ feishu });
  const made = result();
  await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  await store.update(made.reportId, { feishuAttempts: 7, feishuSync: "待重试" });
  feishu.failNext(1);
  const [doc] = await retryMirrors();
  assert.equal(doc.feishuSync, "失败");
  assert.equal(feishu.rows.length, 0);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  });
  assert.equal(read.status, 200);
});

test("管理员要有集成密钥和链接秘密，归档不改客户字段也不按昵称合并", async () => {
  const { handle } = app();
  const made = result();
  await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  const hidden = await post({ handle }, "/v1/integrations/asva/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  });
  assert.equal(hidden.status, 404);
  const headers = { authorization: "Bearer test-import-key" };
  const preview = await post({ handle }, "/v1/integrations/asva/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { headers });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.nickname, "小林");
  const missingCustomer = await post({ handle }, "/v1/integrations/asva/archive", {
    reportId: made.reportId, linkSecret: made.linkSecret, customerId: "",
  }, { headers });
  assert.equal(missingCustomer.status, 422);
  const archived = await post({ handle }, "/v1/integrations/asva/archive", {
    reportId: made.reportId, linkSecret: made.linkSecret, customerId: "C00001001",
  }, { headers, ip: "203.0.113.20" });
  assert.equal(archived.status, 200);
  assert.deepEqual(archived.body.customerFieldsTouched, []);
  assert.equal(archived.body.nicknameAutoMatched, false);
  const duplicate = await post({ handle }, "/v1/integrations/asva/archive", {
    reportId: made.reportId, linkSecret: made.linkSecret, customerId: "C00001001",
  }, { headers, ip: "203.0.113.21" });
  assert.equal(duplicate.body.duplicate, true);
  const other = await post({ handle }, "/v1/integrations/asva/archive", {
    reportId: made.reportId, linkSecret: made.linkSecret, customerId: "C00001002",
  }, { headers, ip: "203.0.113.22" });
  assert.equal(other.status, 409);
  const draft = buildImportDraft({
    report: preview.body,
    customerId: "C00001001",
    linkSecret: made.linkSecret,
    existing: [],
  });
  assert.equal(draft.ok, true);
  assert.equal(JSON.stringify(draft.sourceRecord).includes(made.linkSecret), false);
  assert.deepEqual(draft.customerFieldsTouched, []);
  const again = buildImportDraft({
    report: preview.body,
    customerId: "C00001001",
    existing: [{ reportId: made.reportId, customerId: "C00001001", sourceId: draft.sourceRecord.source_id }],
  });
  assert.equal(again.error, "duplicate");
});

test("拒绝分数、其他测评、手机号字段、过大正文、错误来源和超限", async () => {
  const { handle, store } = app();
  const made = result();
  made.payload.dimensions[0].score = 88;
  assert.equal((await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  })).status, 422);
  const other = result();
  other.payload.assessmentId = "scl90";
  assert.equal((await post({ handle }, "/v1/results", {
    result: other.payload, linkSecret: other.linkSecret, ownerToken: other.ownerToken,
  }, { ip: "203.0.113.30" })).status, 422);
  const phone = result();
  phone.payload.extensionData.phone = "13800000000";
  assert.equal((await post({ handle }, "/v1/results", {
    result: phone.payload, linkSecret: phone.linkSecret, ownerToken: phone.ownerToken,
  }, { ip: "203.0.113.31" })).status, 422);
  const huge = await handle({
    method: "POST",
    path: "/v1/results",
    headers: {},
    rawBody: "x".repeat(400 * 1024 + 1),
    ip: "203.0.113.32",
    now: 1,
  });
  assert.equal(huge.status, 413);
  const blocked = await handle({
    method: "POST",
    path: "/v1/results",
    headers: { origin: "https://evil.example" },
    body: {},
    ip: "203.0.113.33",
    now: 1,
  });
  assert.equal(blocked.status, 403);
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await post({ handle }, "/v1/results", { result: {} }, { ip: "203.0.113.40", now: 5_000 })).status, 422);
  }
  assert.equal((await post({ handle }, "/v1/results", { result: {} }, { ip: "203.0.113.40", now: 5_001 })).status, 429);
  assert.equal(store.size(), 0);
});

test("隔离集合以外直接拒绝，CloudBase 驱动本轮不连接", async () => {
  assert.throws(() => assertDevCollection("assessment_reports"));
  await assert.rejects(() => createCloudBaseStore({ ASSESSMENT_STORE_DRIVER: "cloudbase" }));
  await assert.rejects(() => createCloudBaseStore({
    ASSESSMENT_STORE_DRIVER: "cloudbase",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
  }));
});

test("其他测评页面没有接上云端块", async () => {
  for (const file of ["index.html", "ecr/index.html", "pdq/index.html", "scl90/index.html", "beattie/index.html"]) {
    const text = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.equal(text.includes("cloud-kit"), false);
    assert.equal(text.includes("star-cloud"), false);
  }
});

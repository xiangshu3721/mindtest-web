import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { WORDS } from "../../star/js/data.js";
import { buildStarResult } from "../../star/js/cloud-payload.js";
import { buildSefsResult } from "./vendor/sefs-payload.mjs";
import { buildScl90Result } from "./vendor/scl90-payload.mjs";
import { buildPdq4Result } from "./vendor/pdq4-payload.mjs";
import { scorePdq4 as cloudScorePdq4 } from "./vendor/pdq4-score.mjs";
import { scorePdq4 as pageScorePdq4 } from "../../pdq/js/score.js";
import { buildEcrResult } from "./vendor/ecr-payload.mjs";
import { scoreEcr as cloudScoreEcr } from "./vendor/ecr-score.mjs";
import { buildRootResult } from "./vendor/root-payload.mjs";
import { scoreRoot } from "./vendor/root-score.mjs";
import { buildLoves5Result } from "./vendor/loves5-payload.mjs";
import { PAIRS, scoreLoves5 } from "./vendor/loves5-score.mjs";
import { buildJuyingResult } from "./vendor/juying-payload.mjs";
import { scoreJuying } from "./vendor/juying-score.mjs";
import { buildHollandResult } from "./vendor/holland-payload.mjs";
import { scoreHolland } from "./vendor/holland-score.mjs";
import { buildZhenaiResult } from "./vendor/zhenai-payload.mjs";
import { computeResult as scoreZhenai } from "./vendor/zhenai/scoring.js";
import { buildGcdResult } from "./vendor/gcd-payload.mjs";
import { scoreGcd } from "./vendor/gcd-score.mjs";
import { buildSensmapResult } from "./vendor/sensmap-payload.mjs";
import { QUESTIONS as SENSMAP_QUESTIONS } from "./vendor/sensmap-engine.mjs";
import { buildBeattieResult, BEATTIE_TESTS } from "./vendor/beattie-payload.mjs";
import { getTestById } from "./vendor/beattie-engine.mjs";
import { REVERSE_ITEMS as ECR_REVERSE_ITEMS } from "../../ecr/js/data.js";
import { scoreEcr as pageScoreEcr } from "../../ecr/js/score.js";
import { createHandler } from "./lib/handler.mjs";
import { validateAssessmentResult } from "./lib/validate.mjs";
import { createCloudBaseStore, createMemoryStore, tableSql } from "./lib/store.mjs";
import { buildGithubShareUrl, createFeishuHttpWriter, createFeishuIndex, feishuLiveReady, MIRROR_FIELDS, TABLE_NAME } from "./lib/feishu.mjs";
import { ALLOWED_ASSESSMENT_IDS, assertDevCollection, randomSecret } from "./lib/ids.mjs";
import { buildImportDraft } from "./lib/import-draft.mjs";
import { deployBlockReason } from "./index.mjs";
import { HTTP_ORIGIN, PREVIEW_REPORT_BASE } from "./lib/preview.mjs";
import { buildPreview } from "./build-preview.mjs";
import { normalizeRequestPath, resolveStatic, startLocalServer } from "./local-server.mjs";

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
    deployed: options.deployed === true,
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
  const bundledWords = (await import("./vendor/star-data.js")).WORDS;
  assert.deepEqual(serverWords, WORDS);
  assert.deepEqual(bundledWords, WORDS);
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

test("线上短编号也能存档，分享链接去掉 rpt_ 前缀", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle } = app({ feishu });
  const made = result({}, {
    reportId: `rpt_${"a".repeat(11)}`,
    clientSubmissionId: `sub_${"c".repeat(16)}`,
    linkSecret: "b".repeat(16),
    ownerToken: "d".repeat(24),
  });
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  });
  assert.equal(created.status, 200);
  const url = feishu.rows[0]["分享链接"];
  assert.equal(url, `https://xiangshu3721.github.io/mindtest-web/r/#${"a".repeat(11)}.${"b".repeat(16)}`);
  assert.equal(url.includes("rpt_"), false);
  assert.equal(JSON.stringify(created.body).includes("tcloudbase.com"), false);
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
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
  assert.equal(feishu.rows[0]["分享链接"].includes("rpt_"), false);
  assert.equal(feishu.rows[0]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(feishu.rows[0]["分享链接"].includes("tcloudbase.com"), false);
  assert.equal(JSON.stringify(feishu.rows[0]).includes(made.ownerToken), false);
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
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
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

test("报告已入库后飞书连续失败保持待重试，补偿成功后同一报告只有一行", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock", failTimes: 2 });
  const { handle, store } = app({ feishu, deployed: true });
  const made = result();
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  }, { ip: "203.0.113.70" });
  assert.equal(created.status, 200);
  assert.equal(created.body.index, "待重试");
  assert.equal((await store.getByReportId(made.reportId)).feishuSync, "待重试");
  assert.equal(feishu.rows.length, 0);
  const readable = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.71" });
  assert.equal(readable.status, 200);

  const hidden = await post({ handle }, "/v1/integrations/feishu/retry", {}, { ip: "203.0.113.72" });
  assert.equal(hidden.status, 404);
  const garbage = await handle({
    method: "POST",
    path: "/v1/integrations/feishu/retry",
    headers: {},
    rawBody: "not-json",
    ip: "203.0.113.72",
    now: 1_000,
  });
  assert.equal(garbage.status, 404);
  const closed = app({ feishu, deployed: false });
  const locked = await post(closed, "/v1/integrations/feishu/retry", {}, {
    headers: { authorization: "Bearer test-import-key" },
    ip: "203.0.113.73",
  });
  assert.equal(locked.status, 404);

  const still = await post({ handle }, "/v1/integrations/feishu/retry", {}, {
    headers: { authorization: "Bearer test-import-key" },
    ip: "203.0.113.74",
  });
  assert.equal(still.status, 200);
  assert.equal(still.body.pending, 1);
  assert.equal(feishu.rows.length, 0);
  assert.equal((await store.getByReportId(made.reportId)).feishuSync, "待重试");

  const done = await post({ handle }, "/v1/integrations/feishu/retry", {}, {
    headers: { authorization: "Bearer test-import-key" },
    ip: "203.0.113.75",
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.synced, 1);
  assert.equal(done.body.retried, 1);
  assert.equal(feishu.rows.length, 1);
  assert.equal(feishu.rows[0]["报告 ID"], made.reportId);
  assert.equal(JSON.stringify(done.body).includes(made.linkSecret), false);
  assert.equal((await store.getByReportId(made.reportId)).feishuSync, "已同步");

  const idle = await post({ handle }, "/v1/integrations/feishu/retry", {}, {
    headers: { authorization: "Bearer test-import-key" },
    ip: "203.0.113.76",
  });
  assert.equal(idle.body.retried, 0);
  assert.equal(feishu.rows.length, 1);
});

test("飞书 writer 按报告 ID 更新，不新建第二行", async () => {
  const records = [];
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, method: init.method, body });
    if (url.endsWith("/tenant_access_token/internal")) {
      assert.equal(body.app_secret, "test-secret");
      return { json: async () => ({ code: 0, tenant_access_token: "token-1", expire: 7200 }) };
    }
    if (url.endsWith("/records/search")) {
      return { json: async () => ({ code: 0, data: { items: records.map((item) => ({ record_id: item.id, fields: item.fields })) } }) };
    }
    if (init.method === "POST" && url.endsWith("/records")) {
      records.push({ id: "rec_1", fields: body.fields });
      return { json: async () => ({ code: 0, data: { record: { record_id: "rec_1" } } }) };
    }
    if (init.method === "PUT") {
      records[0].fields = body.fields;
      return { json: async () => ({ code: 0, data: { record: { record_id: "rec_1" } } }) };
    }
    throw new Error(url);
  };
  const env = {
    FEISHU_APP_ID: "cli_aaff6cb53db89bd3",
    FEISHU_APP_SECRET: "test-secret",
    FEISHU_APP_TOKEN: "bascnTEST",
  };
  const writer = createFeishuHttpWriter(env, fetchImpl);
  const feishu = createFeishuIndex({
    FEISHU_INDEX_MODE: "live",
    FEISHU_INDEX_LIVE_CONFIRM: "YES",
    FEISHU_ASSESSMENT_TABLE_ID: "tblTEST",
    ...env,
  }, writer);
  const row = {
    "报告 ID": "rpt_abcdefghijklmnopqrst",
    "客户昵称": "小林",
    "测评 ID": "star",
    "测评名称": "职业六芒星",
    "完成时间": "2026-10-20T12:00:00+08:00",
    "核心结果摘要": "底层动力：自由",
    "来源": "站内合集",
    "关联客户 ID": "",
    "报告状态": "有效",
    "客户归档状态": "未归档",
    "同步状态": "已同步",
    "来源导师 ID": "",
    "来源活动": "",
    "记录版本": "1.0.0",
    "报告字节数": 3072,
    "创建时间": "2026-10-20T04:00:00.000Z",
  };
  assert.equal(await feishu.upsert(row), "ok");
  row["报告状态"] = "已撤销";
  assert.equal(await feishu.upsert(row), "ok");
  assert.equal(records.length, 1);
  assert.equal(records[0].fields["报告状态"], "已撤销");
  assert.equal(typeof records[0].fields["完成时间"], "number");
  assert.equal(calls.filter((call) => call.method === "POST" && call.url.endsWith("/records")).length, 1);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
  records.push({ id: "rec_dup", fields: { ...records[0].fields } });
  assert.equal(await feishu.upsert(row), "ok");
  assert.equal(calls.filter((call) => call.method === "POST" && call.url.endsWith("/records")).length, 1);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 2);
  assert.equal(calls.filter((call) => call.method === "PUT").at(-1).url.endsWith("/records/rec_1"), true);
  assert.equal(JSON.stringify(records).includes("link-secret"), false);
  assert.equal(feishuLiveReady({ FEISHU_INDEX_MODE: "live" }), false);
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
  other.payload.assessmentId = "beattie";
  const rejected = await post({ handle }, "/v1/results", {
    result: other.payload, linkSecret: other.linkSecret, ownerToken: other.ownerToken,
  }, { ip: "203.0.113.30" });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.issues.includes("测评不在可保存范围内"), true);
  assert.equal(JSON.stringify(rejected.body).includes("只接受职业六芒星"), false);
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

function confirmedEnv(extra = {}) {
  return {
    ASSESSMENT_COLLECTION: "assessment_reports_dev",
    ASSESSMENT_STORE_DRIVER: "postgres",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    ...extra,
  };
}

function mockSql() {
  const rows = new Map();
  const statements = [];
  return {
    statements,
    async query(text, params = []) {
      statements.push(text);
      if (text.startsWith("CREATE TABLE") || text.startsWith("CREATE UNIQUE INDEX")) return { rows: [] };
      if (text.startsWith("INSERT")) {
        const [reportId, submissionId, raw] = params;
        if (rows.has(reportId) || [...rows.values()].some((item) => item.source_submission_id === submissionId)) {
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }
        rows.set(reportId, { report_id: reportId, source_submission_id: submissionId, doc: JSON.parse(raw) });
        return { rows: [] };
      }
      if (text.startsWith("UPDATE")) {
        const [raw, submissionId, reportId] = params;
        const row = rows.get(reportId);
        if (!row) return { rows: [] };
        row.doc = JSON.parse(raw);
        row.source_submission_id = submissionId;
        return { rows: [] };
      }
      if (text.includes("WHERE report_id")) {
        const row = rows.get(params[0]);
        return { rows: row ? [{ doc: row.doc }] : [] };
      }
      if (text.includes("WHERE source_submission_id")) {
        const row = [...rows.values()].find((item) => item.source_submission_id === params[0]);
        return { rows: row ? [{ doc: row.doc }] : [] };
      }
      if (text.includes("ORDER BY report_id")) {
        const [limit, offset] = params;
        return { rows: [...rows.values()].slice(offset, offset + limit).map((item) => ({ doc: item.doc })) };
      }
      throw new Error(`unexpected sql ${text}`);
    },
  };
}

function mockRdb(options = {}) {
  const rows = new Map();
  function run(state) {
    if (options.missing && state.action === "select") {
      return { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.assessment_reports_dev' in the schema cache" } };
    }
    if (state.action === "insert") {
      const payload = state.payload;
      if (options.alwaysDuplicate || rows.has(payload.report_id) || [...rows.values()].some((item) => item.source_submission_id === payload.source_submission_id)) {
        return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      rows.set(payload.report_id, payload);
      return { data: [payload], error: null };
    }
    if (state.action === "update") {
      const row = rows.get(state.filters.report_id);
      if (!row) return { data: [], error: null };
      const next = { ...row, ...state.payload };
      rows.set(state.filters.report_id, next);
      return { data: [next], error: null };
    }
    let list = [...rows.values()];
    for (const [key, value] of Object.entries(state.filters)) list = list.filter((row) => row[key] === value);
    if (state.range) list = list.slice(state.range[0], state.range[1] + 1);
    else list = list.slice(0, state.limit);
    return { data: list, error: null };
  }
  return {
    from() {
      const state = { action: "select", filters: {}, payload: null, limit: 100, range: null };
      const api = {
        select() { return api; },
        insert(row) { state.action = "insert"; state.payload = row; return api; },
        update(row) { state.action = "update"; state.payload = row; return api; },
        eq(key, value) { state.filters[key] = value; return api; },
        order() { return api; },
        limit(size) { state.limit = size; return api; },
        range(from, to) { state.range = [from, to]; return api; },
        then(resolve, reject) { return Promise.resolve(run(state)).then(resolve, reject); },
      };
      return api;
    },
  };
}

function sampleDoc() {
  return {
    reportId: "rpt_abcdefghijklmnopqrst",
    sourceSubmissionId: "sub_abcdefghij",
    bodyHash: "a",
    byteSize: 12,
    linkSecretHash: "b",
    ownerSecretHash: "c",
    shareStatus: "active",
    revokedAt: null,
    archiveStatus: "未归档",
    customerId: "",
    feishuSync: "待重试",
    feishuAttempts: 0,
    indexStatus: "待重试",
    createdAt: "2026-10-20T00:00:00.000Z",
    payload: { nickname: "小林", reportId: "rpt_abcdefghijklmnopqrst" },
    collection: "assessment_reports_dev",
  };
}

test("隔离表以外直接拒绝，未确认或没有云身份时不连接", async () => {
  assert.throws(() => assertDevCollection("assessment_reports"), /拒绝写入非隔离表/);
  const source = await readFile(new URL("./lib/store.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("database()"), false);
  assert.equal(source.includes("createCollection"), false);
  assert.equal(source.includes("文档型"), false);
  assert.match(source, /app\.rdb\(/);
  const sql = tableSql("assessment_reports_dev").join("\n");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "assessment_reports_dev"/);
  assert.match(sql, /report_id text PRIMARY KEY/);
  assert.match(sql, /doc jsonb NOT NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS "assessment_reports_dev_source_submission_id_uidx"/);
  await assert.rejects(() => createCloudBaseStore({ ASSESSMENT_STORE_DRIVER: "postgres" }), /未确认隔离写入/);
  await assert.rejects(() => createCloudBaseStore(confirmedEnv()), (error) => {
    assert.match(error.message, /没有云函数身份/);
    assert.equal(error.message.includes("文档型"), false);
    return true;
  });
  await assert.rejects(() => createCloudBaseStore(confirmedEnv({
    ASSESSMENT_COLLECTION: "assessment_reports",
  })), /拒绝写入非隔离表/);
  await assert.rejects(() => createCloudBaseStore(confirmedEnv({
    TCB_ENV: "other-env",
    TENCENTCLOUD_RUNENV: "SCF",
  })), /非授权环境/);
});

test("PostgreSQL mock：插入幂等、更新，rdb 缺表时给出建表 SQL", async () => {
  const db = mockSql();
  const store = await createCloudBaseStore(confirmedEnv(), db);
  assert.equal(store.driver, "postgres");
  assert.equal(store.collection, "assessment_reports_dev");
  assert.equal(db.statements.some((statement) => statement.startsWith("CREATE TABLE")), true);
  assert.equal(db.statements.some((statement) => statement.startsWith("CREATE UNIQUE INDEX")), true);

  const doc = sampleDoc();
  await store.insert(doc);
  await assert.rejects(() => store.insert({ ...doc }), (error) => {
    assert.equal(error.code, "duplicate");
    return true;
  });
  await assert.rejects(() => store.insert({
    ...doc,
    reportId: "rpt_zzzzzzzzzzzzzzzz",
  }), (error) => {
    assert.equal(error.code, "duplicate");
    return true;
  });

  const updated = await store.update(doc.reportId, {
    shareStatus: "revoked",
    revokedAt: "2026-10-20T01:00:00.000Z",
    feishuSync: "off",
    indexStatus: "off",
  });
  assert.equal(updated.shareStatus, "revoked");
  assert.equal(updated.feishuSync, "off");
  assert.equal(updated.payload.nickname, "小林");
  const byId = await store.getByReportId(doc.reportId);
  const bySubmission = await store.getBySubmission(doc.sourceSubmissionId);
  assert.equal(byId.shareStatus, "revoked");
  assert.equal(byId.revokedAt, "2026-10-20T01:00:00.000Z");
  assert.equal(bySubmission.feishuSync, "off");
  assert.equal((await store.all()).length, 1);
  assert.equal(await store.update("rpt_missingmissingmiss", { shareStatus: "revoked" }), null);

  const raced = {
    async query(text, params = []) {
      if (text.startsWith("CREATE")) return { rows: [] };
      if (text.startsWith("SELECT")) return { rows: [] };
      if (text.startsWith("INSERT")) {
        const error = new Error("duplicate key value violates unique constraint");
        error.code = "23505";
        throw error;
      }
      throw new Error(`unexpected sql ${text} ${params.length}`);
    },
  };
  const raceStore = await createCloudBaseStore(confirmedEnv({ ASSESSMENT_STORE_DRIVER: "cloudbase" }), raced);
  await assert.rejects(() => raceStore.insert(sampleDoc()), (error) => {
    assert.equal(error.code, "duplicate");
    return true;
  });

  await assert.rejects(() => createCloudBaseStore(confirmedEnv(), mockRdb({ missing: true })), (error) => {
    assert.match(error.message, /还没有表 assessment_reports_dev/);
    assert.match(error.message, /CREATE TABLE IF NOT EXISTS "assessment_reports_dev"/);
    assert.equal(error.message.includes("文档型"), false);
    return true;
  });

  const rdb = mockRdb();
  const viaRdb = await createCloudBaseStore(confirmedEnv(), rdb);
  const second = sampleDoc();
  second.reportId = "rpt_rdbrdbrdbrdbrdbrdb";
  second.sourceSubmissionId = "sub_rdbrdbrdb";
  await viaRdb.insert(second);
  await assert.rejects(() => viaRdb.insert({ ...second }), (error) => {
    assert.equal(error.code, "duplicate");
    return true;
  });
  const changed = await viaRdb.update(second.reportId, { shareStatus: "revoked", feishuSync: "off" });
  assert.equal(changed.shareStatus, "revoked");
  assert.equal((await viaRdb.getByReportId(second.reportId)).feishuSync, "off");
  assert.equal((await viaRdb.getBySubmission(second.sourceSubmissionId)).shareStatus, "revoked");
});

test("部署入口在确认开关打开时才允许监听，且拒绝内存库和飞书 live", () => {
  assert.equal(deployBlockReason({ ASSESSMENT_DEPLOY_CONFIRM: "" }), "hold");
  assert.equal(deployBlockReason({
    ASSESSMENT_DEPLOY_CONFIRM: "dev-isolated",
    ASSESSMENT_STORE_DRIVER: "memory",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
  }), "memory");
  assert.equal(deployBlockReason({
    ASSESSMENT_DEPLOY_CONFIRM: "dev-isolated",
    ASSESSMENT_STORE_DRIVER: "postgres",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    FEISHU_INDEX_MODE: "live",
  }), "feishu-live");
  assert.equal(deployBlockReason({
    ASSESSMENT_DEPLOY_CONFIRM: "dev-isolated",
    ASSESSMENT_STORE_DRIVER: "postgres",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    FEISHU_INDEX_MODE: "live",
    FEISHU_INDEX_LIVE_CONFIRM: "YES",
    FEISHU_ASSESSMENT_TABLE_ID: "tblTEST",
    FEISHU_APP_ID: "cli_aaff6cb53db89bd3",
    FEISHU_APP_SECRET: "test-secret",
    FEISHU_APP_TOKEN: "bascnTEST",
  }), "");
  assert.equal(deployBlockReason({
    ASSESSMENT_DEPLOY_CONFIRM: "dev-isolated",
    ASSESSMENT_STORE_DRIVER: "postgres",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    FEISHU_INDEX_MODE: "off",
  }), "");
  assert.equal(deployBlockReason({
    ASSESSMENT_DEPLOY_CONFIRM: "dev-isolated",
    ASSESSMENT_STORE_DRIVER: "cloudbase",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    FEISHU_INDEX_MODE: "off",
  }), "");
});

test("健康检查返回真实驱动；部署确认打开时 deployed 为 true", async () => {
  const off = createHandler({
    store: createMemoryStore("assessment_reports_dev"),
    feishu: createFeishuIndex({ FEISHU_INDEX_MODE: "off" }),
    silent: true,
  });
  const hidden = await off.handle({ method: "GET", path: "/health", headers: {} });
  assert.equal(hidden.body.store, "memory");
  assert.equal(hidden.body.deployed, false);
  assert.equal(hidden.body.feishu, "off");

  const on = createHandler({
    store: { ...createMemoryStore("assessment_reports_dev"), driver: "postgres" },
    feishu: createFeishuIndex({ FEISHU_INDEX_MODE: "off" }),
    deployed: true,
    silent: true,
  });
  const shown = await on.handle({ method: "GET", path: "/assessmentReportDev/health", headers: {} });
  assert.equal(shown.body.store, "postgres");
  assert.equal(shown.body.deployed, true);
  assert.equal(shown.body.service, "assessmentReportDev");
});

test("本地 HTTP 默认内存库，函数前缀下的健康检查同样可读", async () => {
  const previous = {
    driver: process.env.ASSESSMENT_STORE_DRIVER,
    confirm: process.env.ASSESSMENT_DEPLOY_CONFIRM,
    feishu: process.env.FEISHU_INDEX_MODE,
    silent: process.env.SILENT,
  };
  process.env.ASSESSMENT_STORE_DRIVER = "memory";
  delete process.env.ASSESSMENT_DEPLOY_CONFIRM;
  process.env.FEISHU_INDEX_MODE = "off";
  process.env.SILENT = "1";
  const server = await startLocalServer({ host: "127.0.0.1", port: 0 });
  try {
    const port = server.address().port;
    const body = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(body.store, "memory");
    assert.equal(body.deployed, false);
    assert.equal(body.feishu, "off");
    assert.equal(body.collection, "assessment_reports_dev");
    const prefixed = await (await fetch(`http://127.0.0.1:${port}/assessmentReportDev/health`)).json();
    assert.equal(prefixed.store, "memory");
    assert.equal(prefixed.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries({
      ASSESSMENT_STORE_DRIVER: previous.driver,
      ASSESSMENT_DEPLOY_CONFIRM: previous.confirm,
      FEISHU_INDEX_MODE: previous.feishu,
      SILENT: previous.silent,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("手机预览只带六芒星，阅读页指向 preview，来源加入白名单", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "star-preview-"));
  await buildPreview(dir);
  const config = await readFile(path.join(dir, "js/assessment-cloud-config.mjs"), "utf8");
  assert.match(config, new RegExp(HTTP_ORIGIN.replaceAll(".", "\\.")));
  assert.match(config, /\/assessment-report-dev\/preview\/r\//);
  assert.equal(config.includes(PREVIEW_REPORT_BASE), true);
  const home = await readFile(path.join(dir, "index.html"), "utf8");
  assert.match(home, /打开职业六芒星/);
  assert.equal(home.includes("asva-import"), false);
  const star = await readFile(path.join(dir, "star/index.html"), "utf8");
  assert.match(star, /noindex/);
  for (const rel of ["star/js/app.js", "star/js/data.js", "js/cloud-kit.js", "r/index.html", "js/assessment-cloud-config.mjs"]) {
    const fresh = await readFile(path.join(dir, rel), "utf8");
    const committed = await readFile(new URL(`./preview-site/${rel}`, import.meta.url), "utf8");
    assert.equal(committed, fresh, rel);
  }
  const production = await readFile(new URL("../../js/assessment-cloud-config.mjs", import.meta.url), "utf8");
  assert.equal(production.includes("/preview/r/"), false);

  assert.equal(normalizeRequestPath("/assessment-report-dev/preview/star/index.html"), "/preview/star/index.html");
  assert.equal(resolveStatic("/preview/../.env", { deployed: true }), null);
  assert.equal(resolveStatic("/star/index.html", { deployed: true }), null);
  assert.equal(resolveStatic("/star/index.html", { deployed: false }).endsWith(`${path.sep}star${path.sep}index.html`), true);

  const { handle } = app();
  const allowed = await handle({
    method: "POST",
    path: "/v1/results",
    headers: { origin: HTTP_ORIGIN },
    body: {},
    ip: "203.0.113.90",
    now: 9_000,
  });
  assert.equal(allowed.status, 422);
  assert.equal(allowed.headers["access-control-allow-origin"], HTTP_ORIGIN);

  const server = await startLocalServer({ host: "127.0.0.1", port: 0, deployed: true });
  try {
    const port = server.address().port;
    const page = await fetch(`http://127.0.0.1:${port}/assessment-report-dev/preview/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /打开职业六芒星/);
    const hidden = await fetch(`http://127.0.0.1:${port}/star/index.html`);
    assert.equal(hidden.status, 404);
    const cross = await fetch(`http://127.0.0.1:${port}/v1/results`, {
      method: "POST",
      headers: { origin: HTTP_ORIGIN, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(cross.status, 422);
    assert.equal(cross.headers.get("access-control-allow-origin"), HTTP_ORIGIN);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function sefsBody(answers, id = ids()) {
  const payload = buildSefsResult({
    nickname: "小林",
    answers,
    completedAt: "2026-10-22T12:00:00+08:00",
    ...id,
  });
  return { payload, ...id };
}

test("SEFS 合法结果可以保存，飞书行带分享链接；作答被改过仍是 422", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store } = app({ feishu });
  const answers = Array(24).fill(0);
  for (let i = 6; i < 12; i += 1) answers[i] = 3;
  const made = sefsBody(answers);
  assert.equal(made.payload.result.headline, "相对突出的体验方向：体验容纳（体验泛滥型）");
  assert.equal(made.payload.result.summary.includes("先关注当下的安全感和稳定感"), true);
  assert.deepEqual(made.payload.dimensions.map((item) => item.id), ["breadth", "capacity", "belonging", "autonomy"]);
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  }, { headers: { origin: "https://xiangshu3721.github.io" }, ip: "203.0.113.70" });
  assert.equal(created.status, 200);
  assert.equal(created.headers["access-control-allow-origin"], "https://xiangshu3721.github.io");
  assert.equal(feishu.rows.length, 1);
  assert.equal(feishu.rows[0]["测评 ID"], "sefs");
  assert.equal(feishu.rows[0]["测评名称"], "SEFS · 主观体验功能状态量表");
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
  assert.equal(feishu.rows[0]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(feishu.rows[0]["分享链接"].includes("rpt_"), false);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.71" });
  assert.equal(read.status, 200);
  assert.equal(read.body.assessmentId, "sefs");
  const revoked = await post({ handle }, "/v1/results/revoke", {
    reportId: made.reportId, ownerToken: made.ownerToken,
  }, { ip: "203.0.113.72" });
  assert.equal(revoked.status, 200);

  const broken = sefsBody(answers);
  broken.payload.dimensions[1].score = 1;
  const invalid = await post({ handle }, "/v1/results", {
    result: broken.payload, linkSecret: broken.linkSecret, ownerToken: broken.ownerToken,
  }, { ip: "203.0.113.73" });
  assert.equal(invalid.status, 422);
  const short = sefsBody(answers.slice(0, 23));
  assert.equal(short.payload, null);
  const named = sefsBody(answers);
  named.payload.assessmentName = "主观体验";
  assert.equal((await post({ handle }, "/v1/results", {
    result: named.payload, linkSecret: named.linkSecret, ownerToken: named.ownerToken,
  }, { ip: "203.0.113.74" })).status, 422);
  assert.equal(store.size(), 1);
});

function scl90Body(answers, id = ids()) {
  const payload = buildScl90Result({
    nickname: "小林",
    answers,
    completedAt: "2026-10-22T20:00:00+08:00",
    ...id,
  });
  return { payload, ...id };
}

test("SCL-90 按因子重算后可保存，改分数或未放行测评仍是 422，SEFS 仍可保存", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store } = app({ feishu });
  const answers = Array(90).fill(1);
  for (const n of [1, 4, 12, 27, 40, 42, 48, 49, 52, 53, 56, 58]) answers[n - 1] = 3;
  const made = scl90Body(answers);
  assert.equal(made.payload.dimensions[0].id, "som");
  assert.equal(made.payload.dimensions[0].raw, 36);
  assert.equal(made.payload.dimensions[0].score, 3);
  assert.equal(made.payload.dimensions[0].level, "mild");
  assert.equal(made.payload.result.headline, "筛查阳性");
  assert.deepEqual(made.payload.dimensions.map((item) => item.id), ["som", "oc", "is", "dep", "anx", "hos", "phob", "par", "psy", "add"]);
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  }, { headers: { origin: "https://xiangshu3721.github.io" }, ip: "203.0.113.80" });
  assert.equal(created.status, 200);
  assert.equal(feishu.rows[0]["测评 ID"], "scl90");
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
  assert.equal(JSON.stringify(feishu.rows[0]).includes(JSON.stringify(answers)), false);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.81" });
  assert.equal(read.status, 200);
  assert.equal(read.body.assessmentId, "scl90");
  assert.equal(read.body.dimensions[3].id, "dep");
  assert.equal(read.body.dimensions[3].score, 1);

  const calm = scl90Body(Array(90).fill(1));
  assert.equal(calm.payload.result.headline, "筛查阴性");
  assert.equal(calm.payload.reportContent.viewModel.positiveMean, null);
  assert.equal((await post({ handle }, "/v1/results", {
    result: calm.payload, linkSecret: calm.linkSecret, ownerToken: calm.ownerToken,
  }, { ip: "203.0.113.82" })).status, 200);

  const addOnly = Array(90).fill(1);
  for (const n of [19, 44, 59, 60, 64, 66, 89]) addOnly[n - 1] = 5;
  const additional = scl90Body(addOnly);
  assert.equal(additional.payload.result.headline, "筛查阴性");
  assert.equal(additional.payload.dimensions[9].score, 5);

  const broken = scl90Body(answers);
  broken.payload.dimensions[0].score = 1;
  assert.equal((await post({ handle }, "/v1/results", {
    result: broken.payload, linkSecret: broken.linkSecret, ownerToken: broken.ownerToken,
  }, { ip: "203.0.113.83" })).status, 422);
  const short = scl90Body(answers.slice(0, 89));
  assert.equal(short.payload, null);
  const named = scl90Body(answers);
  named.payload.assessmentName = "症状清单";
  assert.equal((await post({ handle }, "/v1/results", {
    result: named.payload, linkSecret: named.linkSecret, ownerToken: named.ownerToken,
  }, { ip: "203.0.113.84" })).status, 422);

  const sefsAnswers = Array(24).fill(0);
  for (let i = 6; i < 12; i += 1) sefsAnswers[i] = 3;
  const sefs = buildSefsResult({
    nickname: "小林",
    answers: sefsAnswers,
    completedAt: "2026-10-22T12:00:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: sefs, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.85" })).status, 200);
  assert.equal(store.size(), 3);
});

const PDQ4_SCALE_IDS = ["par", "szd", "szt", "ant", "bor", "his", "nar", "avo", "dep", "ocp", "pag", "dps"];

function pdq4Body(answers, extra = {}, id = ids()) {
  const payload = buildPdq4Result({
    nickname: "小林",
    answers,
    completedAt: "2026-10-22T21:00:00+08:00",
    ...extra,
    ...id,
  });
  return { payload, ...id };
}

test("PDQ-4 按十二量表重算后可保存，改分数或未放行测评仍是 422，已放行测评仍可保存", async () => {
  const blank = Array(126).fill(0);
  const allYes = Array(126).fill(1);
  const mixed = blank.slice();
  for (let i = 0; i < mixed.length; i += 1) if (i % 3 === 0) mixed[i] = 1;
  for (const answers of [blank, allYes, mixed]) {
    assert.deepEqual(cloudScorePdq4(answers), pageScorePdq4(answers));
  }

  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store, logs } = app({ feishu });
  const answers = blank.slice();
  for (const n of [11, 24, 37, 50]) answers[n - 1] = 1;
  for (const n of [106, 107]) answers[n - 1] = 1;
  answers[59] = 1;
  const made = pdq4Body(answers, { rushed: true });
  assert.equal(made.payload.assessmentId, "pdq4");
  assert.equal(made.payload.assessmentName.includes("PDQ-4"), true);
  assert.equal(made.payload.assessmentName.includes("人格障碍筛查"), true);
  assert.deepEqual(made.payload.dimensions.map((item) => item.id), PDQ4_SCALE_IDS);
  assert.equal(made.payload.dimensions.find((item) => item.id === "par").score, 4);
  assert.equal(made.payload.dimensions.find((item) => item.id === "par").positive, true);
  assert.equal(made.payload.dimensions.find((item) => item.id === "bor").score, 1);
  assert.equal(made.payload.reportContent.viewModel.impulse.point, 1);
  assert.equal(made.payload.reportContent.viewModel.conduct.point, 0);
  assert.equal(made.payload.reportContent.viewModel.tooGood.flagged, true);
  assert.equal(made.payload.reportContent.viewModel.suspect.flagged, false);
  assert.equal(made.payload.result.code, "too-good");
  assert.deepEqual(made.payload.extensionData.score, pageScorePdq4(answers));
  const created = await post({ handle }, "/v1/results", {
    result: made.payload, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  }, { headers: { origin: "https://xiangshu3721.github.io" }, ip: "203.0.113.90" });
  assert.equal(created.status, 200);
  assert.equal(feishu.rows[0]["测评 ID"], "pdq4");
  assert.equal(feishu.rows[0]["测评名称"].includes("PDQ-4"), true);
  assert.equal(feishu.rows[0]["测评名称"].includes("人格障碍筛查"), true);
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
  assert.equal(feishu.rows[0]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(JSON.stringify(feishu.rows[0]).includes(JSON.stringify(answers)), false);
  assert.equal(JSON.stringify(logs).includes(JSON.stringify(answers)), false);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.91" });
  assert.equal(read.status, 200);
  assert.equal(read.body.assessmentId, "pdq4");
  assert.equal(read.body.dimensions.find((item) => item.id === "szd").score, 1);
  assert.equal(read.body.dimensions.find((item) => item.id === "szt").score, 1);
  const revoked = await post({ handle }, "/v1/results/revoke", {
    reportId: made.reportId, ownerToken: made.ownerToken,
  }, { ip: "203.0.113.92" });
  assert.equal(revoked.status, 200);
  assert.equal(feishu.rows[0]["报告状态"], "已撤销");
  const after = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.93" });
  assert.equal(after.status, 410);

  const none = pdq4Body(blank);
  assert.equal(none.payload.result.code, "too-good-clear");
  assert.equal(none.payload.reportContent.viewModel.positiveCount, 0);
  assert.equal((await post({ handle }, "/v1/results", {
    result: none.payload, linkSecret: none.linkSecret, ownerToken: none.ownerToken,
  }, { ip: "203.0.113.94" })).status, 200);
  const every = pdq4Body(allYes);
  assert.equal(every.payload.reportContent.viewModel.positiveCount, 12);
  assert.equal(every.payload.reportContent.viewModel.impulse.point, 1);
  assert.equal(every.payload.reportContent.viewModel.conduct.point, 1);
  assert.equal(every.payload.reportContent.viewModel.suspect.flagged, true);
  assert.equal(every.payload.result.code, "suspect");
  assert.equal((await post({ handle }, "/v1/results", {
    result: every.payload, linkSecret: every.linkSecret, ownerToken: every.ownerToken,
  }, { ip: "203.0.113.95" })).status, 200);

  const broken = pdq4Body(answers);
  broken.payload.dimensions[0].score = 0;
  assert.equal((await post({ handle }, "/v1/results", {
    result: broken.payload, linkSecret: broken.linkSecret, ownerToken: broken.ownerToken,
  }, { ip: "203.0.113.96" })).status, 422);
  const named = pdq4Body(answers);
  named.payload.assessmentName = "PDQ-4";
  assert.equal((await post({ handle }, "/v1/results", {
    result: named.payload, linkSecret: named.linkSecret, ownerToken: named.ownerToken,
  }, { ip: "203.0.113.97" })).status, 422);
  const short = pdq4Body(answers.slice(0, 125));
  assert.equal(short.payload, null);
  const blocked = result();
  blocked.payload.assessmentId = "beattie";
  const rejected = await post({ handle }, "/v1/results", {
    result: blocked.payload, linkSecret: blocked.linkSecret, ownerToken: blocked.ownerToken,
  }, { ip: "203.0.113.98" });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.issues.includes("测评不在可保存范围内"), true);

  const star = result();
  assert.equal((await post({ handle }, "/v1/results", {
    result: star.payload, linkSecret: star.linkSecret, ownerToken: star.ownerToken,
  }, { ip: "203.0.113.99" })).status, 200);
  const sefsAnswers = Array(24).fill(0);
  for (let i = 6; i < 12; i += 1) sefsAnswers[i] = 3;
  const sefs = buildSefsResult({
    nickname: "小林",
    answers: sefsAnswers,
    completedAt: "2026-10-22T12:00:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: sefs, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.100" })).status, 200);
  const scl = buildScl90Result({
    nickname: "小林",
    answers: Array(90).fill(1),
    completedAt: "2026-10-22T20:00:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: scl, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.101" })).status, 200);
  assert.equal(store.size(), 6);
});

const ECR_REVERSE = new Set(ECR_REVERSE_ITEMS);

function ecrPattern({ avoidance = 1, anxiety = 1 } = {}) {
  return Array.from({ length: 36 }, (_, index) => {
    const n = index + 1;
    const want = n % 2 === 1 ? avoidance : anxiety;
    return ECR_REVERSE.has(n) ? 8 - want : want;
  });
}

function ecrBody(answers, extra = {}, id = ids()) {
  const payload = buildEcrResult({
    nickname: "小林",
    answers,
    completedAt: "2026-10-22T22:00:00+08:00",
    ...extra,
    ...id,
  });
  return { payload, ...id };
}

test("ECR 按三十六题重算后可保存，错误测评或作答长度仍是 422，已放行测评仍可保存", async () => {
  const fours = Array(36).fill(4);
  const ones = Array(36).fill(1);
  const sevens = Array(36).fill(7);
  const samples = [
    fours,
    ones,
    sevens,
    ecrPattern({ avoidance: 1, anxiety: 1 }),
    ecrPattern({ avoidance: 1, anxiety: 7 }),
    ecrPattern({ avoidance: 7, anxiety: 1 }),
    ecrPattern({ avoidance: 7, anxiety: 7 }),
    ecrPattern({ avoidance: 3, anxiety: 1 }),
    ecrPattern({ avoidance: 3, anxiety: 2 }),
  ];
  for (const answers of samples) {
    assert.deepEqual(cloudScoreEcr(answers), pageScoreEcr(answers));
  }

  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store, logs } = app({ feishu });
  const made = ecrBody(fours, { rushed: true });
  const wire = JSON.parse(JSON.stringify(made.payload));
  assert.deepEqual(validateAssessmentResult(made.payload), []);
  assert.deepEqual(validateAssessmentResult(wire), []);
  assert.equal(made.payload.assessmentId, "ecr");
  assert.equal(made.payload.assessmentName.includes("ECR"), true);
  assert.equal(made.payload.assessmentName.includes("亲密关系经历量表"), true);
  assert.deepEqual(made.payload.dimensions.map((item) => item.id), ["avoidance", "anxiety"]);
  assert.equal(made.payload.dimensions[0].score, 4);
  assert.equal(made.payload.dimensions[0].raw, 72);
  assert.equal(made.payload.dimensions[1].score, 4);
  assert.equal(made.payload.result.code, "fearful");
  assert.equal(made.payload.reportContent.viewModel.quadrant, null);
  assert.equal(made.payload.reportContent.viewModel.nearMidpoint, true);
  assert.equal(made.payload.reportContent.viewModel.rushed, true);
  assert.equal(made.payload.source.origin, "external-repo");
  assert.equal(made.payload.source.repo, "mindtest");
  assert.equal(made.payload.source.path, "ecr/index.html");
  assert.equal(made.payload.source.resultKitId, "ecr");
  assert.deepEqual(made.payload.extensionData.score, pageScoreEcr(fours));
  const created = await post({ handle }, "/v1/results", {
    result: wire, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  }, { headers: { origin: "https://xiangshu3721.github.io" }, ip: "203.0.113.110" });
  assert.equal(created.status, 200);
  assert.equal(feishu.rows[0]["测评 ID"], "ecr");
  assert.equal(feishu.rows[0]["测评名称"].includes("ECR"), true);
  assert.equal(feishu.rows[0]["测评名称"].includes("亲密关系经历量表"), true);
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
  assert.equal(feishu.rows[0]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(JSON.stringify(feishu.rows[0]).includes(JSON.stringify(fours)), false);
  assert.equal(JSON.stringify(logs).includes(JSON.stringify(fours)), false);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.111" });
  assert.equal(read.status, 200);
  assert.equal(read.body.assessmentId, "ecr");
  assert.equal(read.body.dimensions[0].id, "avoidance");
  assert.equal(read.body.dimensions[0].score, 4);
  assert.equal(read.body.result.code, "fearful");
  const revoked = await post({ handle }, "/v1/results/revoke", {
    reportId: made.reportId, ownerToken: made.ownerToken,
  }, { ip: "203.0.113.112" });
  assert.equal(revoked.status, 200);
  assert.equal(feishu.rows[0]["报告状态"], "已撤销");

  const secure = ecrBody(ecrPattern({ avoidance: 1, anxiety: 1 }), {}, {
    reportId: `rpt_${"e".repeat(11)}`,
    clientSubmissionId: `sub_${"c".repeat(8)}`,
    linkSecret: "f".repeat(16),
    ownerToken: "g".repeat(16),
  });
  assert.equal(secure.payload.result.code, "secure");
  assert.equal((await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(secure.payload)),
    linkSecret: secure.linkSecret,
    ownerToken: secure.ownerToken,
  }, { ip: "203.0.113.113" })).status, 200);
  assert.equal(feishu.rows[1]["分享链接"], `https://xiangshu3721.github.io/mindtest-web/r/#${"e".repeat(11)}.${"f".repeat(16)}`);

  const edge = ecrBody(ecrPattern({ avoidance: 3, anxiety: 1 }));
  assert.equal(edge.payload.result.code, "dismissing");
  assert.equal(edge.payload.reportContent.viewModel.quadrant, "secure");
  assert.equal(edge.payload.reportContent.viewModel.differsFromQuadrant, true);
  assert.equal(edge.payload.result.flags.includes("differs-from-quadrant"), true);
  assert.equal((await post({ handle }, "/v1/results", {
    result: edge.payload, linkSecret: edge.linkSecret, ownerToken: edge.ownerToken,
  }, { ip: "203.0.113.114" })).status, 200);

  const wide = ecrBody(ones, {}, {
    reportId: `rpt_${"h".repeat(64)}`,
    clientSubmissionId: `sub_${"k".repeat(64)}`,
    linkSecret: "i".repeat(128),
    ownerToken: "j".repeat(128),
  });
  assert.equal(wide.payload.dimensions[0].score, 4);
  assert.equal(wide.payload.dimensions[1].score, 1.33);
  assert.equal(wide.payload.result.code, "dismissing");
  assert.equal((await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(wide.payload)),
    linkSecret: wide.linkSecret,
    ownerToken: wide.ownerToken,
  }, { ip: "203.0.113.115" })).status, 200);

  const broken = ecrBody(fours);
  broken.payload.dimensions[0].score = 1;
  assert.equal((await post({ handle }, "/v1/results", {
    result: broken.payload, linkSecret: broken.linkSecret, ownerToken: broken.ownerToken,
  }, { ip: "203.0.113.116" })).status, 422);
  const renamed = ecrBody(fours);
  renamed.payload.assessmentName = "ECR";
  assert.equal((await post({ handle }, "/v1/results", {
    result: renamed.payload, linkSecret: renamed.linkSecret, ownerToken: renamed.ownerToken,
  }, { ip: "203.0.113.117" })).status, 422);
  const shifted = ecrBody(fours);
  shifted.payload.extensionData.score.avoidance.mean = 1;
  assert.equal((await post({ handle }, "/v1/results", {
    result: shifted.payload, linkSecret: shifted.linkSecret, ownerToken: shifted.ownerToken,
  }, { ip: "203.0.113.118" })).status, 422);

  assert.equal(ecrBody(fours.slice(0, 35)).payload, null);
  assert.equal(ecrBody(Array(36).fill(0)).payload, null);
  assert.equal(ecrBody(Array(36).fill(8)).payload, null);
  const short = ecrBody(fours);
  const shortAnswers = fours.slice(0, 35);
  short.payload.reportContent.viewModel.answers = shortAnswers;
  short.payload.extensionData.answers = shortAnswers.slice();
  const shortResult = await post({ handle }, "/v1/results", {
    result: short.payload, linkSecret: short.linkSecret, ownerToken: short.ownerToken,
  }, { ip: "203.0.113.119" });
  assert.equal(shortResult.status, 422);
  assert.equal(shortResult.body.issues.includes("作答需要 36 道 1–7 的整数题"), true);
  assert.equal(validateAssessmentResult(short.payload).includes("作答需要 36 道 1–7 的整数题"), true);

  const blocked = ecrBody(fours);
  blocked.payload.assessmentId = "beattie";
  const rejected = await post({ handle }, "/v1/results", {
    result: blocked.payload, linkSecret: blocked.linkSecret, ownerToken: blocked.ownerToken,
  }, { ip: "203.0.113.120" });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.issues.includes("测评不在可保存范围内"), true);
  assert.equal(validateAssessmentResult(blocked.payload).includes("测评不在可保存范围内"), true);

  const star = result();
  assert.equal((await post({ handle }, "/v1/results", {
    result: star.payload, linkSecret: star.linkSecret, ownerToken: star.ownerToken,
  }, { ip: "203.0.113.121" })).status, 200);
  const sefsAnswers = Array(24).fill(0);
  for (let i = 6; i < 12; i += 1) sefsAnswers[i] = 3;
  const sefs = buildSefsResult({
    nickname: "小林",
    answers: sefsAnswers,
    completedAt: "2026-10-22T12:00:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: sefs, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.122" })).status, 200);
  const scl = buildScl90Result({
    nickname: "小林",
    answers: Array(90).fill(1),
    completedAt: "2026-10-22T20:00:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: scl, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.123" })).status, 200);
  const pdq = buildPdq4Result({
    nickname: "小林",
    answers: Array(126).fill(0),
    completedAt: "2026-10-22T21:00:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: pdq, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.124" })).status, 200);
  assert.equal(store.size(), 8);
});

test("其他测评页面没有接上云端块", async () => {
  for (const file of ["index.html", "ecr/index.html", "pdq/index.html", "scl90/index.html", "beattie/index.html"]) {
    const text = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.equal(text.includes("cloud-kit"), false);
    assert.equal(text.includes("star-cloud"), false);
  }
});

function rootBody(answers, developmentAnswers, extra = {}, id = ids()) {
  const payload = buildRootResult({
    nickname: "小林",
    answers,
    developmentAnswers,
    completedAt: "2026-10-23T09:00:00+08:00",
    ...extra,
    ...id,
  });
  return { payload, ...id };
}

test("寻根之旅按三十三题和四道发展题重算后可保存，错误作答或未知测评仍是 422，已放行测评仍可保存", async () => {
  assert.deepEqual(ALLOWED_ASSESSMENT_IDS, [
    "star", "sefs", "scl90", "pdq4", "ecr", "root", "loves5", "juying", "holland",
    "zhenai", "gcd", "sensmap",
    "beattie-emotional-health", "beattie-anger", "beattie-fear", "beattie-drama", "beattie-guilt", "beattie-grief",
  ]);
  const threes = Array(33).fill(3);
  const dev = [3, 3, 3, 3];
  const uniform = scoreRoot(threes);
  for (const id of ["self_awareness", "autonomy_boundary", "emotion_awareness", "emotional_independence", "listening_understanding", "gentle_expression", "self_worth", "value_realization"]) {
    assert.equal(uniform.dimensionScores[id], 50);
  }
  assert.equal(uniform.contextVariances.self_awareness, "low");
  assert.equal(uniform.contextVariances.self_worth, "high");
  assert.deepEqual(uniform.moduleScores, {
    subjectivity: 50,
    emotion: 50,
    relationship: 50,
    value: 50,
  });
  const ones = Array(33).fill(1);
  assert.equal(scoreRoot(ones).dimensionScores.self_awareness, 31);
  const climateShift = threes.slice();
  climateShift[28] = 5;
  assert.deepEqual(scoreRoot(climateShift).dimensionScores, uniform.dimensionScores);

  assert.equal(rootBody(threes.slice(0, 32), dev).payload, null);
  assert.equal(rootBody(Array(33).fill(0), dev).payload, null);
  assert.equal(rootBody(Array(33).fill(6), dev).payload, null);
  assert.equal(rootBody(threes, dev.slice(0, 3)).payload, null);
  assert.equal(rootBody(threes, [0, 1, 2, 3]).payload, null);
  assert.equal(rootBody(threes, dev, { nickname: "13800138000" }).payload, null);
  assert.equal(rootBody(threes, dev, { nickname: "" }).payload, null);

  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store, logs } = app({ feishu });
  const made = rootBody(threes, dev, { rushed: true });
  const wire = JSON.parse(JSON.stringify(made.payload));
  assert.deepEqual(validateAssessmentResult(made.payload), []);
  assert.deepEqual(validateAssessmentResult(wire), []);
  assert.equal(made.payload.assessmentId, "root");
  assert.equal(made.payload.assessmentVersion, "root-h5-v1");
  assert.equal(made.payload.assessmentName.includes("寻根"), true);
  assert.equal(made.payload.assessmentName.includes("生命成长地图"), true);
  assert.deepEqual(made.payload.dimensions.map((item) => item.id), [
    "self_awareness",
    "autonomy_boundary",
    "emotion_awareness",
    "emotional_independence",
    "listening_understanding",
    "gentle_expression",
    "self_worth",
    "value_realization",
    "subjectivity",
    "emotion",
    "relationship",
    "value",
  ]);
  assert.equal(made.payload.dimensions[0].score, 50);
  assert.equal(made.payload.dimensions[0].levelLabel, "值得关注");
  assert.equal(made.payload.dimensions[6].extra.contextVariance, "high");
  assert.equal(made.payload.dimensions[8].score, 50);
  assert.equal(made.payload.result.headline, "我的生命成长地图");
  assert.equal(made.payload.result.flags.includes("variance-high:self_worth"), true);
  assert.equal(made.payload.reportContent.viewModel.rushed, true);
  assert.equal(made.payload.reportContent.viewModel.familyClimate[0].name, "高期待");
  assert.equal(made.payload.reportContent.viewModel.familyClimate[0].levelLabel, "一般");
  assert.deepEqual(made.payload.reportContent.viewModel.development.map((item) => item.id), [
    "initiative", "identity", "intimacy", "generativity",
  ]);
  assert.deepEqual(made.payload.extensionData.score.familyClimate, [3, 3, 3, 3, 3]);
  assert.equal(made.payload.extensionData.compat.level, "partial");
  assert.equal(made.payload.source.origin, "external-repo");
  assert.equal(made.payload.source.repo, "root-journey-web");
  assert.equal(made.payload.source.path, "index.html");
  assert.equal(made.payload.source.resultKitId, "root");
  const named = rootBody(threes, dev);
  named.payload.assessmentName = "寻根之旅";
  assert.deepEqual(validateAssessmentResult(named.payload), []);
  named.payload.assessmentName = "生命成长地图";
  assert.deepEqual(validateAssessmentResult(named.payload), []);
  named.payload.assessmentName = "家庭模式";
  assert.equal(validateAssessmentResult(named.payload).includes("测评名称不对"), true);
  const oldVersion = rootBody(threes, dev);
  oldVersion.payload.assessmentVersion = "2.0";
  assert.equal(validateAssessmentResult(oldVersion.payload).includes("规则版本不对"), true);
  const archivedConsent = rootBody(threes, dev);
  archivedConsent.payload.extensionData.consent.scopes = ["store", "share_link", "mentor_read", "journey_archive"];
  assert.equal(validateAssessmentResult(archivedConsent.payload).includes("同意范围不能包含档案或电话"), true);

  const created = await post({ handle }, "/v1/results", {
    result: wire, linkSecret: made.linkSecret, ownerToken: made.ownerToken,
  }, { headers: { origin: "https://xiangshu3721.github.io" }, ip: "203.0.113.140" });
  assert.equal(created.status, 200);
  assert.equal(feishu.rows[0]["测评 ID"], "root");
  assert.equal(feishu.rows[0]["测评名称"].includes("寻根"), true);
  assert.equal(feishu.rows[0]["测评名称"].includes("生命成长地图"), true);
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(made.reportId, made.linkSecret));
  assert.equal(JSON.stringify(feishu.rows[0]).includes(JSON.stringify(threes)), false);
  assert.equal(JSON.stringify(logs).includes(JSON.stringify(threes)), false);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: made.reportId, linkSecret: made.linkSecret,
  }, { ip: "203.0.113.141" });
  assert.equal(read.status, 200);
  assert.equal(read.body.assessmentId, "root");
  assert.equal(read.body.assessmentVersion, "root-h5-v1");
  assert.equal(read.body.dimensions[0].id, "self_awareness");
  assert.equal(read.body.dimensions[0].score, 50);
  assert.equal(read.body.dimensions[8].id, "subjectivity");
  const revoked = await post({ handle }, "/v1/results/revoke", {
    reportId: made.reportId, ownerToken: made.ownerToken,
  }, { ip: "203.0.113.142" });
  assert.equal(revoked.status, 200);

  const broken = rootBody(threes, dev);
  broken.payload.dimensions[0].score = 15;
  assert.equal((await post({ handle }, "/v1/results", {
    result: broken.payload, linkSecret: broken.linkSecret, ownerToken: broken.ownerToken,
  }, { ip: "203.0.113.143" })).status, 422);

  const short = rootBody(threes, dev);
  const shortAnswers = threes.slice(0, 32);
  short.payload.reportContent.viewModel.answers = shortAnswers;
  short.payload.extensionData.answers = shortAnswers.slice();
  const shortResult = await post({ handle }, "/v1/results", {
    result: short.payload, linkSecret: short.linkSecret, ownerToken: short.ownerToken,
  }, { ip: "203.0.113.144" });
  assert.equal(shortResult.status, 422);
  assert.equal(shortResult.body.issues.includes("作答需要 33 道 1–5 的整数题（28 项能力 + 5 道家庭氛围）"), true);

  const badDev = rootBody(threes, dev);
  badDev.payload.reportContent.viewModel.developmentAnswers = [1, 2, 3];
  badDev.payload.extensionData.developmentAnswers = [1, 2, 3];
  const badDevResult = await post({ handle }, "/v1/results", {
    result: badDev.payload, linkSecret: badDev.linkSecret, ownerToken: badDev.ownerToken,
  }, { ip: "203.0.113.145" });
  assert.equal(badDevResult.status, 422);
  assert.equal(badDevResult.body.issues.includes("发展题需要 4 道 1–5 的整数题"), true);

  const outOfRange = rootBody(threes, dev);
  const sixes = Array(33).fill(6);
  outOfRange.payload.reportContent.viewModel.answers = sixes;
  outOfRange.payload.extensionData.answers = sixes.slice();
  const outResult = await post({ handle }, "/v1/results", {
    result: outOfRange.payload, linkSecret: outOfRange.linkSecret, ownerToken: outOfRange.ownerToken,
  }, { ip: "203.0.113.146" });
  assert.equal(outResult.status, 422);
  assert.equal(outResult.body.issues.includes("作答需要 33 道 1–5 的整数题（28 项能力 + 5 道家庭氛围）"), true);

  const phone = rootBody(threes, dev);
  phone.payload.extensionData.phone = "13800138000";
  const phoneResult = await post({ handle }, "/v1/results", {
    result: phone.payload, linkSecret: phone.linkSecret, ownerToken: phone.ownerToken,
  }, { ip: "203.0.113.147" });
  assert.equal(phoneResult.status, 422);
  assert.equal(phoneResult.body.issues.some((item) => item.includes("不在可保存范围内")), true);

  const parents = rootBody(threes, dev);
  parents.payload.extensionData.people = { father: { lifeEvents: "父母原文" } };
  const parentResult = await post({ handle }, "/v1/results", {
    result: parents.payload, linkSecret: parents.linkSecret, ownerToken: parents.ownerToken,
  }, { ip: "203.0.113.148" });
  assert.equal(parentResult.status, 422);
  assert.equal(parentResult.body.issues.some((item) => item.includes("不能保存父母档案")), true);

  const blocked = rootBody(threes, dev);
  blocked.payload.assessmentId = "5loves";
  const rejected = await post({ handle }, "/v1/results", {
    result: blocked.payload, linkSecret: blocked.linkSecret, ownerToken: blocked.ownerToken,
  }, { ip: "203.0.113.149" });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.issues.includes("测评不在可保存范围内"), true);
  assert.equal(validateAssessmentResult(blocked.payload).includes("测评不在可保存范围内"), true);

  const star = result();
  assert.equal((await post({ handle }, "/v1/results", {
    result: star.payload, linkSecret: star.linkSecret, ownerToken: star.ownerToken,
  }, { ip: "203.0.113.150" })).status, 200);
  const sefsAnswers = Array(24).fill(0);
  for (let i = 6; i < 12; i += 1) sefsAnswers[i] = 3;
  const sefs = buildSefsResult({
    nickname: "小林",
    answers: sefsAnswers,
    completedAt: "2026-10-23T09:10:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: sefs, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.151" })).status, 200);
  const scl = buildScl90Result({
    nickname: "小林",
    answers: Array(90).fill(1),
    completedAt: "2026-10-23T09:20:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: scl, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.152" })).status, 200);
  const pdq = buildPdq4Result({
    nickname: "小林",
    answers: Array(126).fill(0),
    completedAt: "2026-10-23T09:30:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: pdq, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.153" })).status, 200);
  const ecr = buildEcrResult({
    nickname: "小林",
    answers: Array(36).fill(4),
    completedAt: "2026-10-23T09:40:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: ecr, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.154" })).status, 200);
  assert.equal(store.size(), 6);
});

function lovesPicks(side = "left") {
  return PAIRS.map((pair) => (side === "right" ? pair[1] : pair[0]));
}

function hollandTieBreak() {
  const answers = Array(60).fill(1);
  for (let block = 0; block < 10; block += 1) answers[block * 6] = 4;
  for (let block = 0; block < 5; block += 1) answers[block * 6 + 1] = 5;
  for (let block = 5; block < 10; block += 1) answers[block * 6 + 1] = 3;
  return answers;
}

function lovesBody(picks, extra = {}, id = ids()) {
  const payload = buildLoves5Result({
    nickname: "小林",
    picks,
    completedAt: "2026-10-23T10:00:00+08:00",
    ...extra,
    ...id,
  });
  return { payload, ...id };
}

function juyingBody(answers, extra = {}, id = ids()) {
  const payload = buildJuyingResult({
    nickname: "小林",
    answers,
    completedAt: "2026-10-23T10:10:00+08:00",
    ...extra,
    ...id,
  });
  return { payload, ...id };
}

function hollandBody(answers, extra = {}, id = ids()) {
  const payload = buildHollandResult({
    nickname: "小林",
    answers,
    completedAt: "2026-10-23T10:20:00+08:00",
    ...extra,
    ...id,
  });
  return { payload, ...id };
}

test("爱的 5 种语言、巨婴测评和霍兰德按作答重算后可保存，飞书行仍写测评名称和分享链接", async () => {
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const pair of PAIRS) {
    counts[pair[0]] += 1;
    counts[pair[1]] += 1;
  }
  assert.deepEqual(counts, { A: 12, B: 12, C: 12, D: 12, E: 12 });

  const left = lovesPicks("left");
  const right = lovesPicks("right");
  const leftScore = scoreLoves5(left);
  assert.equal(leftScore.total, 30);
  assert.equal(Object.values(leftScore.scores).every((value) => value <= 12), true);
  const rightScore = scoreLoves5(right);
  assert.deepEqual(
    LovesSum(leftScore.scores, rightScore.scores),
    { A: 12, B: 12, C: 12, D: 12, E: 12 },
  );

  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store, logs } = app({ feishu });
  const loves = lovesBody(left, { rushed: true });
  const lovesWire = JSON.parse(JSON.stringify(loves.payload));
  assert.deepEqual(validateAssessmentResult(loves.payload), []);
  assert.deepEqual(validateAssessmentResult(lovesWire), []);
  assert.equal(loves.payload.assessmentId, "loves5");
  assert.equal(loves.payload.assessmentVersion, "loves5-h5-v1");
  assert.equal(loves.payload.assessmentName, "爱的 5 种语言");
  assert.deepEqual(loves.payload.dimensions.map((item) => item.id), ["A", "B", "C", "D", "E"]);
  assert.equal(loves.payload.dimensions.reduce((sum, item) => sum + item.score, 0), 30);
  assert.equal(loves.payload.result.code, leftScore.primaries.join(""));
  assert.equal(loves.payload.reportContent.viewModel.rushed, true);
  const lovesSaved = await post({ handle }, "/v1/results", {
    result: lovesWire, linkSecret: loves.linkSecret, ownerToken: loves.ownerToken,
  }, { headers: { origin: "https://xiangshu3721.github.io" }, ip: "203.0.113.160" });
  assert.equal(lovesSaved.status, 200);
  assert.equal(feishu.rows[0]["测评 ID"], "loves5");
  assert.equal(feishu.rows[0]["测评名称"], "爱的 5 种语言");
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(loves.reportId, loves.linkSecret));
  assert.equal(feishu.rows[0]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(feishu.rows[0]["分享链接"].includes("rpt_"), false);
  assert.equal(JSON.stringify(feishu.rows[0]).includes(JSON.stringify(left)), false);
  assert.equal(JSON.stringify(logs).includes(JSON.stringify(left)), false);

  const badPick = lovesBody(left);
  badPick.payload.reportContent.viewModel.picks = left.map((code, index) => (index === 0 ? "Z" : code));
  badPick.payload.extensionData.answers = badPick.payload.reportContent.viewModel.picks.slice();
  const badPickResult = await post({ handle }, "/v1/results", {
    result: badPick.payload, linkSecret: badPick.linkSecret, ownerToken: badPick.ownerToken,
  }, { ip: "203.0.113.161" });
  assert.equal(badPickResult.status, 422);
  assert.equal(badPickResult.body.issues.includes("作答需要 30 道二选一，每题只能是该题的语言码"), true);

  const tampered = lovesBody(left);
  tampered.payload.dimensions[0].score = 0;
  assert.equal((await post({ handle }, "/v1/results", {
    result: tampered.payload, linkSecret: tampered.linkSecret, ownerToken: tampered.ownerToken,
  }, { ip: "203.0.113.162" })).status, 422);
  const renamed = lovesBody(left);
  renamed.payload.assessmentName = "五种爱语";
  assert.equal(validateAssessmentResult(renamed.payload).includes("测评名称不对"), true);
  assert.equal(lovesBody(left.slice(0, 29)).payload, null);
  assert.equal(buildLoves5Result({
    nickname: "13800138000",
    picks: left,
    completedAt: "2026-10-23T10:00:00+08:00",
    ...ids(),
  }), null);

  const bands = [
    [Array(20).fill(0), "mature", "心智成熟", 0],
    [Array(20).fill(2), "mature", "心智成熟", 40],
    [Array(20).fill(2).map((value, index) => (index === 0 ? 3 : value)), "partial", "有部分巨婴特质", 41],
    [Array(20).fill(3).map((value, index) => (index === 0 ? 2 : value)), "partial", "有部分巨婴特质", 59],
    [Array(20).fill(3), "infant", "巨婴", 60],
    [Array(20).fill(4), "infant", "巨婴", 80],
    [Array(20).fill(4).map((value, index) => (index === 0 ? 5 : value)), "child", "儿童状态", 81],
    [Array(20).fill(5), "child", "儿童状态", 100],
  ];
  for (const [answers, code, label, total] of bands) {
    const scored = scoreJuying(answers);
    assert.equal(scored.total, total);
    assert.equal(scored.mind + scored.act, total);
    assert.equal(scored.band.id, code);
    assert.equal(scored.band.name, label);
    const made = juyingBody(answers);
    assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(made.payload))), []);
    assert.equal(made.payload.result.code, code);
    assert.equal(made.payload.result.label, label);
    assert.equal(made.payload.dimensions.map((item) => item.id).join(","), "total,mind,act");
    const text = JSON.stringify(made.payload.interpretation.concat(made.payload.recommendations));
    assert.equal(text.includes("不是诊断"), true);
    assert.equal(text.includes("非严肃科学，仅供讲座听众理解学习。"), true);
  }
  const split = Array(10).fill(5).concat(Array(10).fill(0));
  const splitScore = scoreJuying(split);
  assert.equal(splitScore.mind, 50);
  assert.equal(splitScore.act, 0);
  assert.equal(splitScore.side.includes("心理特征比行为特征明显更高"), true);
  const juying = juyingBody(split, { rushed: false });
  const juyingSaved = await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(juying.payload)),
    linkSecret: juying.linkSecret,
    ownerToken: juying.ownerToken,
  }, { ip: "203.0.113.163" });
  assert.equal(juyingSaved.status, 200);
  assert.equal(feishu.rows[1]["测评 ID"], "juying");
  assert.equal(feishu.rows[1]["测评名称"], "巨婴测评");
  assert.equal(feishu.rows[1]["分享链接"], buildGithubShareUrl(juying.reportId, juying.linkSecret));
  assert.equal(feishu.rows[1]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  const shortJuying = juyingBody(Array(20).fill(2));
  shortJuying.payload.reportContent.viewModel.answers = Array(19).fill(2);
  shortJuying.payload.extensionData.answers = Array(19).fill(2);
  const shortJuyingResult = await post({ handle }, "/v1/results", {
    result: shortJuying.payload, linkSecret: shortJuying.linkSecret, ownerToken: shortJuying.ownerToken,
  }, { ip: "203.0.113.164" });
  assert.equal(shortJuyingResult.status, 422);
  assert.equal(shortJuyingResult.body.issues.includes("作答需要 20 道 0–5 的整数题"), true);
  assert.equal(juyingBody(Array(20).fill(6)).payload, null);
  const shifted = juyingBody(Array(20).fill(2));
  shifted.payload.extensionData.score.total = 100;
  assert.equal((await post({ handle }, "/v1/results", {
    result: shifted.payload, linkSecret: shifted.linkSecret, ownerToken: shifted.ownerToken,
  }, { ip: "203.0.113.165" })).status, 422);

  const flat = Array(60).fill(3);
  const flatScore = scoreHolland(flat);
  assert.equal(flatScore.holland_code, "RIA");
  assert.deepEqual(flatScore.ranking, ["R", "I", "A", "S", "E", "C"]);
  assert.deepEqual(flatScore.scores, { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50 });
  assert.equal(flatScore.structure.dominance, 0);
  assert.equal(flatScore.structure.consistency, "HIGH");
  assert.equal(flatScore.structure.breadth, 6);
  assert.deepEqual(flatScore.bands, { dominance: "DUAL", differentiation: "LOW", breadth: "MANY" });
  assert.deepEqual(flatScore.quality, ["LOW_VARIANCE", "MANY_UNSURE"]);
  assert.equal(Object.hasOwn(flatScore, "median_ms"), false);
  const tied = hollandTieBreak();
  const tiedScore = scoreHolland(tied);
  assert.equal(tiedScore.scores.R, 75);
  assert.equal(tiedScore.scores.I, 75);
  assert.equal(tiedScore.ranking[0], "I");
  assert.equal(tiedScore.ranking[1], "R");
  assert.equal(tiedScore.holland_code, "IRA");
  const keyed = {};
  flat.forEach((value, index) => {
    keyed[`Q${String(index + 1).padStart(2, "0")}`] = value;
  });
  const holland = hollandBody(keyed, {
    rushed: true,
    explore: { q1: "写信", q2: ["做一个作品"], q2other: "", q3: ["更理解自己", "暂时只是好奇"] },
  });
  assert.equal(Array.isArray(holland.payload.reportContent.viewModel.answers), true);
  assert.equal(holland.payload.reportContent.viewModel.answers.length, 60);
  assert.equal(holland.payload.assessmentVersion, "holland-h5-v1");
  assert.equal(holland.payload.result.code, "RIA");
  assert.deepEqual(holland.payload.extensionData.score.structure, flatScore.structure);
  assert.deepEqual(holland.payload.extensionData.score.bands, flatScore.bands);
  assert.deepEqual(holland.payload.extensionData.score.ranking, flatScore.ranking);
  assert.equal(holland.payload.extensionData.score.quality.includes("FAST_RESPONSE"), false);
  assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(holland.payload))), []);
  const hollandSaved = await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(holland.payload)),
    linkSecret: holland.linkSecret,
    ownerToken: holland.ownerToken,
  }, { ip: "203.0.113.166" });
  assert.equal(hollandSaved.status, 200);
  assert.equal(feishu.rows[2]["测评 ID"], "holland");
  assert.equal(feishu.rows[2]["测评名称"], "霍兰德兴趣探索");
  assert.equal(feishu.rows[2]["分享链接"], buildGithubShareUrl(holland.reportId, holland.linkSecret));
  assert.equal(feishu.rows[2]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  const read = await post({ handle }, "/v1/results/read", {
    reportId: holland.reportId, linkSecret: holland.linkSecret,
  }, { ip: "203.0.113.167" });
  assert.equal(read.status, 200);
  assert.equal(read.body.result.code, "RIA");
  assert.equal(read.body.dimensions[0].id, "R");
  assert.equal(read.body.dimensions[0].score, 50);

  const shortHolland = hollandBody(flat);
  shortHolland.payload.reportContent.viewModel.answers = flat.slice(0, 59);
  shortHolland.payload.extensionData.answers = flat.slice(0, 59);
  const shortHollandResult = await post({ handle }, "/v1/results", {
    result: shortHolland.payload, linkSecret: shortHolland.linkSecret, ownerToken: shortHolland.ownerToken,
  }, { ip: "203.0.113.168" });
  assert.equal(shortHollandResult.status, 422);
  assert.equal(shortHollandResult.body.issues.includes("作答需要 60 道 1–5 的整数题"), true);
  const phoneExplore = hollandBody(flat);
  phoneExplore.payload.reportContent.viewModel.explore.q1 = "13800138000";
  phoneExplore.payload.extensionData.openText.q1 = "13800138000";
  const phoneResult = await post({ handle }, "/v1/results", {
    result: phoneExplore.payload, linkSecret: phoneExplore.linkSecret, ownerToken: phoneExplore.ownerToken,
  }, { ip: "203.0.113.169" });
  assert.equal(phoneResult.status, 422);
  assert.equal(phoneResult.body.issues.some((item) => item.includes("不能保存手机号")), true);
  assert.equal(hollandBody(Array(60).fill(0)).payload, null);
  assert.equal(hollandBody(flat, { explore: { q1: "", q2: ["不在选项里"], q2other: "", q3: [] } }).payload, null);
  const timed = hollandBody(flat);
  timed.payload.extensionData.score.quality = ["FAST_RESPONSE"];
  timed.payload.result.flags = ["FAST_RESPONSE"];
  assert.equal((await post({ handle }, "/v1/results", {
    result: timed.payload, linkSecret: timed.linkSecret, ownerToken: timed.ownerToken,
  }, { ip: "203.0.113.170" })).status, 422);

  const blocked = lovesBody(left);
  blocked.payload.assessmentId = "beattie";
  const rejected = await post({ handle }, "/v1/results", {
    result: blocked.payload, linkSecret: blocked.linkSecret, ownerToken: blocked.ownerToken,
  }, { ip: "203.0.113.171" });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.issues.includes("测评不在可保存范围内"), true);

  const star = result();
  assert.equal((await post({ handle }, "/v1/results", {
    result: star.payload, linkSecret: star.linkSecret, ownerToken: star.ownerToken,
  }, { ip: "203.0.113.172" })).status, 200);
  const root = buildRootResult({
    nickname: "小林",
    answers: Array(33).fill(3),
    developmentAnswers: [3, 3, 3, 3],
    completedAt: "2026-10-23T10:30:00+08:00",
    ...ids(),
  });
  assert.equal((await post({ handle }, "/v1/results", {
    result: root, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.173" })).status, 200);
  assert.equal(store.size(), 5);
});

function LovesSum(leftScores, rightScores) {
  return {
    A: leftScores.A + rightScores.A,
    B: leftScores.B + rightScores.B,
    C: leftScores.C + rightScores.C,
    D: leftScores.D + rightScores.D,
    E: leftScores.E + rightScores.E,
  };
}

function sensmapAnswers(fill = 1, extra = {}) {
  const answers = {};
  for (const question of SENSMAP_QUESTIONS) answers[question.id] = extra[question.id] ?? (question.allowNa ? 1 : fill);
  return answers;
}

test("珍爱金字塔、个人充电、高敏感心力地图和六套情绪测试按作答重算后可保存", async () => {
  const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
  const { handle, store } = app({ feishu });
  const when = "2026-10-24T09:00:00+08:00";

  const high = Array(36).fill(5);
  const low = Array(36).fill(1);
  assert.equal(scoreZhenai(high).total > scoreZhenai(low).total, true);
  assert.equal(scoreZhenai(Array(36).fill(3)).allEqual, true);
  const zhenaiIds = ids();
  const zhenai = buildZhenaiResult({
    nickname: "小林",
    answers: Array(36).fill(4),
    rushed: false,
    completedAt: when,
    ...zhenaiIds,
  });
  assert.equal(zhenai.assessmentId, "zhenai");
  assert.equal(zhenai.assessmentVersion, "zhenai-h5-v1");
  assert.equal(zhenai.dimensions.map((item) => item.id).join(""), "ABCDEF");
  assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(zhenai))), []);
  const zhenaiSaved = await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(zhenai)),
    linkSecret: zhenaiIds.linkSecret,
    ownerToken: zhenaiIds.ownerToken,
  }, { ip: "203.0.113.180" });
  assert.equal(zhenaiSaved.status, 200);
  assert.equal(feishu.rows[0]["测评 ID"], "zhenai");
  assert.equal(feishu.rows[0]["测评名称"], "珍爱金字塔 · 自我关系状态评估");
  assert.equal(feishu.rows[0]["分享链接"], buildGithubShareUrl(zhenai.reportId, zhenaiIds.linkSecret));
  assert.equal(feishu.rows[0]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  const zhenaiShift = buildZhenaiResult({ nickname: "小林", answers: Array(36).fill(4), completedAt: when, ...ids() });
  zhenaiShift.dimensions[0].score = 0;
  assert.equal((await post({ handle }, "/v1/results", {
    result: zhenaiShift, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.181" })).status, 422);
  assert.equal(buildZhenaiResult({
    nickname: "13800138000", answers: Array(36).fill(3), completedAt: when, ...ids(),
  }), null);

  const gcdScore = scoreGcd({ stateId: "tired", customUnmatched: false, sourceIds: ["body", "phone"], dayIndex: 20000 });
  assert.equal(gcdScore.score, 41);
  assert.equal(gcdScore.stateLabel, "有点累，还撑得住");
  assert.equal(gcdScore.customUnmatched, false);
  const gcd = buildGcdResult({
    nickname: "小林",
    stateId: "tired",
    customUnmatched: false,
    sourceIds: ["body", "phone"],
    dayIndex: 20000,
    rushed: true,
    completedAt: when,
    ...ids(),
  });
  assert.equal(gcd.assessmentVersion, "gcd-h5-v1");
  assert.deepEqual(gcd.reportContent.viewModel.actionIds ? [] : gcd.extensionData.score.actionIds, gcdScore.actions.map((item) => item.id));
  assert.equal(JSON.stringify(gcd).includes("customText"), false);
  assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(gcd))), []);
  const gcdSaved = await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(gcd)),
    linkSecret: randomSecret(32),
    ownerToken: randomSecret(32),
  }, { ip: "203.0.113.182" });
  assert.equal(gcdSaved.status, 200);
  assert.equal(feishu.rows[1]["测评 ID"], "gcd");
  assert.equal(feishu.rows[1]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(JSON.stringify(feishu.rows[1]).includes("刷手机"), false);
  const unmatched = buildGcdResult({
    nickname: "小林",
    stateId: null,
    customUnmatched: true,
    sourceIds: [],
    dayIndex: 3,
    completedAt: when,
    ...ids(),
  });
  assert.equal(unmatched.reportContent.viewModel.stateLabel, "自己写的状态");
  assert.equal(unmatched.reportContent.viewModel.stateLine.includes("按中间值 55 起算"), true);
  assert.equal(unmatched.extensionData.score.score, 55);
  assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(unmatched))), []);
  const withText = JSON.parse(JSON.stringify(gcd));
  withText.extensionData.customText = "有点烦，又有点累";
  const textRejected = await post({ handle }, "/v1/results", {
    result: withText, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.183" });
  assert.equal(textRejected.status, 422);
  assert.equal(textRejected.body.issues.some((item) => item.includes("customText")), true);
  assert.equal(buildGcdResult({
    nickname: "小林", customText: "累", stateId: "tired", sourceIds: [], dayIndex: 1, completedAt: when, ...ids(),
  }), null);

  const answers = sensmapAnswers(2);
  const sens = buildSensmapResult({
    nickname: "小林",
    answers,
    impact: { F: 1, R: 1, E: 4, M: 0 },
    scenarioAnswers: [
      { questionId: "S-F1", optionId: "A" },
      { questionId: "S-F2", optionId: "B" },
    ],
    choice: "E",
    overrideSubId: null,
    rushed: false,
    completedAt: when,
    ...ids(),
  });
  assert.equal(sens.assessmentId, "sensmap");
  assert.equal(sens.assessmentVersion, "sensmap-h5-v1");
  assert.equal(Object.prototype.hasOwnProperty.call(sens.reportContent.viewModel, "narrative"), false);
  assert.equal(JSON.stringify(sens).includes("独有自述"), false);
  assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(sens))), []);
  const sensSaved = await post({ handle }, "/v1/results", {
    result: JSON.parse(JSON.stringify(sens)),
    linkSecret: randomSecret(32),
    ownerToken: randomSecret(32),
  }, { ip: "203.0.113.184" });
  assert.equal(sensSaved.status, 200);
  assert.equal(feishu.rows[2]["测评 ID"], "sensmap");
  assert.equal(feishu.rows[2]["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  const story = JSON.parse(JSON.stringify(sens));
  story.reportContent.viewModel.narrative = "这段话不该上传";
  const storyRejected = await post({ handle }, "/v1/results", {
    result: story, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.185" });
  assert.equal(storyRejected.status, 422);
  assert.equal(storyRejected.body.issues.some((item) => item.includes("narrative")), true);
  const badScene = buildSensmapResult({
    nickname: "小林",
    answers,
    impact: { F: 1, R: 1, E: 1, M: 1 },
    scenarioAnswers: [
      { questionId: "S-M1", optionId: "A" },
      { questionId: "S-M2", optionId: "A" },
    ],
    choice: "unclear",
    completedAt: when,
    ...ids(),
  });
  assert.equal(badScene, null);

  for (const spec of BEATTIE_TESTS) {
    const test = getTestById(spec.testId);
    const made = buildBeattieResult({
      nickname: "小林",
      assessmentId: spec.id,
      testId: spec.testId,
      likert: Array(test.likertItems.length).fill(6),
      mcq: test.mcqItems.map((item) => item.options[0].key),
      tf: test.tfItems.map((item) => (spec.testId === "guilt" && item.id === 6 ? "NA" : "yes")),
      rushed: false,
      completedAt: when,
      ...ids(),
    });
    assert.equal(made.assessmentVersion, `${spec.id}-h5-v1`);
    assert.equal(made.source.origin, "in-repo");
    assert.equal(made.source.path, "beattie/index.html");
    assert.equal(JSON.stringify(made).includes("angerFill"), false);
    assert.deepEqual(validateAssessmentResult(JSON.parse(JSON.stringify(made))), []);
    const saved = await post({ handle }, "/v1/results", {
      result: JSON.parse(JSON.stringify(made)),
      linkSecret: randomSecret(32),
      ownerToken: randomSecret(32),
    }, { ip: "203.0.113.186" });
    assert.equal(saved.status, 200, spec.id);
  }
  const anger = buildBeattieResult({
    nickname: "小林",
    assessmentId: "beattie-anger",
    testId: "anger",
    likert: Array(10).fill(5),
    mcq: getTestById("anger").mcqItems.map((item) => item.options[0].key),
    tf: Array(8).fill("yes"),
    completedAt: when,
    ...ids(),
  });
  anger.extensionData.angerFill = "不该保存的填空";
  const angerRejected = await post({ handle }, "/v1/results", {
    result: anger, linkSecret: randomSecret(32), ownerToken: randomSecret(32),
  }, { ip: "203.0.113.187" });
  assert.equal(angerRejected.status, 422);
  assert.equal(angerRejected.body.issues.some((item) => item.includes("angerFill")), true);
  assert.equal(buildBeattieResult({
    nickname: "小林",
    assessmentId: "beattie-anger",
    testId: "anger",
    likert: Array(10).fill(5),
    mcq: getTestById("anger").mcqItems.map((item) => item.options[0].key),
    tf: Array(8).fill("yes"),
    angerFill: "填空",
    completedAt: when,
    ...ids(),
  }), null);
  assert.equal(feishu.rows.at(-1)["分享链接"].startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(store.size(), 3 + BEATTIE_TESTS.length);
});


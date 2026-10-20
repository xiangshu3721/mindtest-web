import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORDS } from "../../star/js/data.js";
import { buildStarResult } from "../../star/js/cloud-payload.js";
import { createHandler } from "./lib/handler.mjs";
import { createCloudBaseStore, createMemoryStore } from "./lib/store.mjs";
import { createFeishuIndex, MIRROR_FIELDS, TABLE_NAME } from "./lib/feishu.mjs";
import { assertDevCollection, randomSecret } from "./lib/ids.mjs";
import { buildImportDraft } from "./lib/import-draft.mjs";
import { deployBlockReason } from "./index.mjs";
import { startLocalServer } from "./local-server.mjs";

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

function confirmedEnv(extra = {}) {
  return {
    ASSESSMENT_COLLECTION: "assessment_reports_dev",
    ASSESSMENT_STORE_DRIVER: "cloudbase",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    ...extra,
  };
}

function mockDatabase() {
  const docs = new Map();
  const created = [];
  const indexes = [];
  const collection = {
    async add(doc) {
      const duplicate = docs.has(doc._id) || [...docs.values()].some((item) => (
        item.reportId === doc.reportId || item.sourceSubmissionId === doc.sourceSubmissionId
      ));
      if (duplicate) {
        const error = new Error("E11000 duplicate key error");
        error.code = "E11000";
        throw error;
      }
      docs.set(doc._id, { ...doc });
      return { id: doc._id };
    },
    doc(id) {
      return {
        async get() {
          const doc = docs.get(id);
          return { data: doc ? [doc] : [] };
        },
        async update(patch) {
          const doc = docs.get(id);
          if (!doc) throw new Error("document does not exist");
          Object.assign(doc, patch);
          return { updated: 1 };
        },
      };
    },
    where(query) {
      const matched = [...docs.values()].filter((doc) => (
        Object.entries(query).every(([key, value]) => doc[key] === value)
      ));
      return {
        limit(size) {
          return { async get() { return { data: matched.slice(0, size) }; } };
        },
      };
    },
    skip(offset) {
      const rows = [...docs.values()];
      return {
        limit(size) {
          return { async get() { return { data: rows.slice(offset, offset + size) }; } };
        },
      };
    },
    async createIndex(spec) {
      indexes.push(spec);
    },
  };
  return {
    indexes,
    created,
    async createCollection(name) {
      created.push(name);
    },
    collection() {
      return collection;
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

test("隔离集合以外直接拒绝，未确认或没有云身份时不连接", async () => {
  assert.throws(() => assertDevCollection("assessment_reports"));
  const source = await readFile(new URL("./lib/store.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("本轮不打包"), false);
  await assert.rejects(() => createCloudBaseStore({ ASSESSMENT_STORE_DRIVER: "cloudbase" }), /未确认隔离写入/);
  await assert.rejects(() => createCloudBaseStore(confirmedEnv()), (error) => {
    assert.equal(String(error.message).includes("不打包"), false);
    assert.match(error.message, /没有云函数身份/);
    return true;
  });
  await assert.rejects(() => createCloudBaseStore(confirmedEnv({
    ASSESSMENT_COLLECTION: "assessment_reports",
  })), /拒绝写入非隔离集合/);
  await assert.rejects(() => createCloudBaseStore(confirmedEnv({
    TCB_ENV: "other-env",
    TENCENTCLOUD_RUNENV: "SCF",
  })), /非授权环境/);
});

test("CloudBase mock 客户端：插入幂等、更新，以及文档库未开通时拒绝启动", async () => {
  const db = mockDatabase();
  const store = await createCloudBaseStore(confirmedEnv(), db);
  assert.equal(store.driver, "cloudbase");
  assert.equal(store.collection, "assessment_reports_dev");
  assert.deepEqual(db.created, ["assessment_reports_dev"]);
  assert.deepEqual(store.indexes, ["reportId_1", "sourceSubmissionId_1"]);
  assert.equal(store.indexFallback, false);

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
  assert.equal(byId._id, undefined);
  assert.equal(byId._openid, undefined);
  assert.equal((await store.all()).length, 1);
  assert.equal(await store.update("rpt_missingmissingmiss", { shareStatus: "revoked" }), null);

  const raced = {
    async createCollection() {},
    collection() {
      return {
        async add() {
          const error = new Error("E11000 duplicate key");
          error.code = "E11000";
          throw error;
        },
        doc() {
          return { async get() { return { data: [] }; } };
        },
        where() {
          return { limit() { return { async get() { return { data: [] }; } }; } };
        },
        async createIndex() {},
      };
    },
  };
  const raceStore = await createCloudBaseStore(confirmedEnv(), raced);
  await assert.rejects(() => raceStore.insert(sampleDoc()), (error) => {
    assert.equal(error.code, "duplicate");
    return true;
  });

  const noIndex = {
    async createCollection() {},
    collection() {
      return {};
    },
  };
  const fallback = await createCloudBaseStore(confirmedEnv(), noIndex);
  assert.equal(fallback.indexFallback, true);
  assert.deepEqual(fallback.indexes, []);

  const existing = mockDatabase();
  existing.createCollection = async () => {
    throw new Error("collection already exists");
  };
  const again = await createCloudBaseStore(confirmedEnv(), existing);
  assert.equal(again.driver, "cloudbase");

  await assert.rejects(() => createCloudBaseStore(confirmedEnv(), {
    async createCollection() {
      throw new Error("当前环境未开通文档型数据库");
    },
    collection() {
      return {};
    },
  }), /文档型数据库未开通/);
  await assert.rejects(() => createCloudBaseStore(confirmedEnv(), {
    async createCollection() {
      throw new Error("The Env Is Initializing, Please Try It Later");
    },
    collection() {
      return {};
    },
  }), /还在初始化/);
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
    ASSESSMENT_STORE_DRIVER: "cloudbase",
    ASSESSMENT_CLOUDBASE_WRITE_CONFIRM: "dev-isolated",
    FEISHU_INDEX_MODE: "live",
  }), "feishu-live");
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
    store: { ...createMemoryStore("assessment_reports_dev"), driver: "cloudbase" },
    feishu: createFeishuIndex({ FEISHU_INDEX_MODE: "off" }),
    deployed: true,
    silent: true,
  });
  const shown = await on.handle({ method: "GET", path: "/assessmentReportDev/health", headers: {} });
  assert.equal(shown.body.store, "cloudbase");
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

test("其他测评页面没有接上云端块", async () => {
  for (const file of ["index.html", "ecr/index.html", "pdq/index.html", "scl90/index.html", "beattie/index.html"]) {
    const text = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.equal(text.includes("cloud-kit"), false);
    assert.equal(text.includes("star-cloud"), false);
  }
});

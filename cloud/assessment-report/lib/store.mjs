import { assertDevCollection } from "./ids.mjs";

const AUTHORIZED_ENV = "root-journey-prod-d4d7pzd0a8f805";
const INDEXES = [
  {
    indexName: "reportId_1",
    keys: [{ name: "reportId", direction: 1 }],
    unique: true,
  },
  {
    indexName: "sourceSubmissionId_1",
    keys: [{ name: "sourceSubmissionId", direction: 1 }],
    unique: true,
  },
];

export function createMemoryStore(collection = "assessment_reports_dev") {
  assertDevCollection(collection);
  const byReport = new Map();
  const bySubmission = new Map();
  const locks = new Map();

  async function withLock(key, work) {
    const prev = locks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    locks.set(key, prev.then(() => current));
    await prev;
    try {
      return await work();
    } finally {
      release();
    }
  }

  return {
    driver: "memory",
    collection,
    async getByReportId(reportId) {
      return byReport.get(reportId) || null;
    },
    async getBySubmission(clientSubmissionId) {
      const reportId = bySubmission.get(clientSubmissionId);
      return reportId ? byReport.get(reportId) || null : null;
    },
    async insert(doc) {
      return withLock(doc.sourceSubmissionId, async () => {
        if (byReport.has(doc.reportId) || bySubmission.has(doc.sourceSubmissionId)) {
          const error = new Error("duplicate");
          error.code = "duplicate";
          throw error;
        }
        byReport.set(doc.reportId, doc);
        bySubmission.set(doc.sourceSubmissionId, doc.reportId);
        return doc;
      });
    },
    async update(reportId, patch) {
      const doc = byReport.get(reportId);
      if (!doc) return null;
      const next = { ...doc, ...patch };
      byReport.set(reportId, next);
      return next;
    },
    size() {
      return byReport.size;
    },
    async all() {
      return [...byReport.values()];
    },
  };
}

function errorText(error) {
  return `${error?.code || ""} ${error?.errCode || ""} ${error?.message || ""} ${error?.errMsg || ""}`;
}

function isAlreadyExists(error) {
  return /already exist|已存在|ResourceExist|DATABASE_COLLECTION_EXIST|IndexAlreadyExists/i.test(errorText(error));
}

function isDatabaseUnavailable(error) {
  return /未开通文档型数据库|文档型数据库未开通|Env Is Initializing|Please Try It Later|DATABASE_NOT_OPEN/i.test(errorText(error));
}

function isDuplicateError(error) {
  const text = errorText(error);
  return error?.code === "duplicate" || /duplicate|E11000|唯一索引|唯一键/.test(text);
}

function isNotFound(error) {
  return /not exist|not found|不存在|DOCUMENT_NOT_EXIST|ResourceNotFound/i.test(errorText(error));
}

function unavailableError(error, name) {
  const text = errorText(error);
  if (/initializ|Try It Later/i.test(text)) {
    return new Error(`文档型数据库还在初始化：${error?.message || text}。请在控制台确认环境 ${AUTHORIZED_ENV} 的文档型数据库已开通，再创建集合 ${name}。`);
  }
  return new Error(`文档型数据库未开通或不可用：${error?.message || text}。个人版套餐已包含文档库，不需要升级或购买。请先在控制台开通文档型数据库，再创建集合 ${name}。`);
}

function duplicateError() {
  const error = new Error("duplicate");
  error.code = "duplicate";
  return error;
}

function rowsOf(result) {
  const data = result && result.data;
  if (Array.isArray(data)) return data.filter(Boolean);
  if (data && typeof data === "object") return [data];
  return [];
}

function clean(doc) {
  if (!doc || typeof doc !== "object") return null;
  const copy = { ...doc };
  delete copy._id;
  delete copy._openid;
  return copy;
}

function persistable(doc) {
  const copy = JSON.parse(JSON.stringify(doc));
  copy._id = doc.reportId;
  return copy;
}

function explicitEnvId(env) {
  return String(env.TCB_ENV || env.CLOUDBASE_ENV_ID || env.TCB_ENVID || "").trim();
}

function runningInCloud(env) {
  return env.TENCENTCLOUD_RUNENV === "SCF" || Boolean(env.SCF_NAMESPACE);
}

async function openDatabase(env) {
  const envId = explicitEnvId(env);
  if (envId && envId !== AUTHORIZED_ENV) {
    throw new Error(`拒绝连接非授权环境：${envId}`);
  }
  if (!runningInCloud(env)) {
    throw new Error("没有云函数身份，拒绝连接 CloudBase");
  }
  const imported = await import("@cloudbase/node-sdk");
  const tcb = imported.default || imported;
  if (!tcb || typeof tcb.init !== "function" || !tcb.SYMBOL_CURRENT_ENV) {
    throw new Error("CloudBase SDK 缺少当前环境身份");
  }
  const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  if (!app || typeof app.database !== "function") {
    throw new Error("CloudBase SDK 没有返回文档库客户端");
  }
  return app.database();
}

async function ensureCollection(database, name, collection) {
  const ready = { indexes: [], indexFallback: false, collectionWarning: "" };
  if (typeof database.createCollection === "function") {
    try {
      await database.createCollection(name);
    } catch (error) {
      if (isDatabaseUnavailable(error)) throw unavailableError(error, name);
      if (!isAlreadyExists(error)) ready.collectionWarning = error?.message || errorText(error);
    }
  }
  if (typeof collection.createIndex !== "function") {
    ready.indexFallback = true;
    return ready;
  }
  for (const spec of INDEXES) {
    try {
      await collection.createIndex(spec);
      ready.indexes.push(spec.indexName);
    } catch (error) {
      if (isDatabaseUnavailable(error)) throw unavailableError(error, name);
      if (!isAlreadyExists(error)) ready.indexFallback = true;
    }
  }
  return ready;
}

/**
 * 只在驱动和隔离写入确认都到位时连接文档库。
 * 云函数内使用当前环境身份，不读取密钥。
 * 第二个参数只给测试注入 mock 客户端，生产路径不要传。
 */
export async function createCloudBaseStore(env = process.env, database = null) {
  const name = env.ASSESSMENT_COLLECTION || "assessment_reports_dev";
  assertDevCollection(name);
  if (env.ASSESSMENT_STORE_DRIVER !== "cloudbase") {
    throw new Error("未选择 CloudBase 驱动");
  }
  if (env.ASSESSMENT_CLOUDBASE_WRITE_CONFIRM !== "dev-isolated") {
    throw new Error("未确认隔离写入，拒绝连接 CloudBase");
  }

  const db = database || await openDatabase(env);
  if (!db || typeof db.collection !== "function") {
    throw new Error("CloudBase 文档库客户端不可用");
  }
  const collection = db.collection(name);
  const ready = await ensureCollection(db, name, collection);

  let writeTail = Promise.resolve();
  function enqueue(work) {
    const run = writeTail.then(work, work);
    writeTail = run.then(() => {}, () => {});
    return run;
  }

  async function getByReportId(reportId) {
    try {
      const result = await collection.doc(String(reportId)).get();
      const row = rowsOf(result)[0];
      return row ? clean(row) : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async function getBySubmission(clientSubmissionId) {
    const result = await collection.where({ sourceSubmissionId: clientSubmissionId }).limit(1).get();
    const row = rowsOf(result)[0];
    return row ? clean(row) : null;
  }

  return {
    driver: "cloudbase",
    collection: name,
    indexes: ready.indexes,
    indexFallback: ready.indexFallback,
    collectionWarning: ready.collectionWarning,
    getByReportId,
    getBySubmission,
    async insert(doc) {
      return enqueue(async () => {
        const byReport = await getByReportId(doc.reportId);
        const bySubmission = await getBySubmission(doc.sourceSubmissionId);
        if (byReport || bySubmission) throw duplicateError();
        try {
          await collection.add(persistable(doc));
        } catch (error) {
          if (isDuplicateError(error)) throw duplicateError();
          throw error;
        }
        return doc;
      });
    },
    async update(reportId, patch) {
      return enqueue(async () => {
        const current = await getByReportId(reportId);
        if (!current) return null;
        const next = { ...current, ...patch };
        await collection.doc(String(reportId)).update(JSON.parse(JSON.stringify(patch)));
        return next;
      });
    },
    async all() {
      const pageSize = 100;
      const cap = 1000;
      const docs = [];
      for (let skip = 0; skip < cap; skip += pageSize) {
        const result = await collection.skip(skip).limit(pageSize).get();
        const rows = rowsOf(result).map(clean);
        docs.push(...rows);
        if (rows.length < pageSize) break;
      }
      return docs;
    },
  };
}

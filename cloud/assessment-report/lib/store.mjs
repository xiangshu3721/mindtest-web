import { assertDevCollection } from "./ids.mjs";

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

const AUTHORIZED_ENV = "root-journey-prod-d4d7pzd0a8f805";

export function isCloudStoreDriver(value) {
  return value === "postgres" || value === "cloudbase";
}

export function quoteIdent(name) {
  const value = String(name || "");
  if (!/^assessment_reports_dev(?:_[a-z0-9_]+)?$/.test(value)) {
    throw new Error(`拒绝写入非隔离表：${value || "(empty)"}`);
  }
  return `"${value}"`;
}

export function tableSql(table = "assessment_reports_dev") {
  const ident = quoteIdent(table);
  const index = quoteIdent(`${table}_source_submission_id_uidx`);
  return [
    `CREATE TABLE IF NOT EXISTS ${ident} (
  report_id text PRIMARY KEY,
  source_submission_id text NOT NULL,
  doc jsonb NOT NULL
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ${index} ON ${ident} (source_submission_id)`,
  ];
}

function errorText(error) {
  return `${error?.code || ""} ${error?.status || ""} ${error?.message || ""} ${error?.details || ""}`;
}

function isDuplicateError(error) {
  return error?.code === "23505" || error?.code === "duplicate" || /duplicate key|unique constraint|23505/.test(errorText(error));
}

function isMissingTable(error) {
  return error?.code === "42P01" || error?.code === "PGRST205" || /does not exist|schema cache|Could not find the table/i.test(errorText(error));
}

function isAuthError(error) {
  return /401|403|JWT|access key|APIKEY|missing secretId|credential|unauthorized|权限不足/i.test(errorText(error));
}

function duplicateError() {
  const error = new Error("duplicate");
  error.code = "duplicate";
  return error;
}

function missingTableError(table) {
  return new Error(`PostgreSQL 里还没有表 ${table}。请在控制台的 SQL 数据库执行：\n${tableSql(table).join(";\n")};`);
}

function authError() {
  return new Error("PostgreSQL 鉴权失败。在云函数环境变量里设置 CLOUDBASE_APIKEY（控制台生成的 API Key，只放环境变量），或设置 ASSESSMENT_PG_URL 为 SQL 数据库连接串。不要把这些值写进 Git。");
}

function asDoc(value) {
  if (value == null) return null;
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function createSqlStoreClient(query, table) {
  const ident = quoteIdent(table);
  return {
    async ensure() {
      for (const statement of tableSql(table)) await query(statement);
    },
    async getByReportId(reportId) {
      const result = await query(`SELECT doc FROM ${ident} WHERE report_id = $1 LIMIT 1`, [reportId]);
      const row = result.rows?.[0];
      return row ? asDoc(row.doc) : null;
    },
    async getBySubmission(sourceSubmissionId) {
      const result = await query(`SELECT doc FROM ${ident} WHERE source_submission_id = $1 LIMIT 1`, [sourceSubmissionId]);
      const row = result.rows?.[0];
      return row ? asDoc(row.doc) : null;
    },
    async insert(doc) {
      await query(
        `INSERT INTO ${ident} (report_id, source_submission_id, doc) VALUES ($1, $2, $3::jsonb)`,
        [doc.reportId, doc.sourceSubmissionId, JSON.stringify(doc)],
      );
    },
    async update(reportId, doc) {
      await query(
        `UPDATE ${ident} SET doc = $1::jsonb, source_submission_id = $2 WHERE report_id = $3`,
        [JSON.stringify(doc), doc.sourceSubmissionId, reportId],
      );
    },
    async list(limit, offset) {
      const result = await query(
        `SELECT doc FROM ${ident} ORDER BY report_id LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return (result.rows || []).map((row) => asDoc(row.doc));
    },
  };
}

async function readRdb(builder) {
  const result = await builder;
  if (result?.error) {
    const error = new Error(result.error.message || "PostgreSQL 请求失败");
    error.code = result.error.code;
    error.details = result.error.details;
    error.status = result.status || result.error.status;
    throw error;
  }
  return result?.data || [];
}

function createRdbStoreClient(rdb, table) {
  return {
    async ensure() {
      try {
        await readRdb(rdb.from(table).select("report_id").limit(1));
      } catch (error) {
        if (isMissingTable(error)) throw missingTableError(table);
        if (isAuthError(error)) throw authError();
        throw error;
      }
    },
    async getByReportId(reportId) {
      const rows = await readRdb(rdb.from(table).select("doc").eq("report_id", reportId).limit(1));
      return rows[0] ? asDoc(rows[0].doc) : null;
    },
    async getBySubmission(sourceSubmissionId) {
      const rows = await readRdb(rdb.from(table).select("doc").eq("source_submission_id", sourceSubmissionId).limit(1));
      return rows[0] ? asDoc(rows[0].doc) : null;
    },
    async insert(doc) {
      await readRdb(rdb.from(table).insert({
        report_id: doc.reportId,
        source_submission_id: doc.sourceSubmissionId,
        doc,
      }));
    },
    async update(reportId, doc) {
      await readRdb(rdb.from(table).update({
        source_submission_id: doc.sourceSubmissionId,
        doc,
      }).eq("report_id", reportId));
    },
    async list(limit, offset) {
      const rows = await readRdb(
        rdb.from(table).select("doc").order("report_id").range(offset, offset + limit - 1),
      );
      return rows.map((row) => asDoc(row.doc));
    },
  };
}

function explicitEnvId(env) {
  return String(env.TCB_ENV || env.CLOUDBASE_ENV_ID || env.TCB_ENVID || "").trim();
}

function runningInCloud(env) {
  return env.TENCENTCLOUD_RUNENV === "SCF" || Boolean(env.SCF_NAMESPACE);
}

async function openRdbClient(env, apiKey) {
  const imported = await import("@cloudbase/node-sdk");
  const tcb = imported.default || imported;
  if (!tcb || typeof tcb.init !== "function" || tcb.SYMBOL_CURRENT_ENV == null) {
    throw new Error("CloudBase SDK 缺少当前环境身份");
  }
  const config = { env: runningInCloud(env) ? tcb.SYMBOL_CURRENT_ENV : AUTHORIZED_ENV };
  if (apiKey) config.accessKey = apiKey;
  const app = tcb.init(config);
  if (!app || typeof app.rdb !== "function") {
    throw new Error("CloudBase SDK 没有 PostgreSQL 客户端 rdb()");
  }
  const rdb = app.rdb();
  if (!rdb || typeof rdb.from !== "function") {
    throw new Error("CloudBase SDK 没有 PostgreSQL 客户端 rdb()");
  }
  return rdb;
}

async function openPgClient(pgUrl, table) {
  const imported = await import("pg");
  const Pool = imported.Pool || imported.default?.Pool;
  if (!Pool) throw new Error("pg 驱动没有 Pool");
  const pool = new Pool({
    connectionString: pgUrl,
    max: 2,
    ssl: /sslmode=require/i.test(pgUrl) ? { rejectUnauthorized: false } : undefined,
  });
  return createSqlStoreClient(async (text, values) => pool.query(text, values), table);
}

function adaptClient(client, table) {
  if (client && typeof client.query === "function") return createSqlStoreClient(client.query.bind(client), table);
  if (client && typeof client.from === "function") return createRdbStoreClient(client, table);
  throw new Error("PostgreSQL 客户端不可用");
}

async function openClient(env, table) {
  const envId = explicitEnvId(env);
  if (envId && envId !== AUTHORIZED_ENV) throw new Error(`拒绝连接非授权环境：${envId}`);
  const apiKey = String(env.CLOUDBASE_APIKEY || "").trim();
  const pgUrl = String(env.ASSESSMENT_PG_URL || "").trim();
  const inCloud = runningInCloud(env);
  if (!inCloud && !apiKey && !pgUrl) {
    throw new Error("没有云函数身份，也没有 CLOUDBASE_APIKEY 或 ASSESSMENT_PG_URL。拒绝连接 PostgreSQL");
  }
  if (inCloud || apiKey) {
    const rdb = createRdbStoreClient(await openRdbClient(env, apiKey), table);
    try {
      await rdb.ensure();
      return rdb;
    } catch (error) {
      if (pgUrl && isAuthError(error)) {
        const sql = await openPgClient(pgUrl, table);
        await sql.ensure();
        return sql;
      }
      throw error;
    }
  }
  const sql = await openPgClient(pgUrl, table);
  await sql.ensure();
  return sql;
}

/**
 * 隔离存储走 PostgreSQL 表 assessment_reports_dev。
 * 云函数里优先用 @cloudbase/node-sdk 的 rdb()。
 * 密钥只从环境变量读取，不写进仓库。第二个参数只给测试注入客户端。
 */
export async function createCloudBaseStore(env = process.env, client = null) {
  const name = env.ASSESSMENT_COLLECTION || "assessment_reports_dev";
  assertDevCollection(name);
  if (!isCloudStoreDriver(env.ASSESSMENT_STORE_DRIVER)) {
    throw new Error("未选择 PostgreSQL 驱动");
  }
  if (env.ASSESSMENT_CLOUDBASE_WRITE_CONFIRM !== "dev-isolated") {
    throw new Error("未确认隔离写入，拒绝连接 CloudBase");
  }

  const db = client ? adaptClient(client, name) : await openClient(env, name);
  if (client) await db.ensure();

  let writeTail = Promise.resolve();
  function enqueue(work) {
    const run = writeTail.then(work, work);
    writeTail = run.then(() => {}, () => {});
    return run;
  }

  async function guard(work) {
    try {
      return await work();
    } catch (error) {
      if (isDuplicateError(error)) throw duplicateError();
      if (isMissingTable(error)) throw missingTableError(name);
      if (isAuthError(error)) throw authError();
      throw error;
    }
  }

  return {
    driver: "postgres",
    collection: name,
    async getByReportId(reportId) {
      return guard(() => db.getByReportId(reportId));
    },
    async getBySubmission(clientSubmissionId) {
      return guard(() => db.getBySubmission(clientSubmissionId));
    },
    async insert(doc) {
      return enqueue(() => guard(async () => {
        if (await db.getByReportId(doc.reportId) || await db.getBySubmission(doc.sourceSubmissionId)) {
          throw duplicateError();
        }
        await db.insert(doc);
        return doc;
      }));
    },
    async update(reportId, patch) {
      return enqueue(() => guard(async () => {
        const current = await db.getByReportId(reportId);
        if (!current) return null;
        const next = { ...current, ...patch };
        await db.update(reportId, next);
        return next;
      }));
    },
    async all() {
      const pageSize = 100;
      const cap = 1000;
      const docs = [];
      for (let offset = 0; offset < cap; offset += pageSize) {
        const rows = await guard(() => db.list(pageSize, offset));
        docs.push(...rows);
        if (rows.length < pageSize) break;
      }
      return docs;
    },
  };
}


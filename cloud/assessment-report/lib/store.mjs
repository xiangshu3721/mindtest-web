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

/**
 * 真实 CloudBase 写入这一期不启用。
 * 没有环境密钥，也还没有核对文档库里已有集合，所以驱动直接拒绝。
 */
export async function createCloudBaseStore(env = process.env) {
  const name = env.ASSESSMENT_COLLECTION || "assessment_reports_dev";
  assertDevCollection(name);
  if (env.ASSESSMENT_STORE_DRIVER !== "cloudbase") {
    throw new Error("未选择 CloudBase 驱动");
  }
  if (env.ASSESSMENT_CLOUDBASE_WRITE_CONFIRM !== "dev-isolated") {
    throw new Error("未确认隔离写入，拒绝连接 CloudBase");
  }
  throw new Error("CloudBase 驱动本轮不打包。集合名已锁在 assessment_reports_dev，确认环境里的集合清单后再接。");
}

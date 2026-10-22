/**
 * 「ASVA 测评记录」镜像。默认关闭，不访问飞书。
 * PostgreSQL 里的报告是准的。这里只是可重试的镜像，失败与否不能靠飞书里有没有行来判断。
 * 不建表、不调用妙搭 webhook。
 * live 要同时有 YES 确认、表 ID、应用凭证和 Base token，才会按「报告 ID」查找后更新或新建。
 * 「分享链接」只写 GitHub Pages。编号去掉 rpt_ 前缀，秘密留在 hash 里。不用腾讯云预览页。
 */

export const FEISHU_APP_ID = "cli_aaff6cb53db89bd3";
export const BASE_NAME = "ASVA 测评数据";
const FEISHU_OPEN = "https://open.feishu.cn/open-apis";

export const TABLE_NAME = "ASVA 测评记录";
export const GITHUB_SHARE_BASE = "https://xiangshu3721.github.io/mindtest-web/r/";
export const MIRROR_FIELDS = [
  "报告 ID",
  "分享链接",
  "客户昵称",
  "测评 ID",
  "测评名称",
  "完成时间",
  "核心结果摘要",
  "来源",
  "关联客户 ID",
  "报告状态",
  "客户归档状态",
  "同步状态",
  "来源导师 ID",
  "来源活动",
  "记录版本",
  "报告字节数",
  "创建时间",
];

export function clipChars(value, max) {
  const chars = Array.from(String(value || ""));
  return chars.length > max ? chars.slice(0, max).join("") : chars.join("");
}

export function buildGithubShareUrl(reportId, linkSecret) {
  const id = String(reportId || "");
  const secret = String(linkSecret || "");
  if (!id.startsWith("rpt_") || !secret) return "";
  return `${GITHUB_SHARE_BASE}#${id.slice("rpt_".length)}.${secret}`;
}

function mirrorShareUrl(doc, reportId) {
  const stored = typeof doc.shareUrl === "string" ? doc.shareUrl : "";
  if (stored.startsWith(GITHUB_SHARE_BASE) && !stored.includes("tcloudbase.com")) return stored;
  return buildGithubShareUrl(reportId, doc.linkSecret);
}

export function indexRow(doc) {
  const payload = doc.payload;
  const attribution = (payload.extensionData && payload.extensionData.attribution) || {};
  const headline = payload.result && payload.result.headline || "";
  const summary = payload.result && payload.result.summary || "";
  const shareUrl = mirrorShareUrl(doc, payload.reportId);
  const row = {
    "报告 ID": payload.reportId,
    ...(shareUrl ? { "分享链接": shareUrl } : {}),
    "客户昵称": payload.nickname,
    "测评 ID": payload.assessmentId,
    "测评名称": payload.assessmentName,
    "完成时间": payload.completedAt,
    "核心结果摘要": clipChars(`${headline}；${summary}`, 120),
    "来源": payload.source && payload.source.origin === "external-repo" ? "站外仓" : "站内合集",
    "关联客户 ID": doc.customerId || "",
    "报告状态": doc.shareStatus === "revoked" ? "已撤销" : "有效",
    "客户归档状态": doc.archiveStatus === "已归档" ? "已归档" : "未归档",
    "同步状态": doc.feishuSync === "已同步" || doc.feishuSync === "失败" ? doc.feishuSync : "待重试",
    "来源导师 ID": attribution.mentorId || "",
    "来源活动": attribution.activity || "",
    "记录版本": payload.schemaVersion,
    "报告字节数": doc.byteSize,
    "创建时间": doc.createdAt,
  };
  return row;
}

export function feishuLiveReady(env = {}) {
  return env.FEISHU_INDEX_MODE === "live"
    && env.FEISHU_INDEX_LIVE_CONFIRM === "YES"
    && Boolean(String(env.FEISHU_ASSESSMENT_TABLE_ID || "").trim())
    && Boolean(String(env.FEISHU_APP_ID || "").trim())
    && Boolean(String(env.FEISHU_APP_SECRET || "").trim())
    && Boolean(String(env.FEISHU_APP_TOKEN || "").trim());
}

function feishuFields(row) {
  const fields = { ...row };
  for (const key of ["完成时间", "创建时间"]) {
    const ms = Date.parse(fields[key]);
    if (!Number.isFinite(ms)) throw new Error(`飞书时间字段无法解析：${key}`);
    fields[key] = ms;
  }
  fields["报告字节数"] = Number(fields["报告字节数"]);
  return fields;
}

async function readJson(response) {
  return response.json();
}

export function createFeishuHttpWriter(env, fetchImpl = globalThis.fetch) {
  const appId = String(env.FEISHU_APP_ID || "").trim();
  const appSecret = String(env.FEISHU_APP_SECRET || "").trim();
  const appToken = String(env.FEISHU_APP_TOKEN || "").trim();
  if (!appId || !appSecret || !appToken) throw new Error("飞书应用凭证不齐");
  let token = "";
  let tokenUntil = 0;

  async function tenantToken(now = Date.now()) {
    if (token && now < tokenUntil) return token;
    const response = await fetchImpl(`${FEISHU_OPEN}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const body = await readJson(response);
    if (!body || body.code !== 0 || !body.tenant_access_token) throw new Error("飞书令牌失败");
    token = body.tenant_access_token;
    const expire = Number(body.expire) || 7200;
    tokenUntil = now + Math.max(60, expire - 120) * 1000;
    return token;
  }

  return async function write({ tableId, row }) {
    const access = await tenantToken();
    const base = `${FEISHU_OPEN}/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`;
    const headers = { "content-type": "application/json", authorization: `Bearer ${access}` };
    const reportId = row["报告 ID"];
    const search = await fetchImpl(`${base}/records/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        page_size: 5,
        filter: {
          conjunction: "and",
          conditions: [{ field_name: "报告 ID", operator: "is", value: [reportId] }],
        },
      }),
    });
    const found = await readJson(search);
    if (!found || found.code !== 0) throw new Error("飞书查询失败");
    const items = (found.data && found.data.items) || [];
    const fields = feishuFields(row);
    if (items.length) {
      const recordId = items[0].record_id;
      const updated = await fetchImpl(`${base}/records/${encodeURIComponent(recordId)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ fields }),
      });
      const body = await readJson(updated);
      if (!body || body.code !== 0) throw new Error("飞书更新失败");
      return { action: "update", recordId, matches: items.length };
    }
    const created = await fetchImpl(`${base}/records`, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields }),
    });
    const body = await readJson(created);
    if (!body || body.code !== 0) throw new Error("飞书新建失败");
    const recordId = body.data && body.data.record && body.data.record.record_id;
    return { action: "create", recordId, matches: 0 };
  };
}

export function createFeishuIndex(env = {}, writer = null) {
  const rows = [];
  const mode = env.FEISHU_INDEX_MODE || "off";
  let failTimes = Number(env.failTimes || 0);
  const liveWriter = typeof writer === "function"
    ? writer
    : (mode === "live" && env.FEISHU_APP_ID && env.FEISHU_APP_SECRET && env.FEISHU_APP_TOKEN
      ? createFeishuHttpWriter(env)
      : null);

  return {
    mode,
    tableName: TABLE_NAME,
    baseName: BASE_NAME,
    rows,
    failNext(times) {
      failTimes += times;
    },
    async upsert(row) {
      if (mode === "off") return "off";
      if (mode === "live") {
        const confirmed = env.FEISHU_INDEX_LIVE_CONFIRM === "YES";
        const tableId = String(env.FEISHU_ASSESSMENT_TABLE_ID || "").trim();
        if (!confirmed || !tableId || typeof liveWriter !== "function") return "blocked";
        await liveWriter({ tableId, tableName: TABLE_NAME, row });
        return "ok";
      }
      if (failTimes > 0) {
        failTimes -= 1;
        throw new Error("mirror-down");
      }
      const id = row["报告 ID"];
      const index = rows.findIndex((item) => item["报告 ID"] === id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return "ok";
    },
  };
}

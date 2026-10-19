/**
 * 「ASVA 测评记录」镜像。默认关闭，不访问飞书。
 * CloudBase 文档是准的。这里只是可重试的镜像，失败与否不能靠飞书里有没有行来判断。
 * 不建表、不调用妙搭 webhook。live 没有确认开关、表 ID 和注入的 writer 时直接停下。
 */

export const TABLE_NAME = "ASVA 测评记录";
export const MIRROR_FIELDS = [
  "报告 ID",
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

export function indexRow(doc) {
  const payload = doc.payload;
  const attribution = (payload.extensionData && payload.extensionData.attribution) || {};
  const headline = payload.result && payload.result.headline || "";
  const summary = payload.result && payload.result.summary || "";
  const row = {
    "报告 ID": payload.reportId,
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

export function createFeishuIndex(env = {}, writer = null) {
  const rows = [];
  const mode = env.FEISHU_INDEX_MODE || "off";
  let failTimes = Number(env.failTimes || 0);

  return {
    mode,
    tableName: TABLE_NAME,
    rows,
    failNext(times) {
      failTimes += times;
    },
    async upsert(row) {
      if (mode === "off") return "off";
      if (mode === "live") {
        const confirmed = env.FEISHU_INDEX_LIVE_CONFIRM === "YES";
        const tableId = String(env.FEISHU_ASSESSMENT_TABLE_ID || "");
        if (!confirmed || !tableId || typeof writer !== "function") return "blocked";
        await writer({ tableId, tableName: TABLE_NAME, row });
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

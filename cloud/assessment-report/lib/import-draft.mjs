import { canonical, sha256 } from "./ids.mjs";

function textOf(report) {
  const dims = (report.dimensions || [])
    .map((item) => `${item.name}：${(item.labels || []).join("、")}`)
    .join("\n");
  const blocks = []
    .concat(report.interpretation || [], report.recommendations || [])
    .map((item) => item && item.text)
    .filter(Boolean)
    .join("\n");
  return [report.reportContent && report.reportContent.textFallback, dims, blocks].filter(Boolean).join("\n");
}

/**
 * 只生成一条原始资料草稿。不匹配昵称，不改客户字段，不保存分享秘密。
 */
export function buildImportDraft({ report, customerId, operatorId, existing = [], linkSecret = "" }) {
  if (!report || report.assessmentId !== "star") {
    return { ok: false, error: "unsupported" };
  }
  const customer = String(customerId || "").trim();
  if (!customer) return { ok: false, error: "customer_required" };
  const prior = existing.find((item) => item.reportId === report.reportId && item.customerId === customer);
  if (prior) return { ok: false, error: "duplicate", sourceId: prior.sourceId };

  const day = String(report.completedAt || "").slice(0, 10);
  const sourceId = `src_${sha256(`${report.reportId}:${customer}`).slice(0, 16)}`;
  const sourceRecord = {
    source_id: sourceId,
    customer_id: customer,
    source_type: "IMPORTED_TEXT",
    title: `测评报告 ${report.assessmentName} · ${day} · ${report.nickname}`,
    raw_text: textOf(report),
    file_ref: {
      kind: "assessment-result-v1",
      reportId: report.reportId,
      schemaVersion: report.schemaVersion,
      assessmentId: report.assessmentId,
      assessmentVersion: report.assessmentVersion,
      compat: report.extensionData && report.extensionData.compat,
    },
    content_hash: sha256(`${report.reportId}:${canonical(report)}`),
    occurred_at: report.completedAt,
    sensitivity_level: "HIGH",
    notes: "导入当时链接有效。分享秘密不进入原始资料。确认前没有写入客户档案。",
    operator_id: operatorId || "",
  };
  const packed = JSON.stringify(sourceRecord);
  if (linkSecret && packed.includes(linkSecret)) {
    throw new Error("草稿泄漏了分享秘密");
  }
  return {
    ok: true,
    sourceRecord,
    customerFieldsTouched: [],
    nicknameAutoMatched: false,
  };
}

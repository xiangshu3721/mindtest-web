import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DEV_COLLECTION = "assessment_reports_dev";
export const REPORT_ID_RE = /^rpt_[A-Za-z0-9_-]{11,64}$/;
export const SECRET_RE = /^[A-Za-z0-9_-]{16,128}$/;
export const SUBMISSION_RE = /^sub_[A-Za-z0-9_-]{8,64}$/;

/** assessmentReportDev 可保存的测评。新增 id 必须在 validate.mjs 里有对应校验。 */
export const ALLOWED_ASSESSMENT_IDS = [
  "star",
  "sefs",
  "scl90",
  "pdq4",
  "ecr",
  "root",
  "loves5",
  "juying",
  "holland",
];

export function assertDevCollection(name) {
  const value = String(name || "");
  if (value !== DEV_COLLECTION && !value.startsWith(`${DEV_COLLECTION}_`)) {
    throw new Error(`拒绝写入非隔离表：${value || "(empty)"}`);
  }
  return value;
}

export function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function byteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

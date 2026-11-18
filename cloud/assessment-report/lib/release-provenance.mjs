// Release metadata is not proof of a deployed version by itself: it must be
// compared to an independently retrieved remote code inventory and artifact hash.
import { readFileSync } from "node:fs";

const HEX64 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

export function publicReleaseMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "UNVERIFIED" };
  if (value.schemaVersion !== 1 ||
      !COMMIT.test(String(value.sourceCommit || "")) ||
      !HEX64.test(String(value.sourceFilesSha256 || "")) ||
      !HEX64.test(String(value.lockfileSha256 || "")) ||
      !Number.isSafeInteger(value.fileCount) || value.fileCount < 1 ||
      !Array.isArray(value.files) || value.files.length !== value.fileCount ||
      value.files.some((item) => typeof item?.path !== "string" ||
        !/^[a-zA-Z0-9_./-]+$/.test(item.path) ||
        item.path.startsWith("/") || item.path.split("/").includes("..") ||
        !HEX64.test(String(item.sha256 || "")))) return { status: "UNVERIFIED" };
  // The manifest is embedded in the running package, but is not a cryptographic
  // attestation of the *actual* remote code without independent comparison.
  return {
    status: "EMBEDDED_UNATTESTED",
    sourceCommit: value.sourceCommit,
    sourceFilesSha256: value.sourceFilesSha256,
    lockfileSha256: value.lockfileSha256,
    fileCount: value.fileCount,
  };
}

export function loadReleaseMetadata(file = new URL("../release-manifest.json", import.meta.url)) {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    // Return the validated internal manifest; the HTTP handler will convert it
    // to a public allowlisted view. Sanitizing here too would drop the file
    // inventory and make every embedded manifest appear UNVERIFIED.
    return publicReleaseMetadata(raw).status === "EMBEDDED_UNATTESTED"
      ? raw : { status: "UNVERIFIED" };
  } catch {
    return { status: "UNVERIFIED" };
  }
}

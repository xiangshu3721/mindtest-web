// Offline only. Do NOT invoke this script from a production request handler.
// Usage from the repository checkout:
//   node cloud/assessment-report/build-release-manifest.mjs
//   node cloud/assessment-report/build-release-manifest.mjs --attest /path/to/final-package.zip
// The package SHA cannot be embedded in that same package without changing it.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const manifestPath = path.join(here, "release-manifest.json");
const prefix = "cloud/assessment-report/";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root });

function deployable(file) {
  if (!file.startsWith(prefix)) return false;
  const relative = file.slice(prefix.length);
  if (!relative || relative === "release-manifest.json" ||
      relative.startsWith(".env") || relative.includes("/.env") ||
      relative === "DEPLOY.md" || relative === "handler.test.mjs" ||
      relative.includes("/node_modules/") ||
      /\.test\.(?:mjs|js|ts)$/.test(relative) ||
      /\.attestation\.json$/.test(relative)) return false;
  return /\.(?:mjs|js|json|html|css|svg|png|jpg|jpeg|webp)$/.test(relative) ||
    relative === "scf_bootstrap";
}

function trackedFiles() {
  return git("ls-files", "-z", "--", prefix)
    .toString("utf8").split("\0").filter(deployable).sort();
}

export function createSourceManifest() {
  // A dirty tracked source tree may create a falsely attributed package.
  try {
    git("diff", "--quiet", "HEAD", "--", prefix);
  } catch {
    throw new Error("Tracked report source differs from Git HEAD; commit and recheck first.");
  }
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z", "--", prefix)
    .toString("utf8").split("\0").filter((name) => name && name !== prefix + "release-manifest.json");
  if (untracked.length) throw new Error("Untracked files in the report service: review staging before packaging.");
  const files = trackedFiles().map((file) => ({
    path: file.slice(prefix.length),
    sha256: digest(readFileSync(path.join(root, file))),
  }));
  if (!files.length) throw new Error("No tracked report service files.");
  const sourceFilesSha256 = digest(JSON.stringify(files));
  const lockfileSha256 = digest(readFileSync(path.join(here, "package-lock.json")));
  return {
    schemaVersion: 1,
    sourceCommit: git("rev-parse", "HEAD").toString("utf8").trim(),
    sourceFilesSha256,
    lockfileSha256,
    fileCount: files.length,
    files,
  };
}

// Do not include the artifact's own digest in the embedded manifest: this
// would introduce a self-referential hash. Keep the attestation outside it.
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  const args = process.argv.slice(2);
  if (!args.length) {
    const manifest = createSourceManifest();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
    process.stdout.write(JSON.stringify({
      status: "PREPARED_NOT_DEPLOYED",
      sourceCommit: manifest.sourceCommit,
      sourceFilesSha256: manifest.sourceFilesSha256,
      lockfileSha256: manifest.lockfileSha256,
      fileCount: manifest.fileCount,
    }) + "\n");
  } else if (args.length === 2 && args[0] === "--attest") {
    const artifact = path.resolve(args[1]);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    // Attestation only after the final package has been prepared, not before.
    if (!manifest.sourceCommit || !manifest.sourceFilesSha256 || !manifest.lockfileSha256) {
      throw new Error("Missing prepared source manifest.");
    }
    const attestation = {
      schemaVersion: 1,
      ...Object.fromEntries(["sourceCommit", "sourceFilesSha256", "lockfileSha256"].map(k => [k, manifest[k]])),
      artifactSha256: digest(readFileSync(artifact)),
    };
    writeFileSync(artifact + ".attestation.json", JSON.stringify(attestation, null, 2) + "\n", { mode: 0o600 });
    process.stdout.write(JSON.stringify({ status: "ARTIFACT_ATTESTED_NOT_DEPLOYED", ...attestation }) + "\n");
  } else {
    throw new Error("Usage: build-release-manifest.mjs [--attest /path/to/final-package.zip]");
  }
}

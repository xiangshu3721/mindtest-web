import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createHandler } from "./lib/handler.mjs";
import { createMemoryStore } from "./lib/store.mjs";
import { createFeishuIndex } from "./lib/feishu.mjs";
import { loadReleaseMetadata, publicReleaseMetadata } from "./lib/release-provenance.mjs";
import { createSourceManifest } from "./build-release-manifest.mjs";

const COMMIT = "a".repeat(40);
const HASH = "b".repeat(64);
const manifest = () => ({
  schemaVersion: 1,
  sourceCommit: COMMIT,
  sourceFilesSha256: HASH,
  lockfileSha256: HASH,
  fileCount: 1,
  files: [{ path: "lib/handler.mjs", sha256: HASH }],
  linkSecret: "NOT_FOR_HEALTH",
  ownerToken: "NOT_FOR_HEALTH_EITHER",
});

test("health embeds only allowlisted release identifiers, not input secrets or file paths", async () => {
  const handler = createHandler({
    store: createMemoryStore("assessment_reports_dev"),
    feishu: createFeishuIndex({ FEISHU_INDEX_MODE: "off" }),
    releaseMetadata: manifest(),
    silent: true,
  });
  const res = await handler.handle({ method: "GET", path: "/health", headers: {} });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.release, {
    status: "EMBEDDED_UNATTESTED",
    sourceCommit: COMMIT,
    sourceFilesSha256: HASH,
    lockfileSha256: HASH,
    fileCount: 1,
  });
  const serialized = JSON.stringify(res);
  assert.ok(!serialized.includes("NOT_FOR_HEALTH"));
  assert.ok(!serialized.includes("handler.mjs"));
  assert.equal(res.headers["cache-control"], "no-store");
});

test("no manifest or malformed manifest never claims an audited deployment", () => {
  assert.deepEqual(publicReleaseMetadata(null), { status: "UNVERIFIED" });
  assert.deepEqual(publicReleaseMetadata({ ...manifest(), sourceCommit: "bad" }), { status: "UNVERIFIED" });
  assert.deepEqual(publicReleaseMetadata({ ...manifest(), files: [{ path: "../private", sha256: HASH }] }), { status: "UNVERIFIED" });
  assert.deepEqual(publicReleaseMetadata({ ...manifest(), fileCount: 2 }), { status: "UNVERIFIED" });
  const dir = mkdtempSync(path.join(tmpdir(), "asva-provider-manifest-"));
  try {
    const file = path.join(dir, "manifest.json");
    assert.deepEqual(loadReleaseMetadata(file), { status: "UNVERIFIED" });
    writeFileSync(file, JSON.stringify(manifest()));
    assert.equal(loadReleaseMetadata(file).status, "EMBEDDED_UNATTESTED");
    writeFileSync(file, "broken");
    assert.deepEqual(loadReleaseMetadata(file), { status: "UNVERIFIED" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report operations write status and duration only, never identifiers, test names or tokens", async () => {
  const reportId = "rpt_private_identifier_that_should_not_be_logged";
  const linkSecret = "secret_DO_NOT_LOG_in_handler";
  const assessmentId = "scl90_PRIVATE_TEST_KIND";
  const handler = createHandler({
    store: createMemoryStore("assessment_reports_dev"),
    feishu: createFeishuIndex({ FEISHU_INDEX_MODE: "off" }),
    silent: true,
  });
  const response = await handler.handle({
    method: "POST",
    path: "/v1/results/read",
    headers: {},
    body: { reportId, linkSecret, assessmentId },
    ip: "203.0.113.42",
  });
  assert.equal(response.status, 404);
  const logged = JSON.stringify(handler.logs);
  assert.ok(!logged.includes(reportId));
  assert.ok(!logged.includes(linkSecret));
  assert.ok(!logged.includes(assessmentId));
  assert.ok(!logged.includes("203.0.113.42"));
  assert.ok(handler.logs.every((item) => Object.keys(item).every((key) => ["svc", "status", "ms"].includes(key))));
});

test("source manifest derives a stable tracked-file inventory without reading customer data", () => {
  const first = createSourceManifest();
  const second = createSourceManifest();
  assert.deepEqual(first, second);
  assert.match(first.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(first.sourceFilesSha256, /^[a-f0-9]{64}$/);
  assert.match(first.lockfileSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.files.length, first.fileCount);
  assert.ok(first.files.every((item) => !item.path.includes(".env") && !item.path.includes("node_modules")));
  assert.equal(first.files.some((item) => item.path === "release-manifest.json"), false);
});

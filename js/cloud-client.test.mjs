import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ASSESSMENT_CLOUD_CONFIG } from "./assessment-cloud-config.js";
import {
  backoffMs,
  buildShareUrl,
  createCloudStore,
  createSubmissionIds,
  gateSubmit,
  orderKey,
  parseShareLink,
  resolveEndpoint,
  resolveReportBase,
} from "./cloud-client.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

test("未同意或没有服务地址时不提交", () => {
  assert.equal(gateSubmit({ agreed: false, endpoint: "http://127.0.0.1:4173", nickname: "小林" }).reason, "consent");
  assert.equal(gateSubmit({ agreed: true, endpoint: "", nickname: "小林" }).reason, "endpoint");
  assert.equal(gateSubmit({ agreed: true, endpoint: "http://127.0.0.1:4173", nickname: "小林" }).ok, true);
});

test("分享秘密只放在 hash，分数短链不能当报告号", () => {
  const parsed = parseShareLink("https://xiangshu3721.github.io/mindtest-web/r/#rpt_abcdefghijklmnopqrstuvwxyz.ownersecretvalue123456");
  assert.equal(parsed.reportId, "rpt_abcdefghijklmnopqrstuvwxyz");
  assert.equal(parsed.linkSecret, "ownersecretvalue123456");
  assert.equal(parseShareLink("https://xiangshu3721.github.io/5loves/?r=5.4.3.2.1"), null);
  assert.equal(parseShareLink("#rpt_short.secret"), null);
  assert.equal(parseShareLink("#short.secret"), null);
  const url = buildShareUrl("http://127.0.0.1:4173/r", parsed.reportId, parsed.linkSecret);
  assert.equal(url.includes("?"), false);
  assert.equal(url, "http://127.0.0.1:4173/r/#abcdefghijklmnopqrstuvwxyz.ownersecretvalue123456");
  assert.equal(parseShareLink(url).reportId, parsed.reportId);
});

test("断网队列保留同一次提交，放弃后删除", () => {
  const cloud = createCloudStore(memoryStorage());
  cloud.upsertPending({ reportId: "rpt_abcdefghijklmnopqrstuvwxyz", orderKey: orderKey(["自由"], ["稳定"]), attempts: 1 });
  cloud.saveOwner("rpt_abcdefghijklmnopqrstuvwxyz", "owner-token-value-1234567890");
  assert.equal(cloud.pending().length, 1);
  cloud.upsertPending({ reportId: "rpt_abcdefghijklmnopqrstuvwxyz", orderKey: "same", attempts: 2 });
  assert.equal(cloud.pending().length, 1);
  assert.equal(cloud.pending()[0].attempts, 2);
  assert.equal(backoffMs(1), 5000);
  assert.equal(backoffMs(2), 30000);
  assert.equal(backoffMs(3), 120000);
  cloud.removePending("rpt_abcdefghijklmnopqrstuvwxyz");
  assert.equal(cloud.pending().length, 0);
});

test("正式报告链接在 GitHub Pages，接口是 assessment-report-dev", async () => {
  assert.equal(ASSESSMENT_CLOUD_CONFIG.reportPageBase, "https://xiangshu3721.github.io/mindtest-web/r/");
  assert.equal(
    ASSESSMENT_CLOUD_CONFIG.endpoint,
    "https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev",
  );
  const base = resolveReportBase(
    { hostname: "xiangshu3721.github.io", origin: "https://xiangshu3721.github.io" },
    ASSESSMENT_CLOUD_CONFIG,
  );
  const url = buildShareUrl(base, "rpt_abcdefghijklmnopqrstuvwxyz", "ownersecretvalue123456");
  assert.equal(url, "https://xiangshu3721.github.io/mindtest-web/r/#abcdefghijklmnopqrstuvwxyz.ownersecretvalue123456");
  const page = await readFile(new URL("../r/index.html", import.meta.url), "utf8");
  const star = await readFile(new URL("../star/index.html", import.meta.url), "utf8");
  assert.match(page, /\.\.\/js\/report-page\.js/);
  assert.match(star, /js\/app\.js/);
  assert.equal(page.includes("tcloudbase"), false);
  assert.equal(star.includes("tcloudbase"), false);
});

test("新分享链接比旧的长链接短，旧链接仍能打开", () => {
  const ids = createSubmissionIds();
  assert.match(ids.reportId, /^rpt_[A-Za-z0-9_-]{16}$/);
  assert.match(ids.linkSecret, /^[A-Za-z0-9_-]{22}$/);
  assert.match(ids.ownerToken, /^[A-Za-z0-9_-]{22,128}$/);
  const url = buildShareUrl("https://xiangshu3721.github.io/mindtest-web/r/", ids.reportId, ids.linkSecret);
  const legacy = "https://xiangshu3721.github.io/mindtest-web/r/#rpt_abcdefghijklmnopqrstuvwx.0123456789abcdefghijklmnopqrstuvwxyz0123456";
  assert.equal(url.startsWith("https://xiangshu3721.github.io/mindtest-web/r/#"), true);
  assert.equal(url.includes("rpt_"), false);
  assert.ok(url.length <= 90);
  assert.ok(legacy.length - url.length >= 25);
  assert.equal(parseShareLink(url).reportId, ids.reportId);
  assert.equal(parseShareLink(url).linkSecret, ids.linkSecret);
  assert.equal(parseShareLink(legacy).reportId, "rpt_abcdefghijklmnopqrstuvwx");
  assert.equal(parseShareLink(legacy).linkSecret.length, 43);
});

test("本机自动连本地服务，GitHub Pages 在没配置端点时不连", () => {
  assert.equal(resolveEndpoint({ hostname: "127.0.0.1", origin: "http://127.0.0.1:4173" }, {}), "http://127.0.0.1:4173");
  assert.equal(resolveEndpoint({ hostname: "xiangshu3721.github.io", origin: "https://xiangshu3721.github.io" }, {}), "");
  assert.equal(resolveEndpoint({ hostname: "xiangshu3721.github.io" }, { endpoint: "https://example.test/assessmentReportDev" }), "https://example.test/assessmentReportDev");
});

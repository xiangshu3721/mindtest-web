import assert from "node:assert/strict";
import test from "node:test";
import {
  backoffMs,
  buildShareUrl,
  createCloudStore,
  gateSubmit,
  orderKey,
  parseShareLink,
  resolveEndpoint,
} from "./cloud-client.mjs";

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
  assert.equal(parseShareLink("https://xiangshu3721.github.io/5loves/?r=5.4.3.2.1"), null);
  assert.equal(parseShareLink("#rpt_short.secret"), null);
  const url = buildShareUrl("http://127.0.0.1:4173/r", parsed.reportId, parsed.linkSecret);
  assert.equal(url.includes("?"), false);
  assert.equal(url.startsWith("http://127.0.0.1:4173/r/#rpt_"), true);
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

test("本机自动连本地服务，GitHub Pages 在没配置端点时不连", () => {
  assert.equal(resolveEndpoint({ hostname: "127.0.0.1", origin: "http://127.0.0.1:4173" }, {}), "http://127.0.0.1:4173");
  assert.equal(resolveEndpoint({ hostname: "xiangshu3721.github.io", origin: "https://xiangshu3721.github.io" }, {}), "");
  assert.equal(resolveEndpoint({ hostname: "xiangshu3721.github.io" }, { endpoint: "https://example.test/assessmentReportDev" }), "https://example.test/assessmentReportDev");
});

/**
 * 合成飞书索引演练。默认不访问飞书。
 * 用法：node cloud/assessment-report/feishu-synthetic.mjs
 */
import { BASE_NAME, MIRROR_FIELDS, TABLE_NAME, createFeishuIndex, indexRow } from "./lib/feishu.mjs";

if (process.argv.includes("--live")) {
  console.error("这一轮不访问飞书。先完成 docs/assessment-cloud-v1/FEISHU_ACL.md，并等用户给出「ASVA 测评数据」的链接。不要加 --live。");
  process.exit(2);
}

const doc = {
  customerId: "",
  linkSecret: "oldlonglinksecretvalue",
  shareStatus: "active",
  archiveStatus: "未归档",
  feishuSync: "已同步",
  byteSize: 3072,
  createdAt: "2026-10-20T04:00:00.000Z",
  payload: {
    reportId: "rpt_syntheticexample01",
    nickname: "小林",
    assessmentId: "star",
    assessmentName: "职业六芒星",
    completedAt: "2026-10-20T12:00:00+08:00",
    result: { headline: "底层动力：自由、挑战性、创造性", summary: "现实追求：稳定、安全、健康" },
    source: { origin: "in-repo" },
    schemaVersion: "1.0.0",
    extensionData: {},
  },
};

const feishu = createFeishuIndex({ FEISHU_INDEX_MODE: "mock" });
const row = indexRow(doc);
await feishu.upsert(row);
row["报告状态"] = "已撤销";
await feishu.upsert({ ...row, "报告状态": "已撤销" });

if (feishu.rows.length !== 1) {
  console.error("同一报告 ID 出现了多行");
  process.exit(1);
}
if (feishu.rows[0]["报告 ID"] !== doc.payload.reportId) process.exit(1);
if (JSON.stringify(feishu.rows[0]).includes("linkSecret")) process.exit(1);
if (feishu.rows[0]["分享链接"] !== "https://xiangshu3721.github.io/mindtest-web/r/#syntheticexample01.oldlonglinksecretvalue") process.exit(1);

console.log(JSON.stringify({
  dryRun: true,
  base: BASE_NAME,
  table: TABLE_NAME,
  fields: MIRROR_FIELDS,
  rows: feishu.rows.length,
  reportId: feishu.rows[0]["报告 ID"],
  status: feishu.rows[0]["报告状态"],
  note: "进程内演练。没有请求 open.feishu.cn。",
}, null, 2));

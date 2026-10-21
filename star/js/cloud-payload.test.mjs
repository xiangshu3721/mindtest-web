import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORDS } from "./data.js";
import { buildStarResult, starNotes } from "./cloud-payload.js";
import { validateStarResult } from "../../cloud/assessment-report/lib/validate.mjs";

test("六芒星协议用分类词，不制造分数", async () => {
  const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
  assert.equal(source.includes("倒三角（底层动力）是划了三轮之后留下的 ${KEEP} 个词，是对你最要紧的。"), true);
  assert.equal(source.includes("正三角（现实追求）是从划掉的词里复活的 ${REVIVE} 个，是你现在想去够的。"), true);
  assert.equal(source.includes(starNotes()[2]), true);
  const report = buildStarResult({
    nickname: "小林",
    driveOrder: WORDS.slice(28),
    pursueOrder: WORDS.slice(0, 3),
    cull1: WORDS.slice(0, 15),
    cull2: WORDS.slice(15, 25),
    cull3: WORDS.slice(25, 28),
    revived: WORDS.slice(0, 3),
    reportId: "rpt_abcdefghijklmnopqrstuvwxyz",
    clientSubmissionId: "sub_abcdefghijklmnopqrstuvwxyz",
    completedAt: "2026-10-19T16:00:00+08:00",
  });
  assert.equal(validateStarResult(report).length, 0);
  assert.deepEqual(report.dimensions.map((item) => item.score), [null, null]);
  assert.equal(report.extensionData.score, null);
  assert.equal(report.result.code, null);
  assert.equal(JSON.stringify(report).includes("13800000000"), false);
  assert.equal(buildStarResult({ nickname: "", driveOrder: WORDS.slice(28), pursueOrder: WORDS.slice(0, 3), reportId: "rpt_abcdefghijklmnopqrstuvwxyz", clientSubmissionId: "sub_abcdefghijklmnopqrstuvwxyz", completedAt: "2026-10-19T16:00:00+08:00" }), null);
});

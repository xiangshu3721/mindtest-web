/**
 * CloudBase HTTP 函数入口。本轮不部署。
 * 只在显式确认后监听，并且集合名必须是 assessment_reports_dev。
 */
import { startLocalServer } from "./local-server.mjs";
import { assertDevCollection } from "./lib/ids.mjs";

assertDevCollection(process.env.ASSESSMENT_COLLECTION || "assessment_reports_dev");

if (process.env.ASSESSMENT_DEPLOY_CONFIRM !== "dev-isolated") {
  console.error("assessmentReportDev 未部署：缺少 ASSESSMENT_DEPLOY_CONFIRM=dev-isolated。不会连接生产 CloudBase。");
  process.exit(0);
}

startLocalServer({
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 9000),
});

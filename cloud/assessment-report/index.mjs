/**
 * CloudBase HTTP 函数入口。监听 PORT，与 asva-api 一样走云托管 HTTP。
 * 没有 ASSESSMENT_DEPLOY_CONFIRM=dev-isolated 时直接退出，不连接 PostgreSQL。
 * 确认部署之后必须使用 postgres 驱动。内存库会在冷启动后丢数据。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startLocalServer } from "./local-server.mjs";
import { assertDevCollection } from "./lib/ids.mjs";
import { isCloudStoreDriver } from "./lib/store.mjs";
import { feishuLiveReady } from "./lib/feishu.mjs";

export function deployBlockReason(env = process.env) {
  assertDevCollection(env.ASSESSMENT_COLLECTION || "assessment_reports_dev");
  if (env.ASSESSMENT_DEPLOY_CONFIRM !== "dev-isolated") return "hold";
  if (!isCloudStoreDriver(env.ASSESSMENT_STORE_DRIVER) || env.ASSESSMENT_CLOUDBASE_WRITE_CONFIRM !== "dev-isolated") {
    return "memory";
  }
  if (env.FEISHU_INDEX_MODE === "live" && !feishuLiveReady(env)) return "feishu-live";
  return "";
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntry) {
  const reason = deployBlockReason(process.env);
  if (reason === "hold") {
    console.error("assessmentReportDev 未部署：缺少 ASSESSMENT_DEPLOY_CONFIRM=dev-isolated。不会连接 CloudBase。");
    process.exit(0);
  }
  if (reason === "memory") {
    console.error("assessmentReportDev 拒绝以内存库启动。请设置 ASSESSMENT_STORE_DRIVER=postgres 与 ASSESSMENT_CLOUDBASE_WRITE_CONFIRM=dev-isolated。");
    process.exit(1);
  }
  if (reason === "feishu-live") {
    console.error("assessmentReportDev 拒绝启动：FEISHU_INDEX_MODE=live 但确认、表 ID 或应用凭证不齐。线上保持 off。");
    process.exit(1);
  }
  try {
    await startLocalServer({
      host: process.env.HOST || "0.0.0.0",
      port: Number(process.env.PORT || 9000),
    });
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
}

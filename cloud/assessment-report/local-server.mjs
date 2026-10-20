import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./lib/handler.mjs";
import { createCloudBaseStore, createMemoryStore, isCloudStoreDriver } from "./lib/store.mjs";
import { createFeishuIndex } from "./lib/feishu.mjs";
import { assertDevCollection } from "./lib/ids.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const collection = assertDevCollection(process.env.ASSESSMENT_COLLECTION || "assessment_reports_dev");

export function normalizeRequestPath(pathname) {
  const pathOnly = String(pathname || "/").split("?")[0];
  const prefix = "/assessmentReportDev";
  if (pathOnly === prefix) return "/";
  if (pathOnly.startsWith(`${prefix}/`)) return pathOnly.slice(prefix.length) || "/";
  return pathOnly;
}

async function openStore() {
  if (isCloudStoreDriver(process.env.ASSESSMENT_STORE_DRIVER)) {
    return createCloudBaseStore(process.env);
  }
  return createMemoryStore(collection);
}

function makeHandler(host, port, store, deployed) {
  return createHandler({
    store,
    deployed,
    feishu: createFeishuIndex({
      FEISHU_INDEX_MODE: process.env.FEISHU_INDEX_MODE || "off",
      FEISHU_ASSESSMENT_TABLE_ID: process.env.FEISHU_ASSESSMENT_TABLE_ID || "",
      FEISHU_INDEX_LIVE_CONFIRM: process.env.FEISHU_INDEX_LIVE_CONFIRM || "",
    }),
    importKey: process.env.ASVA_REPORT_IMPORT_KEY || "",
    publicReportBase: process.env.PUBLIC_REPORT_BASE || `http://${host}:${port}/r/`,
    allowedOrigins: [
      "https://xiangshu3721.github.io",
      `http://${host}:${port}`,
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ],
    silent: process.env.SILENT === "1",
  });
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function blocked(urlPath) {
  const normal = path.posix.normalize(urlPath);
  return normal.includes("..") || normal.split("/").some((part) => part.startsWith("."));
}

function sendJson(res, response) {
  const headers = { ...response.headers };
  if (response.body == null) {
    res.writeHead(response.status, headers);
    res.end();
    return;
  }
  const raw = JSON.stringify(response.body);
  headers["content-length"] = Buffer.byteLength(raw);
  res.writeHead(response.status, headers);
  res.end(raw);
}

export async function startLocalServer({ host = HOST, port = PORT } = {}) {
  const store = await openStore();
  const deployed = process.env.ASSESSMENT_DEPLOY_CONFIRM === "dev-isolated";
  const handler = makeHandler(host, port, store, deployed);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    const pathname = normalizeRequestPath(url.pathname);
    if (pathname.startsWith("/v1/") || pathname === "/health") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const response = await handler.handle({
        method: req.method,
        path: pathname,
        headers: req.headers,
        rawBody,
        ip: req.socket.remoteAddress || "local",
      });
      sendJson(res, response);
      return;
    }
    if (blocked(url.pathname)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.join(root, rel);
    if (!filePath.startsWith(root)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    try {
      const info = await stat(filePath);
      const finalPath = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const type = TYPES[path.extname(finalPath)] || "application/octet-stream";
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      createReadStream(finalPath).pipe(res);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  if (process.env.SILENT !== "1") {
    const address = server.address();
    console.log(JSON.stringify({
      svc: "assessmentReportDev",
      status: "listening",
      host,
      port: address && address.port,
      collection,
      store: store.driver,
      deployed,
      feishu: process.env.FEISHU_INDEX_MODE || "off",
      indexFallback: Boolean(store.indexFallback),
    }));
  }
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startLocalServer().catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  });
}

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./lib/handler.mjs";
import { createCloudBaseStore, createMemoryStore, isCloudStoreDriver } from "./lib/store.mjs";
import { createFeishuIndex } from "./lib/feishu.mjs";
import { assertDevCollection } from "./lib/ids.mjs";
import { GITHUB_PAGES_ORIGIN, HTTP_ORIGIN } from "./lib/preview.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const previewRoot = path.join(here, "preview-site");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const collection = assertDevCollection(process.env.ASSESSMENT_COLLECTION || "assessment_reports_dev");

export function normalizeRequestPath(pathname) {
  let pathOnly = String(pathname || "/").split("?")[0];
  for (const prefix of ["/assessment-report-dev", "/assessmentReportDev"]) {
    if (pathOnly === prefix) return "/";
    if (pathOnly.startsWith(`${prefix}/`)) {
      pathOnly = pathOnly.slice(prefix.length) || "/";
      break;
    }
  }
  return pathOnly;
}

function blocked(urlPath) {
  return String(urlPath || "").split("/").some((part) => part === ".." || part.startsWith("."));
}

export function resolveStatic(pathname, { deployed = false, repoRoot = root, siteRoot = previewRoot } = {}) {
  const normal = path.posix.normalize(String(pathname || "/"));
  if (!normal.startsWith("/") || blocked(pathname) || blocked(normal)) return null;
  if (normal === "/preview" || normal.startsWith("/preview/")) {
    let rel = normal.slice("/preview".length);
    if (!rel || rel === "/") rel = "/index.html";
    const filePath = path.resolve(siteRoot, `.${rel}`);
    const site = path.resolve(siteRoot);
    if (filePath !== site && !filePath.startsWith(`${site}${path.sep}`)) return null;
    return filePath;
  }
  if (deployed) return null;
  const rel = normal === "/" ? "/index.html" : normal;
  const filePath = path.resolve(repoRoot, `.${rel}`);
  const repo = path.resolve(repoRoot);
  if (filePath !== repo && !filePath.startsWith(`${repo}${path.sep}`)) return null;
  return filePath;
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
      FEISHU_APP_ID: process.env.FEISHU_APP_ID || "",
      FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || "",
      FEISHU_APP_TOKEN: process.env.FEISHU_APP_TOKEN || "",
    }),
    importKey: process.env.ASVA_REPORT_IMPORT_KEY || "",
    publicReportBase: process.env.PUBLIC_REPORT_BASE || `http://${host}:${port}/r/`,
    allowedOrigins: [
      GITHUB_PAGES_ORIGIN,
      HTTP_ORIGIN,
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

export async function startLocalServer({ host = HOST, port = PORT, deployed = process.env.ASSESSMENT_DEPLOY_CONFIRM === "dev-isolated" } = {}) {
  const store = await openStore();
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
    const filePath = resolveStatic(pathname, { deployed });
    if (!filePath) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    const base = pathname === "/preview" || pathname.startsWith("/preview/") ? previewRoot : root;
    try {
      const info = await stat(filePath);
      const finalPath = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const resolved = path.resolve(finalPath);
      const allowed = path.resolve(base);
      if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      const type = TYPES[path.extname(finalPath)] || "application/octet-stream";
      res.writeHead(200, {
        "content-type": type,
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      });
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

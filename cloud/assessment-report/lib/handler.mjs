import { byteSize, canonical, safeEqual, sha256 } from "./ids.mjs";
import { MAX_BODY_BYTES, validateSecrets, validateStarResult } from "./validate.mjs";
import { indexRow } from "./feishu.mjs";

const DUMMY_HASH = "0".repeat(64);

function limiter() {
  const hits = new Map();
  return {
    allow(key, limit, windowMs, now) {
      const prev = hits.get(key) || [];
      const fresh = prev.filter((stamp) => now - stamp < windowMs);
      if (fresh.length >= limit) {
        hits.set(key, fresh);
        return false;
      }
      fresh.push(now);
      hits.set(key, fresh);
      return true;
    },
  };
}

function originAllowed(origin, allowed) {
  if (!origin) return true;
  if (origin === "null") return false;
  return allowed.includes(origin);
}

function clientIp(headers, fallback = "local") {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return fallback;
}

function normalize(result) {
  const extensionData = { ...(result.extensionData || {}) };
  delete extensionData.share;
  return {
    ...result,
    extensionData: {
      ...extensionData,
      share: { scope: "link_holder", status: "active", revokedAt: null },
    },
  };
}

function hashable(result) {
  const copy = normalize(result);
  delete copy.extensionData.share;
  return copy;
}

export function createHandler(options) {
  const store = options.store;
  const feishu = options.feishu;
  const allowedOrigins = options.allowedOrigins || [
    "https://xiangshu3721.github.io",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
  ];
  const publicBase = (options.publicReportBase || "https://xiangshu3721.github.io/mindtest-web/r/").replace(/\/?$/, "/");
  const importKey = options.importKey || "";
  const logs = [];
  const limit = limiter();
  const silent = options.silent !== false;

  function log(entry) {
    const safe = {
      svc: "assessmentReportDev",
      reportId: entry.reportId || "",
      assessmentId: entry.assessmentId || "",
      status: entry.status,
      ms: entry.ms,
    };
    logs.push(safe);
    if (!silent) console.log(JSON.stringify(safe));
  }

  function finish(status, body, extra = {}) {
    return {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...extra.headers,
      },
      body,
      origin: extra.origin || "",
    };
  }

  async function create(body) {
    const result = body && body.result;
    const linkSecret = body && body.linkSecret;
    const ownerToken = body && body.ownerToken;
    const issues = validateSecrets(linkSecret, ownerToken).concat(validateStarResult(result));
    if (issues.length) return finish(422, { error: "invalid", issues });

    const submissionId = result.source.clientSubmissionId;
    const contentHash = sha256(canonical(hashable(result)));
    const linkHash = sha256(linkSecret);
    const ownerHash = sha256(ownerToken);
    const existing = await store.getBySubmission(submissionId);
    if (existing) {
      const same = existing.bodyHash === contentHash
        && safeEqual(existing.linkSecretHash, linkHash)
        && safeEqual(existing.ownerSecretHash, ownerHash);
      if (!same) return finish(409, { error: "conflict" });
      const refreshed = existing.feishuSync === "待重试" ? await syncMirror(existing) : existing;
      return finish(200, responseFor(refreshed, linkSecret, ownerToken));
    }
    if (await store.getByReportId(result.reportId)) return finish(409, { error: "conflict" });

    const payload = normalize(result);
    const size = byteSize(payload);
    const now = new Date().toISOString();
    let doc = {
      reportId: result.reportId,
      sourceSubmissionId: submissionId,
      bodyHash: contentHash,
      byteSize: size,
      linkSecretHash: linkHash,
      ownerSecretHash: ownerHash,
      shareStatus: "active",
      revokedAt: null,
      archiveStatus: "未归档",
      customerId: "",
      feishuSync: "待重试",
      feishuAttempts: 0,
      indexStatus: "待重试",
      createdAt: now,
      payload,
      collection: store.collection,
    };
    try {
      await store.insert(doc);
    } catch (error) {
      if (error && error.code === "duplicate") return finish(409, { error: "conflict" });
      throw error;
    }
    doc = await syncMirror(doc);
    return finish(200, responseFor(doc, linkSecret, ownerToken));
  }

  async function syncMirror(doc) {
    if (feishu.mode === "off") {
      return store.update(doc.reportId, { feishuSync: "off", indexStatus: "off" });
    }
    const attempts = (doc.feishuAttempts || 0) + 1;
    const failed = attempts >= 8 ? "失败" : "待重试";
    try {
      const result = await feishu.upsert(indexRow({ ...doc, feishuSync: "已同步", feishuAttempts: attempts }));
      if (result === "off") return store.update(doc.reportId, { feishuSync: "off", indexStatus: "off" });
      if (result !== "ok") {
        return store.update(doc.reportId, { feishuSync: failed, feishuAttempts: attempts, indexStatus: failed });
      }
      return store.update(doc.reportId, { feishuSync: "已同步", feishuAttempts: attempts, indexStatus: "已同步" });
    } catch {
      return store.update(doc.reportId, { feishuSync: failed, feishuAttempts: attempts, indexStatus: failed });
    }
  }

  async function retryMirrors() {
    const pending = (await store.all()).filter((doc) => doc.feishuSync === "待重试");
    const updated = [];
    for (const doc of pending) updated.push(await syncMirror(doc));
    return updated;
  }

  function responseFor(doc, linkSecret, ownerToken) {
    return {
      reportId: doc.reportId,
      reportUrl: `${publicBase}#${doc.reportId}.${linkSecret}`,
      ownerToken,
      status: doc.shareStatus,
      index: doc.indexStatus,
      byteSize: doc.byteSize,
      collection: doc.collection,
    };
  }

  async function read(body) {
    const reportId = body && body.reportId;
    const linkSecret = body && body.linkSecret;
    const doc = typeof reportId === "string" ? await store.getByReportId(reportId) : null;
    const presented = sha256(String(linkSecret || ""));
    const matched = safeEqual(doc ? doc.linkSecretHash : DUMMY_HASH, doc ? presented : DUMMY_HASH);
    if (!doc || !matched) return finish(404, { error: "not_found" });
    if (doc.shareStatus === "revoked") return finish(410, { error: "revoked" });
    return finish(200, doc.payload, { headers: { "x-report-bytes": String(doc.byteSize) } });
  }

  async function revoke(body) {
    const reportId = body && body.reportId;
    const ownerToken = body && body.ownerToken;
    const doc = typeof reportId === "string" ? await store.getByReportId(reportId) : null;
    const presented = sha256(String(ownerToken || ""));
    const matched = safeEqual(doc ? doc.ownerSecretHash : DUMMY_HASH, doc ? presented : DUMMY_HASH);
    if (!doc || !matched) return finish(404, { error: "not_found" });
    if (doc.shareStatus !== "revoked") {
      const revokedAt = new Date().toISOString();
      const payload = {
        ...doc.payload,
        extensionData: {
          ...doc.payload.extensionData,
          share: { scope: "link_holder", status: "revoked", revokedAt },
        },
      };
      const next = await store.update(reportId, {
        shareStatus: "revoked",
        revokedAt,
        payload,
      });
      await syncMirror(next);
    }
    return finish(200, { reportId, status: "revoked", archiveStatus: doc.archiveStatus || "未归档" });
  }

  function authorized(headers) {
    const header = String(headers.authorization || headers.Authorization || "");
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    const expected = importKey || "";
    return Boolean(expected) && safeEqual(sha256(presented), sha256(expected));
  }

  async function archive(body, headers) {
    if (!authorized(headers)) return finish(404, { error: "not_found" });
    const reportId = body && body.reportId;
    const linkSecret = body && body.linkSecret;
    const customerId = String((body && body.customerId) || "").trim();
    const doc = typeof reportId === "string" ? await store.getByReportId(reportId) : null;
    const presented = sha256(String(linkSecret || ""));
    const matched = safeEqual(doc ? doc.linkSecretHash : DUMMY_HASH, doc ? presented : DUMMY_HASH);
    if (!doc || !matched || !customerId) return finish(customerId ? 404 : 422, customerId ? { error: "not_found" } : { error: "customer_required" });
    if (doc.shareStatus === "revoked") return finish(410, { error: "revoked" });
    if (doc.archiveStatus === "已归档" && doc.customerId && doc.customerId !== customerId) {
      return finish(409, { error: "duplicate_customer" });
    }
    if (doc.archiveStatus === "已归档" && doc.customerId === customerId) {
      return finish(200, { reportId, archiveStatus: "已归档", duplicate: true, customerFieldsTouched: [] });
    }
    const next = await store.update(reportId, {
      archiveStatus: "已归档",
      customerId,
      archivedAt: new Date().toISOString(),
    });
    await syncMirror(next);
    return finish(200, {
      reportId,
      archiveStatus: "已归档",
      duplicate: false,
      customerFieldsTouched: [],
      nicknameAutoMatched: false,
    });
  }

  async function adminRead(body, headers) {
    if (!authorized(headers)) return finish(404, { error: "not_found" });
    return read(body);
  }

  async function handle(request) {
    const started = Date.now();
    const method = String(request.method || "GET").toUpperCase();
    const path = String(request.path || "/").split("?")[0];
    const headers = {};
    for (const [key, value] of Object.entries(request.headers || {})) headers[key.toLowerCase()] = value;
    const origin = headers.origin || "";
    if (!originAllowed(origin, allowedOrigins)) {
      const response = finish(403, { error: "origin" }, { origin });
      log({ status: 403, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }
    if (method === "OPTIONS") {
      return withCors(finish(204, null, { origin }), origin, allowedOrigins);
    }
    if (method === "GET" && (path === "/health" || path === "/assessmentReportDev/health")) {
      const response = finish(200, {
        ok: true,
        service: "assessmentReportDev",
        collection: store.collection,
        feishu: feishu.mode,
        store: store.driver,
        deployed: options.deployed === true,
      }, { origin });
      log({ status: 200, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }

    const routes = {
      "POST /v1/results": create,
      "POST /v1/results/read": read,
      "POST /v1/results/revoke": revoke,
      "POST /v1/integrations/asva/read": (body) => adminRead(body, headers),
      "POST /v1/integrations/asva/archive": (body) => archive(body, headers),
    };
    const route = routes[`${method} ${path}`];
    if (!route) {
      const response = finish(404, { error: "not_found" }, { origin });
      log({ status: 404, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }

    const ip = clientIp(headers, request.ip || "local");
    const now = request.now || Date.now();
    const budget = path.endsWith("/read") ? ["read", 30, 60_000] : ["write", 10, 60_000];
    if (!limit.allow(`${budget[0]}:${ip}`, budget[1], budget[2], now)) {
      const response = finish(429, { error: "rate_limited" }, { origin });
      log({ status: 429, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }
    if (path === "/v1/results" && !limit.allow(`hour:${ip}`, 40, 3_600_000, now)) {
      const response = finish(429, { error: "rate_limited" }, { origin });
      log({ status: 429, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }

    const raw = request.rawBody;
    if (typeof raw === "string" && Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      const response = finish(413, { error: "too_large" }, { origin });
      log({ status: 413, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }
    let body = request.body;
    if (body == null && typeof raw === "string" && raw.length) {
      try { body = JSON.parse(raw); } catch { body = null; }
    }
    if (path !== "/health" && (body == null || typeof body !== "object" || Array.isArray(body))) {
      const response = finish(422, { error: "invalid", issues: ["需要 JSON 对象"] }, { origin });
      log({ status: 422, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }
    if (byteSize(body) > MAX_BODY_BYTES) {
      const response = finish(413, { error: "too_large" }, { origin });
      log({ status: 413, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }

    try {
      const response = await route(body);
      response.origin = origin;
      const reportId = (body.result && body.result.reportId) || body.reportId || "";
      const assessmentId = (body.result && body.result.assessmentId) || (response.body && response.body.assessmentId) || "";
      log({ reportId, assessmentId, status: response.status, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    } catch {
      const response = finish(500, { error: "unavailable" }, { origin });
      log({ status: 500, ms: Date.now() - started });
      return withCors(response, origin, allowedOrigins);
    }
  }

  return { handle, logs, store, feishu, retryMirrors };
}

function withCors(response, origin, allowed) {
  if (origin && allowed.includes(origin)) {
    response.headers["access-control-allow-origin"] = origin;
    response.headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    response.headers["access-control-allow-headers"] = "Content-Type, Authorization";
    response.headers["access-control-max-age"] = "600";
    response.headers.vary = "Origin";
  }
  return response;
}

export function reportUrl(base, reportId, linkSecret) {
  return `${String(base).replace(/\/?$/, "/")}#${reportId}.${linkSecret}`;
}

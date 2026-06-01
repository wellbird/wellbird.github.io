/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  VISITOR_KEY_SECRET: string;
  ADMIN_TOKEN: string;
  RETENTION_DAYS?: string;
}

const ALLOWED_ORIGIN = "https://wellbird.github.io";
const THROTTLE_MS = 5_000;
const WINDOW_8H_MS = 8 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const MAX_EVENTS_SCAN = 200_000;

const BOT_RE =
  /bot|crawl|spider|slurp|bing|baidu|yandex|duckduck|facebookexternalhit|embedly|quora|pinterest|slackbot|telegrambot|whatsapp|preview|monitor|curl|wget|python-requests|go-http|java\/|headless|phantom|puppeteer|playwright|lighthouse|pingdom|uptime|gptbot|claudebot|ccbot|perplexity/i;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(obj: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function validPath(p: unknown): p is string {
  return typeof p === "string" && p.length > 0 && p.length <= 512 && p.startsWith("/") && !p.includes("://");
}

function referrerHost(ref: unknown): string | null {
  if (typeof ref !== "string" || ref.length === 0) return null;
  try {
    return new URL(ref).hostname.slice(0, 255) || null;
  } catch {
    return null;
  }
}

function parseWindowMs(w: string): number {
  if (w === "raw") return 0;
  const m = w.match(/^(\d+)(m|h)$/);
  if (!m) return WINDOW_8H_MS;
  const n = parseInt(m[1], 10);
  return m[2] === "h" ? n * 3_600_000 : n * 60_000;
}

function clampInt(v: string | null, def: number, lo: number, hi: number): number {
  const n = v == null ? def : parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}

function parseRangeMs(v: string | null): number | null {
  if (!v) return null;
  const dm = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) return Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) - KST_OFFSET_MS;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function kstDateStr(utcMs: number): string {
  const d = new Date(utcMs + KST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function kstDayStartUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method === "POST" && url.pathname === "/v") {
      return handleCollect(request, env);
    }
    if (request.method === "GET" && url.pathname === "/s") {
      return handleSummary(request, env, url);
    }
    return jsonResponse({ error: "not_found" }, 404);
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await runScheduled(env);
  },
};

async function handleCollect(request: Request, env: Env): Promise<Response> {
  const headers = { ...corsHeaders() };

  const origin = request.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) {
    return jsonResponse({ counted: false, reason: "origin" }, 403, headers);
  }

  let body: any;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return jsonResponse({ counted: false, reason: "bad_body" }, 400, headers);
  }

  const path = body?.path;
  if (!validPath(path)) {
    return jsonResponse({ counted: false, reason: "bad_path" }, 400, headers);
  }

  const ua = (request.headers.get("User-Agent") || "").trim().slice(0, 400);
  if (!ua || BOT_RE.test(ua)) {
    return jsonResponse({ counted: false, reason: "bot" }, 200, headers);
  }

  const ip = (request.headers.get("CF-Connecting-IP") || "").trim();
  const title = typeof body?.title === "string" ? body.title.slice(0, 300) : null;
  const refHost = referrerHost(body?.referrer);

  const visitorKey = await hmacHex(env.VISITOR_KEY_SECRET, ip + "\n" + ua);
  const throttleKey = await hmacHex(env.VISITOR_KEY_SECRET, ip + "\n" + ua + "\n" + path);

  const now = Date.now();
  const expires = now + THROTTLE_MS;

  const gate = await env.DB.prepare(
    `INSERT INTO write_throttle (throttle_key, expires_at) VALUES (?1, ?2)
     ON CONFLICT(throttle_key) DO UPDATE SET expires_at = ?2 WHERE write_throttle.expires_at < ?3`,
  )
    .bind(throttleKey, expires, now)
    .run();

  if (!gate.meta || gate.meta.changes !== 1) {
    return jsonResponse({ counted: false, reason: "throttled" }, 200, headers);
  }

  await env.DB.prepare(
    `INSERT INTO events (id, path, title, referrer_host, visitor_key, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(crypto.randomUUID(), path, title, refHost, visitorKey, now)
    .run();

  return jsonResponse({ counted: true }, 200, headers);
}

async function handleSummary(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m || !timingSafeEqual(m[1], env.ADMIN_TOKEN)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const windowParam = url.searchParams.get("window") || "8h";
  const windowMs = parseWindowMs(windowParam);
  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 500);
  const pathFilter = url.searchParams.get("path");

  const now = Date.now();
  let until = parseRangeMs(url.searchParams.get("until"));
  let since = parseRangeMs(url.searchParams.get("since"));
  if (until == null) until = now;
  if (since == null) since = until - 7 * DAY_MS;
  if (until - since > 90 * DAY_MS) since = until - 90 * DAY_MS;

  let q = `SELECT path, title, visitor_key, ts FROM events WHERE ts >= ?1 AND ts < ?2`;
  const binds: any[] = [since, until];
  if (pathFilter) {
    q += ` AND path = ?3`;
    binds.push(pathFilter);
  }
  q += ` ORDER BY path, visitor_key, ts LIMIT ${MAX_EVENTS_SCAN}`;

  const rows = ((await env.DB.prepare(q).bind(...binds).all()).results || []) as Array<{
    path: string;
    title: string | null;
    visitor_key: string;
    ts: number;
  }>;

  type Agg = { path: string; title: string | null; raw: number; views: number; uniq: number };
  const perPath = new Map<string, Agg>();
  const siteUniq = new Set<string>();
  let curPath = "";
  let curVk = "";
  let lastTs = 0;

  for (const r of rows) {
    let a = perPath.get(r.path);
    if (!a) {
      a = { path: r.path, title: r.title ?? null, raw: 0, views: 0, uniq: 0 };
      perPath.set(r.path, a);
    }
    a.raw++;
    siteUniq.add(r.visitor_key);
    const newGroup = !(r.path === curPath && r.visitor_key === curVk);
    if (newGroup) a.uniq++;

    let isView = false;
    if (windowMs === 0) isView = true;
    else if (newGroup) isView = true;
    else if (r.ts - lastTs >= windowMs) isView = true;
    if (isView) a.views++;

    curPath = r.path;
    curVk = r.visitor_key;
    lastTs = r.ts;
  }

  const paths = [...perPath.values()]
    .sort((x, y) => y.views - x.views)
    .slice(0, limit)
    .map((a) => ({
      path: a.path,
      title: a.title,
      raw_events: a.raw,
      views: a.views,
      unique_visitors: a.uniq,
    }));

  const totals = {
    raw_events: rows.length,
    path_views: [...perPath.values()].reduce((s, a) => s + a.views, 0),
    unique_visitors: siteUniq.size,
  };

  return jsonResponse({ window: windowParam, since, until, truncated: rows.length >= MAX_EVENTS_SCAN, totals, paths }, 200);
}

async function runScheduled(env: Env): Promise<void> {
  const now = Date.now();

  await env.DB.prepare(`DELETE FROM write_throttle WHERE expires_at < ?1`).bind(now).run();

  const retentionDays = parseInt(env.RETENTION_DAYS ?? "365", 10);
  if (Number.isFinite(retentionDays) && retentionDays > 0) {
    await env.DB.prepare(`DELETE FROM events WHERE ts < ?1`).bind(now - retentionDays * DAY_MS).run();
  }

  await aggregateDay(env, kstDateStr(now - DAY_MS), now);
}

async function aggregateDay(env: Env, dateStr: string, nowMs: number): Promise<void> {
  const dayStart = kstDayStartUtcMs(dateStr);
  const dayEnd = dayStart + DAY_MS;
  const lookbackStart = dayStart - WINDOW_8H_MS;

  const rows = ((await env.DB.prepare(
    `SELECT path, title, visitor_key, ts FROM events WHERE ts >= ?1 AND ts < ?2 ORDER BY path, visitor_key, ts LIMIT ${MAX_EVENTS_SCAN}`,
  )
    .bind(lookbackStart, dayEnd)
    .all()).results || []) as Array<{ path: string; title: string | null; visitor_key: string; ts: number }>;

  type Agg = { title: string | null; raw: number; views8h: number; uniq: Set<string> };
  const perPath = new Map<string, Agg>();
  const siteUniq = new Set<string>();
  let siteRaw = 0;
  let siteViews = 0;
  let curPath = "";
  let curVk = "";
  let lastTs = 0;

  for (const r of rows) {
    const inDay = r.ts >= dayStart && r.ts < dayEnd;
    let a = perPath.get(r.path);
    if (!a) {
      a = { title: r.title ?? null, raw: 0, views8h: 0, uniq: new Set() };
      perPath.set(r.path, a);
    }
    const newGroup = !(r.path === curPath && r.visitor_key === curVk);

    let isView = false;
    if (newGroup) isView = true;
    else if (r.ts - lastTs >= WINDOW_8H_MS) isView = true;

    if (inDay) {
      a.raw++;
      siteRaw++;
      a.uniq.add(r.visitor_key);
      siteUniq.add(r.visitor_key);
      if (isView) {
        a.views8h++;
        siteViews++;
      }
      if (r.title) a.title = r.title;
    }

    curPath = r.path;
    curVk = r.visitor_key;
    lastTs = r.ts;
  }

  const stmts: D1PreparedStatement[] = [];
  for (const [p, a] of perPath) {
    if (a.raw === 0) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO daily_path_stats (date, path, title, raw_events, views_8h, unique_visitors, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(date, path) DO UPDATE SET
           title = ?3, raw_events = ?4, views_8h = ?5, unique_visitors = ?6, updated_at = ?7`,
      ).bind(dateStr, p, a.title, a.raw, a.views8h, a.uniq.size, nowMs),
    );
  }
  stmts.push(
    env.DB.prepare(
      `INSERT INTO daily_site_stats (date, raw_events, path_views_8h, unique_visitors, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(date) DO UPDATE SET
         raw_events = ?2, path_views_8h = ?3, unique_visitors = ?4, updated_at = ?5`,
    ).bind(dateStr, siteRaw, siteViews, siteUniq.size, nowMs),
  );

  if (stmts.length > 0) await env.DB.batch(stmts);
}

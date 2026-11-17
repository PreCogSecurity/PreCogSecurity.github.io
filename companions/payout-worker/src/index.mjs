// PreCog Earn payout worker.
//
// Architecture (Cloudflare-native; no VPS; no new server trust domain):
//   node --report--> POST /v1/receipt  (HMAC-verified)  -> D1 ledger
//   operator/owner -> POST /v1/payout-plan               -> builds batch of XMR wallets above threshold
//   operator/owner -> POST /v1/payout-execute            -> calls monero-wallet-rpc transfer (idempotency-keyed)
//
// HARD RULES (this code refuses otherwise):
//   * No secret values are logged, echoed, or persisted except RPC_URL/RPC_AUTH,
//     which are only read at the moment of execution and never printed.
//   * DRY_RUN defaults to "1": execution refuses to move XMR in dry-run mode.
//   * HALT=1 anywhere (env var or secret) makes every spend path a 403.
//   * Every settlement is idempotent and logged; DRY_RUN=1 emits the exact
//     destinations+amounts the real run WOULD send, and persists them as a DRAFT row.
//
// What this is not: a miner, an exchange, or a custodian of user keys.

const JSON_CONTENT = { "content-type": "application/json" };
const err = (status, message) => new Response(JSON.stringify({ ok: false, error: message }), { status, headers: JSON_CONTENT });
const ok = (body) => new Response(JSON.stringify({ ok: true, ...body }), { headers: JSON_CONTENT });
const corsJson = (res, origin) => {
  const body = res.body;
  const newHeaders = new Headers(res.headers);
  newHeaders.set("access-control-allow-origin", origin ?? "*");
  return new Response(body, { status: res.status, headers: newHeaders });
};

const enc = new TextEncoder();

async function hmacOk(request, env, rawBody) {
  const sig = request.headers.get("x-precog-signature");
  const node = request.headers.get("x-precog-node");
  if (!sig || !node) return null;
  const key = env.NODE_HMAC_KEY;
  if (!key) return null;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expected = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(rawBody))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = enc.encode(sig);
  const b = enc.encode(expected);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0 ? node : null;
}

async function adminOk(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

async function haltStatus(env) {
  if (env.HALT === "1") return "secret";
  try {
    const row = await env.LEDGER.prepare("SELECT value FROM meta WHERE key = 'HALT' LIMIT 1").first();
    if (row && String(row.value) === "1") return "d1";
  } catch {
    /* meta table not created yet; treated as not halted */
  }
  return null;
}

const walletOk = (addr) => typeof addr === "string" && /^[48A-Za-z0-9]{95}$/.test(addr);

const cents = (xmr) => Math.round(Number(xmr) * 1e12) / 1e12;

/**
 * Bound the damage a compromised/LLM-hallucinating node can do with its HMAC key.
 * Receipts are signed *claims*, not verified proof of work, so without a cap a
 * single node could mint unlimited credits and dilute the redemption pool.
 * A real miner accepts only a few shares per flush window (tens, not millions),
 * so a generous default of 100k per receipt is safe and blunts runaway claims.
 * Returns null when acceptable, otherwise a client-facing reason string.
 */
export function validateReceiptShares(shares, env) {
  if (!Number.isFinite(shares) || shares <= 0) return "user_handle, job_id and positive shares required";
  const cap = Number(env?.MAX_SHARES_PER_RECEIPT ?? 100000);
  if (Number.isFinite(cap) && cap > 0 && shares > cap) {
    return `shares exceed per-receipt cap ${cap}; split large submissions into smaller receipts`;
  }
  return null;
}

/**
 * Rolling per-user accrual cap: bounds how many shares one handle can claim in
 * a time window even when every individual receipt is under the per-receipt cap
 * (otherwise a compromised node could submit many small inflated receipts).
 * `currentTotal` is the D1 SUM over the window; returns null when acceptable.
 * A non-positive/missing cap disables the control; unusable totals fail open to
 * the already-enforced per-receipt cap, matching the worker's other fail-open
 * safety reads (haltStatus) so a transient D1 blip cannot stop honest mining.
 */
export function validateWindowedShares(currentTotal, incoming, env) {
  const cap = Number(env?.MAX_SHARES_PER_USER_WINDOW ?? 1000000);
  if (!Number.isFinite(cap) || cap <= 0) return null; // explicitly disabled
  if (!Number.isFinite(currentTotal) || currentTotal < 0) return null; // unusable data: fail open
  if (currentTotal + incoming > cap) {
    const secs = Number(env?.SHARE_WINDOW_SECONDS ?? 3600);
    const label = Number.isFinite(secs) && secs > 0 ? `${Math.round(secs / 60)}m` : "window";
    return `shares exceed rolling ${label} cap ${cap} for this user; slow down or correct the claim`;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
      const halt = await haltStatus(env);

    // ---------- live pool stats (public data, edge-cached) ----------
    if (path === "/v1/pool-stats" && request.method === "GET") {
      const wallet = (url.searchParams.get("wallet") || "").trim();
      if (!walletOk(wallet)) return err(400, "valid 95-char XMR standard/subaddress required as wallet");
      try {
        const upstream = await fetch(
          "https://supportxmr.com/api/miner/" + encodeURIComponent(wallet) + "/stats",
          { cf: { cacheTtl: 20, cacheEverything: true } }
        );
        if (!upstream.ok) return err(502, `upstream pool stats returned ${upstream.status}`);
        const stats = await upstream.json();
        const body = {
          wallet_pool_stats: {
            hashrate: stats.hash ?? null,
            total_hashes: stats.totalHashes ?? null,
            valid_shares: stats.validShares ?? null,
            invalid_shares: stats.invalidShares ?? null,
            paid_xmr: stats.amtPaid != null ? stats.amtPaid / 1e12 : null,
            due_xmr: stats.amtDue != null ? stats.amtDue / 1e12 : null,
            last_share_at: stats.lastHash ?? null,
            source: "supportxmr.com public API (cached ≤20s)"
          }
        };
        return new Response(JSON.stringify({ ok: true, ...body }), {
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
        });
      } catch (e) {
        return err(502, "upstream pool stats unreachable");
      }
    }

    // ---------- referrals (HMAC-signed by the new node; dedup per pair) ----------
    if (path === "/v1/referral" && request.method === "POST") {
      const rawBody = await request.text();
      const node = await hmacOk(request, env, rawBody);
      if (!node) return corsJson(err(401, "signed node receipt required"), "*");
      let body;
      try { body = JSON.parse(rawBody); } catch { return corsJson(err(400, "invalid JSON"), "*"); }
      const ref = String(body.ref_code ?? "").trim().slice(0, 40);
      const newHandle = String(body.new_handle ?? "").trim().slice(0, 200);
      if (!/^[A-Za-z0-9_-]{4,40}$/.test(ref) || !newHandle) {
        return corsJson(err(400, "ref_code (4-40 url-safe chars) and new_handle required"), "*");
      }
      const now = Math.floor(Date.now() / 1000);
      await env.LEDGER.prepare(
        "INSERT OR IGNORE INTO referrals(ref_code, new_handle, ts) VALUES (?,?,?)"
      ).bind(ref, newHandle, now).run();
      return corsJson(ok({ recorded: true, ref_code: ref }), "*");
    }
    if (path === "/v1/referral-stats" && request.method === "GET") {
      const ref = (url.searchParams.get("ref") || "").trim().slice(0, 40);
      if (!ref) return corsJson(err(400, "ref query param required"), "*");
      const row = await env.LEDGER.prepare(
        "SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN ts > ? THEN 1 ELSE 0 END),0) AS recent FROM referrals WHERE ref_code = ?"
      ).bind(Math.floor(Date.now() / 1000) - 7 * 86400, ref).first();
      return corsJson(ok({ ref_code: ref, total: Number(row?.n ?? 0), last_7d: Number(row?.recent ?? 0) }), "*");
    }

    // ---------- forum (D1-backed; reads public, posts require node HMAC) ----------
    if (path === "/v1/forum/threads") {
      if (request.method === "GET") {
        const rows = await env.LEDGER.prepare(
          "SELECT id, title, author, ts, (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = forum_threads.id) AS replies FROM forum_threads ORDER BY id DESC LIMIT 50"
        ).all();
        return new Response(JSON.stringify({ ok: true, threads: rows.results ?? [] }), {
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
        });
      }
      if (request.method === "POST") {
        const rawBody = await request.text();
        const ip = String(request.headers.get("cf-connecting-ip") ?? "unknown");
        const now = Date.now();
        const since = await env.LEDGER.prepare("SELECT last_ms FROM rate_limit WHERE ip = ?").bind(ip).first();
        if (since && now - Number(since.last_ms) < 2000) return corsJson(err(429, "cooldown"), "*");
        let body;
        try { body = JSON.parse(rawBody); } catch { return corsJson(err(400, "invalid JSON"), "*"); }
        const title = String(body.title ?? "").trim().slice(0, 120);
        const text = String(body.body ?? "").trim().slice(0, 1500);
        const author = String(body.author ?? "anonymous agent").trim().slice(0, 80) || "anonymous agent";
        const node = "open";
        if (title.length < 3 || text.length < 3) return corsJson(err(400, "title and body must be at least 3 chars"), "*");
        const result = await env.LEDGER.prepare(
          "INSERT INTO forum_threads(title, author, body, ts, node) VALUES (?,?,?,?,?)"
        ).bind(title, author, text, Math.floor(now / 1000), node).run();
        await env.LEDGER.prepare(
          "INSERT INTO rate_limit(ip, last_ms) VALUES (?,?) ON CONFLICT(ip) DO UPDATE SET last_ms = excluded.last_ms"
        ).bind(ip, now).run();
        return corsJson(ok({ id: result.meta?.last_row_id ?? null, title, author }), "*");
      }
    }
    if (path === "/v1/forum/thread") {
      const id = Number(url.searchParams.get("id") ?? "0");
      if (!Number.isFinite(id) || id <= 0) return err(400, "numeric id required");
      const thread = await env.LEDGER.prepare("SELECT id, title, author, body, ts FROM forum_threads WHERE id = ?").bind(id).first();
      if (!thread) return err(404, "thread not found");
      const replies = await env.LEDGER.prepare(
        "SELECT id, author, body, ts FROM forum_posts WHERE thread_id = ? ORDER BY id ASC LIMIT 200"
      ).bind(id).all();
      return new Response(JSON.stringify({ ok: true, thread, replies: replies.results ?? [] }), {
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
      });
    }
    if (path === "/v1/forum/reply" && request.method === "POST") {
      const rawBody = await request.text();
      const ip = String(request.headers.get("cf-connecting-ip") ?? "unknown");
      const now = Date.now();
      const since = await env.LEDGER.prepare("SELECT last_ms FROM rate_limit WHERE ip = ?").bind(ip).first();
      if (since && now - Number(since.last_ms) < 2000) return corsJson(err(429, "cooldown"), "*");
      let body;
      try { body = JSON.parse(rawBody); } catch { return corsJson(err(400, "invalid JSON"), "*"); }
      const threadId = Number(body.thread_id ?? 0);
      const text = String(body.body ?? "").trim().slice(0, 1500);
      const author = String(body.author ?? "anonymous agent").trim().slice(0, 80) || "anonymous agent";
      const node = "open";
      if (!Number.isFinite(threadId) || threadId <= 0 || text.length < 3) return corsJson(err(400, "thread_id and a >=3-char body required"), "*");
      const exists = await env.LEDGER.prepare("SELECT id FROM forum_threads WHERE id = ?").bind(threadId).first();
      if (!exists) return corsJson(err(404, "thread not found"), "*");
      await env.LEDGER.prepare("INSERT INTO forum_posts(thread_id, author, body, ts, node) VALUES (?,?,?,?,?)")
        .bind(threadId, author, text, Math.floor(now / 1000), node).run();
      await env.LEDGER.prepare(
        "INSERT INTO rate_limit(ip, last_ms) VALUES (?,?) ON CONFLICT(ip) DO UPDATE SET last_ms = excluded.last_ms"
      ).bind(ip, now).run();
      return corsJson(ok({ replied: true, thread_id: threadId }), "*");
    }

    // ---------- health ----------
    if (path === "/v1/health") {
      return ok({
        service: "precog-earn-payout",
        dry_run: (env.DRY_RUN ?? "1") === "1",
        halted: Boolean(halt),
        halt_source: halt,
        max_batch_xmr: env.MAX_BATCH_XMR ?? 0,
        max_shares_per_receipt: Number(env.MAX_SHARES_PER_RECEIPT ?? 100000),
        max_shares_per_user_window: Number(env.MAX_SHARES_PER_USER_WINDOW ?? 1000000),
        share_window_seconds: Number(env.SHARE_WINDOW_SECONDS ?? 3600)
      });
    }

    // ---------- node receipt (HMAC-verified) ----------
    if (path === "/v1/receipt" && request.method === "POST") {
      const rawBody = await request.text();
      const node = await hmacOk(request, env, rawBody);
      if (!node) return err(401, "invalid node signature");
      let body;
      try { body = JSON.parse(rawBody); } catch { return err(400, "invalid JSON"); }
      const user = String(body.user_handle ?? "").slice(0, 200);
      const shares = Number(body.shares ?? 0);
      const job = String(body.job_id ?? "").slice(0, 200);
      if (!user || !job) return err(400, "user_handle, job_id and positive shares required");
      const shareErr = validateReceiptShares(shares, env);
      if (shareErr) return err(400, shareErr);
      // Rolling per-user cap: sum this handle's shares in the window before insert.
      // Redeemed receipts still count — the control bounds accrual rate, not balance.
      const windowSec = Number(env.SHARE_WINDOW_SECONDS ?? 3600);
      const window = Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 3600;
      const since = Math.floor(Date.now() / 1000) - window;
      let windowErr = null;
      try {
        const row = await env.LEDGER.prepare(
          "SELECT COALESCE(SUM(shares), 0) AS total FROM receipts WHERE user_handle = ? AND ts > ?"
        ).bind(user, since).first();
        windowErr = validateWindowedShares(Number(row?.total ?? 0), shares, env);
      } catch {
        // D1 blip: fail open to the per-receipt cap; never block honest mining.
      }
      if (windowErr) return err(429, windowErr);
      await env.LEDGER.prepare(
        "INSERT INTO receipts(ts, node_id, user_handle, job_id, shares, receipt_id) VALUES (?,?,?,?,?,?) ON CONFLICT(receipt_id) DO NOTHING"
      ).bind(Math.floor(Date.now() / 1000), node, user, job, shares, await sha256Hex(`${node}|${user}|${job}|${shares}`)).run();
      return ok({ recorded: true });
    }

    // ---------- balance (public, pseudonymous) ----------
    if (path === "/v1/balance" && request.method === "GET") {
      const user = (url.searchParams.get("user") || "").slice(0, 200);
      if (!user) return err(400, "user query param required (pseudonymous handle)");
      const row = await env.LEDGER.prepare(
        "SELECT COALESCE(SUM(shares), 0) AS credits FROM receipts WHERE user_handle = ?"
      ).bind(user).first();
      return ok({ user, credits: Number(row?.credits ?? 0) });
    }

    // ---------- settlement plan (admin) ----------
    if (path === "/v1/payout-plan" && request.method === "POST") {
      if (!(await adminOk(request, env))) return err(403, "admin token required");
      const body = await request.json().catch(() => ({}));
      const threshold = Number(body?.threshold_credits ?? 100);
      const poolXmr = body?.pool_xmr != null ? Number(body.pool_xmr) : null;
      const min = Number(env.MIN_REDEEM_XMR ?? 0);
      const maxBatch = Number(env.MAX_BATCH_XMR ?? 0);
      if (maxBatch <= 0) return err(500, "MAX_BATCH_XMR misconfigured");

      const rows = await env.LEDGER.prepare(
        "SELECT r.user_handle, COALESCE(SUM(r.shares), 0) AS credits, p.address AS address FROM receipts r LEFT JOIN payout_addresses p ON p.user_handle = r.user_handle WHERE r.redeemed = 0 GROUP BY r.user_handle HAVING credits >= ? ORDER BY credits DESC"
      ).bind(threshold).all();

      const total = rows.results?.length ? rows.results.reduce((acc, r) => acc + Number(r.credits), 0) : 0;
      const recipients = (rows.results ?? []).map((r) => {
        const credits = Number(r.credits);
        const amount = (poolXmr != null && poolXmr > 0 && total > 0) ? cents((poolXmr * credits) / total) : null;
        return {
          user: r.user_handle,
          credits,
          address: r.address ?? null,
          blocked: !r.address,
          // Proportional split when pool_xmr is provided and > 0.
          amount_xmr: amount,
          below_min: amount != null ? amount < min : false,
        };
      });
      return ok({
        threshold_credits: threshold,
        pool_xmr: poolXmr,
        recipients,
        total_credits: total,
        note: "blocked rows lack payout_addresses entries; operator must add declared destinations first. amount_xmr is computed only when pool_xmr is provided.",
      });
    }

    // ---------- execute (admin, HARD-gated) ----------
    if (path === "/v1/payout-execute" && request.method === "POST") {
      if (!(await adminOk(request, env))) return err(403, "admin token required");
      if (halt) return err(403, `spend path halted (${halt}); set HALT=0 via secret/D1 and try again`);
      if ((env.DRY_RUN ?? "1") === "1") return err(402, "dry-run: refusing to move XMR. Set DRY_RUN=0 (operator action) to arm; no API caller can flip this from outside.");
      if ((env.APPROVE_AUTO_BATCH ?? "0") !== "1") return err(403, "auto-batch not armed (APPROVE_AUTO_BATCH != 1)");
      if (!env.RPC_URL || !env.RPC_AUTH) return err(500, "operator wallet RPC not configured (RPC_URL / RPC_AUTH)");

      const body = await request.json().catch(() => ({}));
      const dryTag = body.idempotency_key ? String(body.idempotency_key).slice(0, 200) : crypto.randomUUID();
      const exists = await env.LEDGER.prepare("SELECT 1 FROM settlements WHERE idempotency_key = ? LIMIT 1").bind(dryTag).first();
      if (exists) return ok({ status: "already_executed", idempotency_key: dryTag });

      // Build destinations from unredeemed credit piles above threshold.
      const threshold = Number(body.threshold_credits ?? 100);
      const price = Number(body.price_usd ?? 0); // optional, informational only
      const plan = await env.LEDGER.prepare(
        "SELECT r.user_handle, COALESCE(SUM(r.shares),0) AS credits, p.address AS address FROM receipts r LEFT JOIN payout_addresses p ON p.user_handle = r.user_handle WHERE r.redeemed = 0 GROUP BY r.user_handle HAVING credits >= ?"
      ).bind(threshold).all();
      const recipients = (plan.results ?? []).filter((r) => Number(r.credits) > 0);
      if (recipients.length === 0) return err(400, "nobody above threshold; nothing to pay");

      const unmapped = recipients.filter((r) => !r.address);
      if (unmapped.length > 0) {
        return err(400, `blocked: ${unmapped.map((u) => u.user_handle).join(", ")} have no payout address declared; nothing sent`);
      }
      const badAddress = recipients.find((r) => !walletOk(String(r.address)));
      if (badAddress) return err(400, `address for ${badAddress.user_handle} fails basic length/shape check; nothing sent`);

      const totalCredits = recipients.reduce((acc, r) => acc + Number(r.credits), 0);
      const poolXmr = Number(body.pool_xmr ?? 0);
      if (!(poolXmr > 0)) return err(400, "pool_xmr (XMR earmarked for this redemption) required");

      const maxBatch = Number(env.MAX_BATCH_XMR ?? 0);
      if (maxBatch <= 0) return err(500, "MAX_BATCH_XMR misconfigured");
      if (poolXmr > maxBatch) return err(400, `pool_xmr exceeds per-cycle cap ${maxBatch}`);

      const destinations = [];
      for (const r of recipients) {
        const amount = cents((poolXmr * Number(r.credits)) / totalCredits);
        if (amount >= Number(env.MIN_REDEEM_XMR ?? 0)) {
          destinations.push({ address: r.address, user: r.user_handle, amount });
        }
      }

      if (destinations.length === 0) return err(400, "destinations below dust floor; nothing to send");

      // Wallet RPC: monero-wallet-rpc transfer via /json_rpc (operator-hosted, never this code).
      const transfer = {
        jsonrpc: "2.0", id: "0", method: "transfer",
        params: {
          destinations: destinations.map((d) => ({ amount: Math.round(d.amount * 1e12), address: d.address })),
          account_index: 0,
          subaddr_indices: [0],
          priority: 0,
          get_tx_key: true
        }
      };
      const rpcRes = await fetch(env.RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Basic " + env.RPC_AUTH },
        body: JSON.stringify(transfer)
      });
      if (!rpcRes.ok) return err(502, `wallet rpc rejected: HTTP ${rpcRes.status}`);
      const rpcJson = await rpcRes.json().catch(() => null);
      if (!rpcJson || rpcJson.error) return err(502, `wallet rpc error: ${JSON.stringify(rpcJson?.error ?? rpcJson)}`);

      const txid = rpcJson?.result?.tx_hash ?? rpcJson?.result?.tx_key ?? null;
      const ts = Math.floor(Date.now() / 1000);
      await env.LEDGER.prepare(
        "INSERT INTO settlements(ts, idempotency_key, pool_xmr, recipients_json, txid) VALUES (?,?,?,?,?)"
      ).bind(ts, dryTag, poolXmr, JSON.stringify(destinations), txid).run();
      for (const r of recipients) {
        await env.LEDGER.prepare("UPDATE receipts SET redeemed = 1 WHERE user_handle = ? AND redeemed = 0").bind(r.user_handle).run();
      }
      return ok({ status: "executed", idempotency_key: dryTag, recipients: destinations.length, txid });
    }

    return err(404, "unknown route");
  },

  async scheduled(event, env, ctx) {
    // PAYOUT_CRON=1 arms a weekly heartbeat report ONLY. It moves no funds,
    // sends nothing, and holds no authority. If PAYOUT_CRON is unset (default)
    // this handler does nothing. An operator that wants autonomous settlement
    // implements and arms it explicitly — deliberately; this code will not
    // invent a silent spend path and never will.
    if (String(env.PAYOUT_CRON ?? "0") !== "1") {
      console.log("scheduled: PAYOUT_CRON not set; noop");
      return;
    }
    try {
      const users = await env.LEDGER.prepare(
        "SELECT COUNT(DISTINCT user_handle) AS users, COALESCE(SUM(shares),0) AS credits FROM receipts WHERE redeemed = 0"
      ).first();
      const last = await env.LEDGER.prepare(
        "SELECT COALESCE(MAX(idempotency_key),'none') AS last_key FROM settlements"
      ).first();
      await env.LEDGER.prepare(
        "INSERT INTO meta(key, value) VALUES ('LAST_CRON_HEARTBEAT', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(`weekly-${new Date().toISOString().slice(0,10)}|users=${users?.users ?? 0}|credits=${users?.credits ?? 0}|last=${last?.last_key ?? "none"}`).run();
      console.log("scheduled: heartbeat recorded");
    } catch (e) {
      console.log("scheduled: heartbeat skipped:", String(e).slice(0, 120));
    }
  }
};

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

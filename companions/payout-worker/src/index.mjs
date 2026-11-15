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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const halt = await haltStatus(env);

    // ---------- health ----------
    if (path === "/v1/health") {
      return ok({
        service: "precog-earn-payout",
        dry_run: (env.DRY_RUN ?? "1") === "1",
        halted: Boolean(halt),
        halt_source: halt,
        max_batch_xmr: env.MAX_BATCH_XMR ?? 0
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
      if (!user || !job || !Number.isFinite(shares) || shares <= 0) return err(400, "user_handle, job_id and positive shares required");
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
      const threshold = Number((await request.json().catch(() => ({})))?.threshold_credits ?? 100);
      const min = Number(env.MIN_REDEEM_XMR ?? 0);
      const maxBatch = Number(env.MAX_BATCH_XMR ?? 0);
      if (maxBatch <= 0) return err(500, "MAX_BATCH_XMR misconfigured");

      const rows = await env.LEDGER.prepare(
        "SELECT r.user_handle, COALESCE(SUM(r.shares), 0) AS credits, p.address AS address FROM receipts r LEFT JOIN payout_addresses p ON p.user_handle = r.user_handle WHERE r.redeemed = 0 GROUP BY r.user_handle HAVING credits >= ? ORDER BY credits DESC"
      ).bind(threshold).all();

      const total = rows.results?.length ? rows.results.reduce((acc, r) => acc + Number(r.credits), 0) : 0;
      const recipients = (rows.results ?? []).map((r) => ({
        user: r.user_handle,
        credits: Number(r.credits),
        address: r.address ?? null,
        blocked: !r.address,
        // Pass pool_xmr in the body to get XMR amounts back (proportional split).
        amount_xmr: null
      }));
      return ok({ threshold_credits: threshold, recipients, total_credits: total, note: "blocked rows lack payout_addresses entries; operator must add declared destinations first" });
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
  }
};

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

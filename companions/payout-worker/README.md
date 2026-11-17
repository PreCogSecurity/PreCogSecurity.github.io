# PreCog Earn payout worker (Cloudflare-native)

Turns the redemption ledger into an automatic settlement rail **that the operator arms deliberately.** No VPS, no relay, no third party holding keys.

## Topology

```
 desktop node ──HMAC-signed share receipt─▶ Worker ──▶ D1 (append-only ledger)
                                             │
   account web (precogsecurity.pages.dev) ◀──┼── GET /v1/balance?user=handle
                                             │
                              operator       ▼
                            POST /v1/payout-plan ──▶ builds eligible recipients above threshold
                            POST /v1/payout-execute ──▶ calls YOUR monero-wallet-rpc.transfer()
```

- Miner receipts are **HMAC-signed** by the node (`NODE_HMAC_KEY`). The worker never learns wallet addresses from miners implicitly: destinations come only from `payout_addresses`, which the operator populates from declared payout addresses. A handle with no declared destination is **blocked, never sent**.
- Settlement is a **single atomic batch** per cycle, proportional to outstanding credits inside the declared redemption pool, capped by `MAX_BATCH_XMR`, idempotent by `idempotency_key`.
- `DRY_RUN=1` (default) makes the spend path refuse; `HALT=1` (env or `meta` row) freezes it entirely — a circuit breaker any operator can trip without redeploying.
- All receipts carry `receipt_id` — replayed shares are **de-duplicated at insert**, so a compromised node cannot replay stale share claims to drain the pool.

## Hard boundaries (non-negotiable, by design)

1. This service **does not verify proof of work.** RandomX verification needs the ~2.3 GB dataset; Workers isolates use ~128 MB. Verification happens on the operator's own reconciliation step (or on a mining pool verifier upstream). Receipts are signed *claims*, not proofs. Because they are claims, every receipt is capped: `MAX_SHARES_PER_RECEIPT` (default 100000, tunable in `wrangler.toml`) rejects oversized share assertions at ingest, so one compromised node holding the HMAC key cannot mint unlimited credits and dilute the redemption pool. This cap bounds loss per claim; it is not PoW verification.
2. **No address is ever inferred** — unmapped handles are blocked from settlement.
3. **No fee custody.** The worker does not hold XMR; your `monero-wallet-rpc` (operator-owned) does the actual send.
4. **HALT is a one-member table.** One `UPDATE meta SET value='1' WHERE key='HALT'` and every spend path returns 403 — including yours — until you set it back.

## Operator runbook

Prereqs (yours, not mine to buy):
- Cloudflare account on free plan (Workers + D1 free tier covers a pilot; paid usage starts well under $5/mo).
- A Monero wallet RPC endpoint you control. Easiest: `monero-wallet-rpc` running on your own hardware/VM, exposed to the worker via **Cloudflare Tunnel** (`cloudflared`) — no open ports, no public RPC.
- Declared payout addresses collected from users (one-time import into `payout_addresses`).
- Approvals queue entry for your first settlement — this is *your* treasury.

Bring-up:

```bash
# 1) create the ledger D1
npx wrangler d1 create precog-earn-ledger
#    paste resulting database_id into wrangler.toml (replace REPLACE_WITH_YOUR_D1_ID)
# 2) load the schema
npx wrangler d1 execute precog-earn-ledger --file=schema.sql
# 3) wire the worker name + dry-run stays ON
npx wrangler deploy
# 4) set secrets (values never leave the account):
npx wrangler secret put ADMIN_TOKEN      # bearer for payout-plan/execute
npx wrangler secret put NODE_HMAC_KEY    # matches the HMAC key the node signs receipts with
npx wrangler secret put RPC_URL          # e.g. http://127.0.0.1:18082 (tunnel URL)
npx wrangler secret put RPC_AUTH         # base64 "user:pass" of the wallet RPC
# 5) smoke test (dry-run; nothing moves)
curl -X POST $URL/v1/payout-plan -H "Authorization: Bearer $TOKEN" -d '{"threshold_credits":1,"pool_xmr":0}'
# 6) when you are satisfied, activate automatic settlement (operator-only act):
npx wrangler secret put APPROVE_AUTO_BATCH   # type: 1
```

Halt procedure:

```bash
npx wrangler secret put HALT   # value: 1
# or set meta.HALT=1 via wrangler d1 execute; both freeze all spend paths.
```

## What is automatic after arming

- Redemption happens on **your schedule**, not mine: the node's next `payout-execute` call (a cron Worker you add later is trivial) calculates the batch, sends via YOUR wallet RPC, marks receipts redeemed, records `txid`.
- Never before your `pool-statement.json` (net proceeds, split_pct) declares the amount. Never to undeclared handles. Never above `MAX_BATCH_XMR`. Never while `HALT=1`.

## Honest limitations

- **No RandomX verification.** Treat receipts as claims reconciled at settlement; cap per-cycle loss like any trusted-assertion system.
- **No fiat rails here.** XMR to declared XMR addresses only. If you want PayPal/EcoCash/bank rails, that is a separate legal+payroll build; don't pretend it into existence.
- **Security model is "operator can lose their own treasury, within their own cap."** That is the correct ceiling for a pilot.

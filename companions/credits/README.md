# PreCog Earn — credits & payout accounting (honest spec)

## What "provably fair" means here — and what it does NOT

**What it means:**
- Every earning event is an append-only, hash-chained ledger entry
  (`precog-earn-credits.jsonl`), verifiable by anyone with the file via
  `python credits_ledger.py verify`.
- Allocation is proportional to valid shares — the same rule the browser
  demo shows — computed openly: `credits_u / sum(credits)`.
- Users are pseudonymous handles (HMAC of their identity with a company
  salt), so balances can be published without leaking PII.
- Any retroactive edit breaks the chain from that point onward.

**What it does NOT mean:**
- It is **not** a zero-knowledge proof. It is **not** a blockchain. Claiming
  otherwise on the marketing page would be false. No ZKP implementation is
  shipped, because a correct one is a multi-week cryptographic build, not a
  config flag. If we prove useful later, the honest primitive is keyed-HMAC
  commitments compared against the public chain, not magic math.
- It does **not** guarantee payouts. No service can. Payouts are issued by
  humans from the operator-blessed treasury, per request threshold.

## Anti-gaming rules (implemented in `credits_ledger.py`)

1. Receipts require `{user, job, shares}`; the module recomputes `receipt_id
   = sha256(user|job|shares)` and rejects replays (logged as
   `receipt_rejected`).
2. Balances are computed from the chain at read time — no mutable counters.
3. Draft payouts are only generated when a balance crosses the threshold;
   they carry `requires_human_approval: true`.

## 50/50 redemption protocol (company treasury model)

Mined XMR lands in the company treasury. Economics and etiquette:

- 50% of **net** proceeds (after pool fee, network fee, and wear reserve)
  is declared in an off-cycle human sign-off (`pool-statement.json`:
  `net_xmr`, `split_pct`, optional `price_usd`).
- That half funds the **redemption pool**: each credit is redeemable for an
  equal slice of the pool (`credits_u / outstanding_credits × pool`).
- `python credits_ledger.py allocate-redemption --statement stmt.json`
  writes one DRAFT per outstanding handle into
  `precog-earn-payout-drafts.json`, each flagged `requires_human_approval`.
- A human maps handles → declared payout destinations and records sends in
  the approval ledger. No code executes settlement.
- The public chain + public allocation math IS the whole proof to users:
  here is every share ever logged and the division of every declared pool.
  If payout rates ever disagree with published math, the company is caught
  by its own ledger — that is the mechanism, nothing more mystical.

## Payout flow (human-gated, always)

1. Node mines to the **company treasury** (operator-blessed BTC/XMR/ETH rail).
2. Logged shares accrue internal **credits** for the user.
3. When credits ≥ threshold (default 100), `draft-payouts` writes
   `precog-earn-payout-drafts.json` with `kind: "draft"`.
4. A human reviews drafts, maps handle → user's declared payout destination,
   and records approvals in `D:\PreCog\datafactor-ops\payout-approvals.json`.
5. **Execution is a human act.** No code in this repository sends funds,
   signs transactions, or sets `autoExecute`.

## Why proportional, and what "equal" would require

Proportional-by-shares is the only rule that survives unequal hardware.
An "equal split" (1/N) requires: registered cohort, equal/randomized job
assignment, anti-free-rider checks (miss rate caps), and disclosed terms —
it is an opt-in program, never the universal rule.

## Anti-drain, in plain terms

- The treasury receives all mined coin; users receive credits; credits
  convert to payouts only after threshold + human approval.
- A compromised node can inject at most its own signed share claims; the
  operator sets per-node share caps and dispute windows at review time.
- The ledger is published (mirror it in a public repo) so any pattern of
  over-crediting is visible to everyone, including you.

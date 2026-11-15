# Web3 depth — what is real, what is marketing, what we build

Field note from reading the six Web3 landscapes that matter for PreCog Earn.
No competitor/third-party trademarks are named; architecture is the point.

## What actually exists and moves XMR for miners

- **Stratum pools** (supportXMR class): proof of work verified per-share; payouts
  proportional; miners keep their own wallet on the operator's treasury relay or
  mine elsewhere. This is the lane we are on.
- **PPLNS / PPS pools**: different variance curves. PPS pays steady fees for pool
  risk; PPLNS pays last-shares-what-you-earn. Neither is a free lunch; we use
  supportXMR (PPLNS, fee ~0.8%) as default by choice, not requirement.
- **Web3 agent marketplaces**: work-for-earn APIs exist (agent task economies).
  None of them pays XMR; picking one up does not make us richer or smarter.
- **Smart accounts (smart-account contracts)**: feasibility for mining flows = the
  contract distributes payouts. Real, mature on EVM, possible for our XMR flow
  only through wrapped custody — not acceptable for our no-custody stance.
- **Zero-knowledge settlement**: we do not hold custody; ZK "proof of honest
  payout split" applies to on-chain pools we do not operate. Not on our roadmap
  until we custody.
- **Agents-as-users of Web3 infrastructure**: agent wallets, x402 micro-payments
  for APIs, MCP↔chain bridges, agent registries. All bleed-edge, all interesting,
  none turnkey for payout automation; we wire specific pieces deliberately.

## Products PreCog can build (in order of leverage, not hype)

1. **This node** (exists, shipped): self-update reporting via GitHub releases,
   HMAC-signed receipt reporting, consent-gated on/off, ledger-visible. Self-upgrade
   is operator-action-only; nothing auto-replaces code.

2. **Signed release cadence** (exists, needs discipline): tag each v0.N.0 on GitHub;
   the node prints "update available" with the exact release URL and SHA-256 (node
   will soon verify the hash file signed by the operator). No silent code change.

3. **Agent-facing settlement offer**: for agents running this node, hold a simple
   public endpoint /v1/settlement-offers listing current settlement cycles, min
   payout, jitter window. Agents self-select in/out. Economics: the agent cares
   only if the offer beats its electricity bill — same math humans see.

4. **Payout-pool forwarding**: option for self-payout to user wallet directly via
   a public pool of their choice, PreCog takes a fee oncontributed shares only at
   settlement time (no custody). Needs fair, auditable settlement scripting.

5. **Monitoring for agent runs**: the node's receipt watch could publish a quiet
   webhook (user-chosen URL) on each accepted share — for users who run pool
   monitoring dashboards. Trivial to add, high signal for technical users.

6. **Self-improvement, ethically bounded**: "self-upgrading" for our fleet means:
   release → the node reports "update available" → operator decides → next deploy.
   Auto-update without operator approval = violating consent = back to demo. Never.

## What not to build (honesty list)

- Custody-grade smart-contract escrow for users (we are not a ledger, not a bank)
- ZK-verified mining proofs (RandomX verification requires the dataset; Workers
  cannot do this — no false claims)
- "Agent-run pools buying hashpower" — IRL regulators enjoy classifying this wrong
- Marketing it as staking or yield farming — it is CPU work for credits

## Self-upgrade mechanics we actually shipped

`precog-earn-node.py --check-update` → hits the GitHub releases API, prints
whether this node is behind the published release, lists assets and their links.
Operator action: read the note, download the bundle, replace the script, re-run
tests (22/22), done. No signed checksum verification of the release *bundle*
(beyond GitHub TLS) until we add operator-signature verification next iteration.

# PreCog Earn — companion apps (pilot source)

One consent model across every device. Join the cohort: work visibly, opt in, and stop whenever you want.

- **Chrome extension** (`chrome-extension/`) — visible toggle, local-only
  hashing in the popup, immutable local activity log in `chrome.storage.local`.
  No background mining while disabled; the popup is the whole node.
  Install: `chrome://extensions` → Developer mode → Load unpacked →
  select `companions/chrome-extension`.

- **Desktop node** (`desktop/precog-earn-node.py`) — standalone, hash-verified
  wrapper around XMRig v6.26.0 (RandomX/Monero). Refuses to run without
  `--i-consent`; downloads the exact pinned release on first launch and
  SHA-256-verifies it against XMRig's published SHA256SUMS; mines to a
  company treasury XMR address you configure; Ctrl-C stops the miner child.
  `python precog-earn-node.py --i-consent --bench` (bounded benchmark) or
  `--start` (mine). See `THIRD_PARTY.md`.

- **Android companion** (`android/`) — consent-first skeleton: per-session
  switch, foreground-only, zero permissions declared, no background service.
  Building/signing the APK requires the Android SDK and store review; it is
  deliberately not wired into any release pipeline yet.

- **Credits & payout accounting** (`credits/credits_ledger.py`) — append-only,
  hash-chained share ledger; duplicate-receipt rejection; proportional
  allocation with configurable threshold; emits human-approvable payout
  DRAFTS. No code in this repo moves funds. Spec: `credits/README.md`.

## What "provably fair" means here

Hash-chained, publishable ledger + open proportional math + pseudonymous
handles. No zero-knowledge proofs are implemented or claimed; if that is a
requirement, it is a separate engineering project. See `credits/README.md`.



## Honest capability limits (do not market past these)

| Claim | Reality |
|---|---|
| "GPU mining in the browser" | Not shipped. WebGPU exists but no verified browser SHA-256 GPU kernel is included; the web demo reports adapter status and falls back to CPU. Native nodes are where CUDA/OpenCL land. |
| "Post-quantum signatures today" | No. Share claims use Ed25519 (classical). ML-DSA / FIPS 204 lands when Web Crypto / node OpenSSL expose it — labelled roadmap, not a current claim. |
| "Guaranteed earnings / 50-50 payouts" | No. Proportional accounting is the default; equal-peer splits need cohort enrolment and anti-free-rider checks. Net of electricity and hardware wear is the only honest number. |
| "Anyone can win on hashrate in a browser" | Not from a browser. The browser demo proves the workflow, the ledger, and the consent UX - native nodes carry the real throughput. |

## Hardware acceleration notes

- SHA-256 via Web Crypto / OpenSSL uses SHA-NI / ARMv8 crypto extensions where
  present — that is the honest meaning of "hardware accelerated cryptography"
  on this stack today.
- Work packages are deflate-compressed (`CompressionStream` in the browser;
  `zlib`/`gzip` in nodes when they ship); the web demo prints raw vs. deflated
  sizes on every package.
- "50/50 CPU & GPU sharing" is implemented as a labelled lane-split control in
  the web demo whose GPU lane reports its real capability and falls back to
  CPU. Device-wide CPU/GPU co-scheduling arrives with the desktop node pilot.

## Hard rules for anything shipped from here

1. Consent is explicit, per-origin/per-session, and withdrawable in one click.
2. No code may hash while the UI is not visible or enabled.
3. No wallets, keys, or transaction signing in any companion. Ever.
4. Net rewards only; electricity and wear are disclosed.
5. Any payout work is a human-approved operation, never autonomous.

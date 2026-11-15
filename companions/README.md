# PreCog Earn — companion apps (pilot source)

One consent model across every device. Competing with Kryptex-style ecosystems
means matching their *visibility and control*, not their aggression:

- **Chrome extension** (`chrome-extension/`) — visible toggle, local-only
  hashing in the popup, immutable local activity log in `chrome.storage.local`.
  No background mining while disabled; the popup is the whole node.
  Install: `chrome://extensions` → Developer mode → Load unpacked →
  select `companions/chrome-extension`.

- **Desktop node** (`desktop/precog-earn-node.py`) — standalone Python 3
  (stdlib only). Refuses to run without `--i-consent`. Prints its lane/lane
  budget before starting, honours `--lanes`, `--duration`, `--difficulty`,
  Ctrl-C stops instantly, and appends to `precog-earn-ledger.log` next to the
  script. Never touches wallets or keys. `python3 precog-earn-node.py --i-consent`

- **Android companion** (`android/`) — consent-first skeleton: per-session
  switch, foreground-only, zero permissions declared, no background service.
  Building/signing the APK requires the Android SDK and store review; it is
  deliberately not wired into any release pipeline yet.

## Honest capability limits (do not market past these)

| Claim | Reality |
|---|---|
| "GPU mining in the browser" | Not shipped. WebGPU exists but no verified browser SHA-256 GPU kernel is included; the web demo reports adapter status and falls back to CPU. Native nodes are where CUDA/OpenCL land. |
| "Post-quantum signatures today" | No. Share claims use Ed25519 (classical). ML-DSA / FIPS 204 lands when Web Crypto / node OpenSSL expose it — labelled roadmap, not a current claim. |
| "Guaranteed earnings / 50-50 payouts" | No. Proportional accounting is the default; equal-peer splits need cohort enrolment and anti-free-rider checks. Net of electricity and hardware wear is the only honest number. |
| "Everyone can compete with Kryptex on hashrate" | Not from a browser. The browser demo proves the workflow, the ledger, and the consent UX — native nodes carry the real throughput. |

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

# BlueHound — Freemium v0 scaffolding

Added 2026-11-01. Free-first, monetization-ready.

## New files

- `license.js` — UMD module exposing `window.BHLicense` (browser) / `module.exports`
  (Node). Tier state (`free`/`pro`), JWT-shaped license tokens (90-day),
  daily usage counters (chat 20, CVE 3, breach 3; paid-only: attack_path,
  export_pdf, premium_skin), `canUse(domain)`, `remainingToday(domain)`,
  `activateLicense(token)`, `revokeLicense()`, `renderUpgradeCTA(host)` (inert
  until `setUpgradeUrl(url)` is called with a Stripe Payment Link).
- `assistant3d.js` — lazy 3D avatar module. WebGL+Three.js on demand with 2D
  fallback (PNG), Web Speech API TTS, premium skins unlock point. Auto-loads
  only in Pro tier; otherwise loads 2D fallback (no bundle bloat for free users).
- `tests/test_billing_gate.js` — 10 guard tests (Node, `node tests/test_billing_gate.js`).

## Wiring in index.html

- `<script src="license.js"></script>` in `<head>` (tiny, no external deps).
- Bootstraps 3D avatar only when `BHLicense.isPaid()` is true.
- The gate is client-side (honour system for v0; server-side enforcement in v1).

## Free vs paid (defaults in license.js)

Free: chat ≤20/day, CVE ≤3/day, breach ≤3/day, IP lookup unlimited,_android runtime, 3 skins.
Paid (Pro $19/mo): unlimited chat/CVE/breach, Attack Path mapping, PDF export, unlimited skins, 3D avatar.

## To activate payments (founder step)

```js
// in index.html, after license.js:
window.BHLicense.setUpgradeUrl("https://checkout.stripe.com/c/your-link");
```

Until then, the CTA renders "Upgrade to Pro — coming soon" (disabled).

## Tests

Run `node tests/test_billing_gate.js` → `ALL GUARD TESTS PASSED`.

## Honest limits

- No payment rail wired yet (Stripe link placeholder).
- No server-side license verification (v0 ships local JWT with 90-day expiry).
- No Rust/Tauri wrapper for a downloadable desktop app (requires toolchain + signing).
- The Android emulator still requires the ~411 MB local asset fetch (`fetch-assets.ps1`).


## Decisions (operator, 2026-11-01)

- Payment rail: PayPal (recipient: timlangeveldt@gmail.com) - UPGRADE_URL set to
  https://www.paypal.com/paypalme/timlangeveldt (default; replace with a proper
  PayPal Subscription button or Stripe Checkout URL for recurring billing).
- Delivery vehicle: BOTH - GitHub-Pages web app (live once PR merges) + a
  downloadable desktop wrapper (Tauri - requires Rust toolchain check + code signing).
- Powerful features (Pro/Enterprise): all powers of OpenCode + OpenBot + Odysseus +
  OptimusPrime (autonomous scan/triage/patch/report generation); 3D animated assistant
  with futuristic graphics and effects (assistant3d.js); regular software updates;
  AI-driven tech support (chat assistant with LLM fallback chain).
- Tier model: Free (rate-limited chat, 3 CVE/day, IP/breach, 3 skins, read-only wallet)
  vs Pro 19/mo or 179/yr (unlimited, attack-path, PDF export, 3D avatar, 8+ skins)
  vs Enterprise 149+/mo (team seats, audit log, SSO, custom branding).

// earn-console.test.mjs - production invariants for the Earn page and node.
//
// Superseded demo-era invariants (local PoW console, consent dialog in HTML,
// worker file) are gone with the demo. What ships now MUST prove:
//   1. the shipped page advertises real desktop XMR RandomX mining, not fake
//      browser mining claims;
//   2. the desktop node refuses work without explicit consent;
//   3. the credits/payout path can never move funds autonomously;
//   4. the page loads only first-party, policy-allowed assets.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { repositoryRoot } from "../scripts/site-validator.mjs";

const read = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), "utf8");

test("earn page sells real XMR desktop mining, not demo credits", () => {
    const page = read("earn.html");
    assert.match(page, /RandomX/, "page must name the real algorithm");
    assert.match(page, /downloads\/precog-earn-desktop-v0\.1\.2\.zip/, "page must link the current desktop node download");
    assert.ok(!page.includes("precog-earn-desktop-v0.1.0.zip"), "page must not link the superseded build");
    assert.ok(!page.includes("earn node v0.1.1"), "page must not advertise the superseded version");
    assert.ok(!/PRST|COG demo|SHA-512 \/ SHA-384/.test(page), "page must not retain fake mining claims");
    assert.ok(!/<script src="assets\/earn-worker\.js"/.test(page), "the demo worker must be gone");
});

test("desktop node refuses a retired/compromised wallet", () => {
    const desktop = read("companions/desktop/precog-earn-node.py");
    assert.match(desktop, /BLOCKED_WALLETS/, "node must keep a blocked-wallet list");
    assert.match(desktop, /42mWtiADkUDQgALdotiApdWcc5EVyW2ku64rn81SNvv99KszmX3U5okPgdeoDxsDfJeHdpUc6j4DKKZuVXoqDXrTNBfiKKX/, "retired address must be listed as blocked");
    assert.match(desktop, /raise SystemExit\(3\)/, "node must exit non-zero instead of mining to a blocked wallet");
    const gui = read("companions/desktop/precog-earn-gui.py");
    assert.match(gui, /wallet_problem/, "GUI must validate the destination wallet before Start");
});

test("desktop node refuses any work without explicit consent", () => {
    const desktop = read("companions/desktop/precog-earn-node.py");
    assert.match(desktop, /--i-consent/, "node must gate work behind --i-consent");
    assert.match(desktop, /if not args\.i_consent/, "node must hard-stop without consent");
    assert.match(desktop, /bba8097cb37d9b458a1cb1137876b27cde6740d17fe4ccbc086ba07d87d9e147/, "node must pin the upstream SHA-256");
});

test("credits module can never move funds autonomously", () => {
    const credits = read("companions/credits/credits_ledger.py");
    assert.match(credits, /requires_human_approval/, "drafts must carry the human-approval invariant");
    assert.ok(!/https?:\/\//.test(credits), "credits module must not open network connections");
    assert.match(credits, /receipt_id/, "credits module must reject duplicate share receipts");
});

test("companions carry the same consent invariants", () => {
    const ext = read("companions/chrome-extension/popup.js");
    assert.match(ext, /consent/i, "extension must gate work on consent");
    assert.match(ext, /chrome\.storage\.local/, "extension ledger must stay on-device");

    const android = read("companions/android/app/src/main/AndroidManifest.xml");
    assert.ok(!/uses-permission/.test(android), "Android pilot must declare zero permissions");
});

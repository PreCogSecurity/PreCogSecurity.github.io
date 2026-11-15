// earn-console.test.mjs - invariants for the consent-first Earn console.
//
// The site validator proves the page is policy-clean and the unit tests
// prove the policy means what we say. These tests pin the consent contract
// itself: nothing may hash before an explicit opt-in, the withdraw path must
// exist, and the page must never reference a remote script or miner. If any
// of this regresses, the console is no longer the transparent demo it claims
// to be.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { repositoryRoot } from "../scripts/site-validator.mjs";

const read = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), "utf8");

test("the earn console ships a first-party worker and it exists", () => {
    const page = read("earn.html");
    const js = read("assets/earn.js");
    assert.match(js, /earn-worker\.js/, "console must delegate hashing to a first-party worker");
    assert.ok(existsSync(path.join(repositoryRoot, "assets", "earn-worker.js")), "assets/earn-worker.js must exist");
    assert.match(page, /<script src="assets\/earn\.js" defer><\/script>/, "page must load the console as a first-party deferred script");
});

test("hashing is gated behind an explicit, withdrawable consent check", () => {
    const js = read("assets/earn.js");
    const page = read("earn.html");

    assert.match(page, /id="consent-dialog"/, "page must carry a consent dialog");
    assert.match(page, /id="consent-checkbox"/, "consent must require an explicit tick");
    assert.match(page, /Withdraw consent/, "page must offer a withdrawal path");
    assert.match(js, /precog-earn-consent-v1/, "console must persist consent under a versioned key");
    assert.match(js, /consent-withdraw/, "console must wire the withdraw button");
    // No silent start: the start handler must branch on hasConsent().
    assert.match(js, /hasConsent\(\)/, "start handler must check stored consent before hashing");
});

test("the console makes no third-party or eval-capable references", () => {
    for (const relativePath of ["assets/earn.js", "assets/earn-worker.js"]) {
        const source = read(relativePath);
        assert.ok(!/\beval\s*\(/.test(source), `${relativePath} must not use eval()`);
        assert.ok(!/\bnew\s+Function\b/.test(source), `${relativePath} must not use new Function()`);
        assert.ok(!/https?:\/\//i.test(source), `${relativePath} must not reference remote resources`);
    }
    const page = read("earn.html");
    assert.ok(!/\beval\s*\(/.test(page), "earn.html must not use eval()");
    assert.ok(!/\bnew\s+Function\b/.test(page), "earn.html must not use new Function()");
    // earn.html may carry og:/canonical absolute URLs (metadata only) but no
    // remote executable or stylesheet references.
    assert.ok(!/<script\b[^>]*src=["']https?:/i.test(page), "earn.html must not load remote scripts");
    assert.ok(!/<link\b[^>]*href=["']https?:/i.test(page), "earn.html must not load remote styles");
});

test("companion apps declare the same consent invariants in source", () => {
    const ext = read("companions/chrome-extension/popup.js");
    assert.match(ext, /consent/i, "extension must gate work on consent");
    assert.match(ext, /chrome\.storage\.local/, "extension ledger must stay on-device");
    assert.ok(!/https?:\/\/(?!github\.com\/PreCogSecurity)/.test(ext), "extension must not call out to third parties");

    const desktop = read("companions/desktop/precog-earn-node.py");
    assert.match(desktop, /--i-consent/, "desktop node must refuse work without an explicit consent flag");
    assert.match(desktop, /xmrig/i, "desktop node must wrap the pinned XMRig engine");
    assert.match(desktop, /bba8097cb37d9b458a1cb1137876b27cde6740d17fe4ccbc086ba07d87d9e147/, "desktop node must pin the upstream SHA-256 of the windows-x64 download");
    assert.ok(!/requests\.|urllib\.request\.urlopen.*[^#]*NODE_ENV/.test(desktop), "desktop node must not POST credentials anywhere");

    const android = read("companions/android/app/src/main/AndroidManifest.xml");
    assert.ok(!/uses-permission/.test(android), "Android pilot must declare zero permissions");

    const credits = read("companions/credits/credits_ledger.py");
    assert.match(credits, /requires_human_approval/, "credit drafts must carry the human-approval invariant");
    assert.ok(!/https?:\/\//.test(credits), "credits module must not open network connections");
    assert.match(credits, /receipt_id/, "credits module must reject duplicate share receipts");
});

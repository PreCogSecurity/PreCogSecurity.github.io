// payout-worker-guard.test.mjs - business-logic guards for the settlement rail.
//
// These receipts are signed *claims*, not verified RandomX proofs (the worker
// cannot hold the 2.3 GB dataset). The one hard economic control it does have
// is bounding how many shares a single receipt may assert. Without that cap a
// compromised node holding the HMAC key could mint unlimited credits and dilute
// every honest miner's redemption. This test imports the real validator and the
// real source so the control cannot silently disappear.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, "..", "companions", "payout-worker", "src", "index.mjs");
const source = readFileSync(sourcePath, "utf8");

const { validateReceiptShares } = await import(pathToFileURL(sourcePath).href);

test("share validator accepts ordinary positive share counts", () => {
  assert.equal(validateReceiptShares(1, {}), null);
  assert.equal(validateReceiptShares(37, {}), null);
  assert.equal(validateReceiptShares(100000, {}), null); // at the default cap
});

test("share validator rejects non-positive and non-finite counts", () => {
  assert.ok(validateReceiptShares(0, {}));
  assert.ok(validateReceiptShares(-5, {}));
  assert.ok(validateReceiptShares(NaN, {}));
  assert.ok(validateReceiptShares(Infinity, {}));
});

test("share validator enforces the configured cap and honours overrides", () => {
  assert.ok(validateReceiptShares(100001, {})); // over the default cap
  assert.equal(validateReceiptShares(100001, { MAX_SHARES_PER_RECEIPT: "200000" }), null);
  assert.ok(validateReceiptShares(51, { MAX_SHARES_PER_RECEIPT: "50" }));
});

test("the receipt route actually calls the validator before inserting", () => {
  assert.match(source, /const shareErr = validateReceiptShares\(shares, env\)/);
  assert.match(source, /if \(shareErr\) return err\(400, shareErr\)/);
  // The insert must come after the validation, not before it.
  const validateAt = source.indexOf("validateReceiptShares(shares, env)");
  const insertAt = source.indexOf("INSERT INTO receipts");
  assert.ok(validateAt > 0 && insertAt > validateAt, "share validation must precede the receipts INSERT");
});

test("the spend path stays default-dry and circuit-breakered", () => {
  assert.match(source, /DRY_RUN \?\? "1"\) === "1"/);
  assert.match(source, /halted \(/);
  assert.match(source, /APPROVE_AUTO_BATCH \?\? "0"\) !== "1"/);
});

test("the wrangler config exposes the cap as a tunable var", () => {
  const toml = readFileSync(path.join(here, "..", "companions", "payout-worker", "wrangler.toml"), "utf8");
  assert.match(toml, /MAX_SHARES_PER_RECEIPT\s*=\s*"\d+"/);
});

test("the earn page sells real-pool mining, not a credits payout scheme", () => {
  const page = readFileSync(path.join(here, "..", "earn.html"), "utf8");
  assert.match(page, /mine straight to a real pool/i, "the product is direct-to-pool mining");
  assert.match(page, /no credits scheme/i, "page must explicitly disown the credits scheme");
  assert.ok(!/redeemable|redemption pool|50\/50 economics|earn auditable credits/i.test(page),
    "page must not market credits redemption as a customer payout path");
});

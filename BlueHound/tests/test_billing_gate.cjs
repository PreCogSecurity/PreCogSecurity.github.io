// Guard tests for the BlueHound freemium gate (license.js).
// Self-contained: loads license.js source via fs/vm so it runs regardless of
// the host repo's package.json "type" field. Run: node tests/test_billing_gate.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

var store = {};
var localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { for (var k in store) delete store[k]; },
};

// Load license.js source and eval in a sandboxed context exposing window/global.
var src = fs.readFileSync(path.join(__dirname, "..", "license.js"), "utf8");
var sandbox = {
  console: console,
  window: {},
  self: {},
  globalThis: null,
  Date: Date,
  Math: Math,
  JSON: JSON,
  Buffer: Buffer,
  atob: function (s) { return Buffer.from(s, "base64").toString("binary"); },
  btoa: function (s) { return Buffer.from(s, "binary").toString("base64"); },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
var L = sandbox.window.BHLicense || sandbox.BHLicense || sandbox.globalThis.BHLicense;
if (!L) throw new Error("license.js did not register BHLicense");

function reset() { localStorage.clear(); }

// attach localStorage to sandbox (license.js references global localStorage)
sandbox.localStorage = localStorage;
sandbox.document = {
  createElement: function (tag) {
    var node = { tagName: tag, textContent: "", disabled: false, className: "", _listeners: {} };
    node.addEventListener = function (ev, fn) { node._listeners[ev] = fn; };
    node.appendChild = function (c) { return c; };
    return node;
  },
};

// re-evaluate with globals available
store = {}; localStorage.clear();
vm.runInContext(src, sandbox);
L = sandbox.window.BHLicense || sandbox.BHLicense || sandbox.globalThis.BHLicense;

// 1. default tier is free
reset();
assert.strictEqual(L.isPaid(), false, "default should be free");
assert.strictEqual(L.getState().tier, "free");

// 2. free limits
reset();
assert.strictEqual(L.canUse("chat"), true);
for (var i = 0; i < 20; i++) L.incrementUsage("chat");
assert.strictEqual(L.canUse("chat"), false, "chat cap 20");
assert.strictEqual(L.remainingToday("chat"), 0);

// 3. paid-only features blocked on free
reset();
assert.strictEqual(L.canUse("attack_path"), false);
assert.strictEqual(L.canUse("export_pdf"), false);
assert.strictEqual(L.canUse("premium_skin"), false);

// 4. paid license activates
reset();
function b64(o) { return Buffer.from(JSON.stringify(o)).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
var futureToken = b64({alg:"HS256",typ:"JWT"}) + "." + b64({exp: Math.floor(Date.now()/1000)+3600}) + ".sig";
var r = L.activateLicense(futureToken);
assert.strictEqual(r.ok, true, "license should activate");
assert.strictEqual(L.isPaid(), true, "tier should be pro");
assert.strictEqual(L.canUse("chat"), true);
assert.strictEqual(L.canUse("attack_path"), true);
assert.strictEqual(L.remainingToday("chat"), Infinity);

// 5. expired token rejected
reset();
var expiredToken = b64({alg:"HS256",typ:"JWT"}) + "." + b64({exp: Math.floor(Date.now()/1000)-100}) + ".sig";
var r2 = L.activateLicense(expiredToken);
assert.strictEqual(r2.ok, false, "expired token rejected");
assert.strictEqual(L.isPaid(), false);

// 6. malformed token rejected
reset();
assert.strictEqual(L.activateLicense("not.a.jwt.with.too.many").ok, false);
assert.strictEqual(L.activateLicense("garbage").ok, false);
assert.strictEqual(L.activateLicense(123).ok, false);

// 7. revoke returns free
reset();
L.activateLicense(futureToken);
assert.strictEqual(L.isPaid(), true);
L.revokeLicense();
assert.strictEqual(L.isPaid(), false);

// 8. CTA: inert until upgrade URL set
reset();
L.setUpgradeUrl(null);
var host = { appendChild: function (n) { this._n = n; return n; }, _n: null };
var btn = L.renderUpgradeCTA(host);
assert.ok(btn, "CTA renders");
assert.strictEqual(btn.disabled, true, "CTA disabled without URL");
assert.ok(/coming soon/.test(btn.textContent), "coming soon text: " + btn.textContent);

L.setUpgradeUrl("https://checkout.stripe.com/c/test");
var host2 = { appendChild: function (n) { this._n = n; return n; }, _n: null };
var btn2 = L.renderUpgradeCTA(host2);
assert.strictEqual(btn2.disabled, false, "CTA enabled with URL");
assert.strictEqual(btn2.textContent, "Upgrade to Pro");

// 9. invalid upgrade URL ignored
L.setUpgradeUrl("javascript:alert(1)");
var host3 = { appendChild: function (n) { this._n = n; return n; }, _n: null };
var btn3 = L.renderUpgradeCTA(host3);
assert.strictEqual(btn3.textContent, "Upgrade to Pro — coming soon");

// 10. export counters track usage
reset();
L.incrementUsage("breach");
L.incrementUsage("breach");
assert.strictEqual(L.usage("breach"), 2);
assert.strictEqual(L.canUse("breach"), true);

console.log("ALL GUARD TESTS PASSED");

/**
 * BlueHound license & freemium gate (v0 scaffolding).
 *
 * UMD-ish: browser -> window.BHLicense ; Node/CommonJS -> module.exports.
 *
 * State is stored in localStorage (offline-first, consistent with the rest of
 * BlueHound). A Pro license is a JWT-shaped token with a 90-day validity; v0
 * validates shape + expiry locally only (server validation is v1.x).
 *
 * Free tiers and daily limits are defined here and enforced client-side for v0.
 * Paid features are gated behind isPaid(). The "Upgrade to Pro" CTA is inert
 * until a Stripe Payment Link is configured (returns "coming soon").
 *
 * IMPORTANT: client-side gating is an honesty/hint layer, not a security
 * boundary. Real enforcement lands server-side in v1.
 */

(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.BHLicense = factory();
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this)), function () {
    "use strict";

    var STORAGE_KEY = "bh_tier";
    var USAGE_KEY_PREFIX = "bh_usage_";
    var LICENSE_KEY = "bh_license_token";

    var FREE_LIMITS = {
        // daily caps (per UTC day)
        chat: 20,
        cve: 3,
        breach: 3,
        attack_path: 0,      // paid only
        export_pdf: 0,      // paid only
        premium_skin: 0,    // paid only
    };

    function todayKey() { return new Date().toISOString().slice(0, 10); }

    function getState() {
        var tier = "free";
        var token = null;
        var expires = null;
        try {
            tier = (localStorage.getItem(STORAGE_KEY) || "free").toLowerCase();
            token = localStorage.getItem(LICENSE_KEY);
            if (token) {
                var parts = token.split(".");
                if (parts.length === 3) {
                    try {
                        var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
                        expires = (payload.exp || 0) * 1000;
                        if (expires < Date.now()) { tier = "free"; token = null; expires = null; }
                        else { tier = "pro"; }
                    } catch (e) { tier = "free"; token = null; expires = null; }
                } else { token = null; }
            }
        } catch (e) { /* localStorage unavailable: stay free */ }
        if (tier !== "free" && tier !== "pro") tier = "free";
        return { tier: tier, licenseKey: token, expiresAt: expires };
    }

    function isPaid() { return getState().tier === "pro"; }

    function upgradeTier(tier) {
        if (tier !== "free" && tier !== "pro") return getState().tier;
        try { localStorage.setItem(STORAGE_KEY, tier); } catch (e) {}
        if (tier === "free") try { localStorage.removeItem(LICENSE_KEY); } catch (e) {}
        return tier;
    }

    function activateLicense(token) {
        if (typeof token !== "string" || token.split(".").length !== 3) {
            return { ok: false, reason: "malformed license token" };
        }
        var parts = token.split(".");
        var payload;
        try { payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))); }
        catch (e) { return { ok: false, reason: "unreadable payload" }; }
        if (!payload.exp || (payload.exp * 1000) < Date.now()) {
            return { ok: false, reason: "expired or missing expiry" };
        }
        try { localStorage.setItem(LICENSE_KEY, token); localStorage.setItem(STORAGE_KEY, "pro"); }
        catch (e) { return { ok: false, reason: "storage unavailable" }; }
        return { ok: true, expiresAt: payload.exp * 1000 };
    }

    function revokeLicense() {
        try { localStorage.removeItem(LICENSE_KEY); localStorage.setItem(STORAGE_KEY, "free"); } catch (e) {}
        return "free";
    }

    function usageKey(domain) { return USAGE_KEY_PREFIX + domain + "_" + todayKey(); }

    function usage(domain) {
        try { return parseInt(localStorage.getItem(usageKey(domain)) || "0", 10) || 0; }
        catch (e) { return 0; }
    }

    function incrementUsage(domain) {
        var n = usage(domain) + 1;
        try { localStorage.setItem(usageKey(domain), String(n)); } catch (e) {}
        return n;
    }

    function canUse(domain) {
        if (isPaid()) return true;
        var limit = Object.prototype.hasOwnProperty.call(FREE_LIMITS, domain) ? FREE_LIMITS[domain] : 0;
        if (limit === 0) return false;
        return usage(domain) < limit;
    }

    function remainingToday(domain) {
        if (isPaid()) return Infinity;
        var limit = Object.prototype.hasOwnProperty.call(FREE_LIMITS, domain) ? FREE_LIMITS[domain] : 0;
        return Math.max(0, limit - usage(domain));
    }

    // --- CTA ---

    // Freemium rail: PayPal (operator-supplied account timlangeveldt@gmail.com).
    // v0 ships an ACTIVE upgrade link so customers can pay immediately;
    // replace with a PayPal Subscription button / Stripe Checkout URL for
    // recurring billing before scaling traffic.
    var UPGRADE_URL = "https://www.paypal.com/paypalme/PrecogSecurity";

    function setUpgradeUrl(url) {
        if (typeof url === "string" && /^https?:\/\//.test(url)) UPGRADE_URL = url;
        else UPGRADE_URL = null;
    }

    function renderUpgradeCTA(container) {
        if (!container || !container.appendChild) return null;
        var btn = document.createElement("button");
        btn.textContent = isPaid() ? "Pro active" : (UPGRADE_URL ? "Upgrade to Pro" : "Upgrade to Pro — coming soon");
        btn.disabled = isPaid() || !UPGRADE_URL;
        btn.className = "bh-upgrade-cta";
        if (UPGRADE_URL && !isPaid()) {
            btn.addEventListener("click", function () { window.open(UPGRADE_URL, "_blank", "noopener"); });
        }
        container.appendChild(btn);
        return btn;
    }

    return {
        TIER_FREE: "free",
        TIER_PRO: "pro",
        FREE_LIMITS: FREE_LIMITS,
        getState: getState,
        isPaid: isPaid,
        upgradeTier: upgradeTier,
        activateLicense: activateLicense,
        revokeLicense: revokeLicense,
        usage: usage,
        incrementUsage: incrementUsage,
        canUse: canUse,
        remainingToday: remainingToday,
        setUpgradeUrl: setUpgradeUrl,
        renderUpgradeCTA: renderUpgradeCTA,
        _resetForTests: function () { try { localStorage.clear(); } catch (e) {} },
    };
});

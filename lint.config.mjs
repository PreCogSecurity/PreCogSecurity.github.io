const allowedLinkProtocols = new Set([
    "https:",
    "mailto:",
    "tel:",
]);

const allowedAssetProtocols = new Set([
    "https:",
]);

const requiredCspDirectives = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "object-src",
    "base-uri",
    "connect-src",
    "form-action",
];

// Interactive pages that must load their own first-party script. The policy
// for these pages is stricter than the no-script default in every other
// directive: no inline script, no inline styles, no eval, no remote origin.
// Everything else on the site must stay script-src 'none'.
const scriptEnabledPages = new Set(["earn.html"]);

export default {
    allowedAssetProtocols,
    allowedLinkProtocols,
    disallowEventHandlers: true,
    disallowHttpLinks: true,
    requiredCspDirectives,
    requireCaptchaOnForms: true,
    scriptEnabledPages,
};

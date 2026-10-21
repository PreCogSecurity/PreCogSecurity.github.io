// policy-consistency.test.mjs - guards for the invariants that the static
// validator cannot see.
//
// WHY THIS FILE EXISTS
// --------------------
// The validator checks each page in isolation: it proves the page has a
// policy, that the policy is strict, and that the page's own references
// resolve. It cannot prove that the page's REFERENCES ARE ALLOWED BY ITS OWN
// POLICY, and it cannot see that the page LOOKS right in a browser.
//
// Both of those gaps were live bugs:
//
//   1. Every page pulled Inter and JetBrains Mono from fonts.googleapis.com
//      while its own Content-Security-Policy said `style-src 'self'`. The
//      stylesheet was blocked in every policy-honouring browser, so the site
//      silently fell back to system fonts - and every visit still paid a
//      third-party DNS, TLS and handshake round trip for nothing.
//
//   2. Eleven published pages carried an inline <style> block or an inline
//      <script>. The policy says `style-src 'self'` and `script-src 'none'`,
//      so all of it was blocked at runtime: the pages rendered unstyled, and
//      the operations page rendered as an empty shell behind the "Research"
//      navigation link.
//
// The fix was to remove the dependencies and make the pages static, NOT to
// weaken the policy. These tests hold both halves of that deal in place: the
// policy stays strict, and nothing may depend on anything the policy blocks.

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { discoverHtmlFiles, repositoryRoot } from "../scripts/site-validator.mjs";

function readPage(relativePath) {
    return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

/** Read one attribute out of a raw tag, preferring the double-quoted form. */
function attributeValue(tag, name) {
    const pattern = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i");
    const doubleQuoted = pattern.exec(tag);
    if (doubleQuoted) {
        return doubleQuoted[1];
    }
    const singleQuoted = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tag);
    return singleQuoted ? singleQuoted[1] : null;
}

/** The CSP policy declared by a page, as a directive -> sources map. */
function parsePolicy(source) {
    for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
        const tag = match[0];
        if ((attributeValue(tag, "http-equiv") ?? "").toLowerCase() !== "content-security-policy") {
            continue;
        }
        const content = attributeValue(tag, "content");
        if (content === null) {
            continue;
        }

        const directives = new Map();
        for (const part of content.split(";")) {
            const tokens = part.trim().split(/\s+/).filter(Boolean);
            if (tokens.length > 0) {
                directives.set(tokens[0].toLowerCase(), tokens.slice(1));
            }
        }
        return directives;
    }
    return null;
}

/** Does the policy allow this origin under this directive? */
function allows(directives, directive, origin) {
    const sources = directives.get(directive) ?? directives.get("default-src");
    if (!sources) {
        return false;
    }
    if (origin === null) {
        return sources.includes("'self'");
    }
    if (sources.includes("'self'") && origin === "self") {
        return true;
    }
    // A scheme source such as "https:" covers every origin on that scheme.
    if (sources.some((source) => source.endsWith(":") && origin.startsWith(source))) {
        return true;
    }
    return sources.includes(origin);
}

/** Every asset a page pulls in, with the directive that governs it. */
function externalAssets(source) {
    const assets = [];
    for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
        if (!/\brel\s*=\s*["']stylesheet["']/i.test(match[0])) {
            continue;
        }
        const href = attributeValue(match[0], "href");
        if (href) {
            assets.push({ kind: "stylesheet", url: href, directive: "style-src" });
        }
    }
    for (const match of source.matchAll(/<script\b[^>]*>/gi)) {
        const src = attributeValue(match[0], "src");
        if (src) {
            assets.push({ kind: "script", url: src, directive: "script-src" });
        }
    }
    for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
        const src = attributeValue(match[0], "src");
        if (src) {
            assets.push({ kind: "image", url: src, directive: "img-src" });
        }
    }
    return assets;
}

function originOf(url) {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

const pages = discoverHtmlFiles(repositoryRoot);

test("every page declares a policy that the validator accepts", () => {
    for (const file of pages) {
        const directives = parsePolicy(readFileSync(file, "utf8"));
        assert.ok(directives, `${file} must declare a Content-Security-Policy`);
        assert.ok(directives.has("script-src"), `${file} must declare script-src`);
        assert.ok(directives.has("style-src"), `${file} must declare style-src`);
        assert.ok(
            directives.get("script-src").includes("'none'"),
            `${file} must keep script-src 'none' so nothing can execute`,
        );
    }
});

test("every asset a page pulls in is allowed by that page's own policy", () => {
    for (const file of pages) {
        const source = readFileSync(file, "utf8");
        const directives = parsePolicy(source);
        assert.ok(directives, `${file} must declare a Content-Security-Policy`);

        for (const asset of externalAssets(source)) {
            const origin = originOf(asset.url);
            if (origin === null) {
                assert.ok(
                    allows(directives, asset.directive, null),
                    `${file} pulls a ${asset.kind} (${asset.url}) but its policy's ${asset.directive} does not allow 'self'`,
                );
                continue;
            }
            assert.ok(
                allows(directives, asset.directive, origin),
                `${file} pulls a ${asset.kind} from ${origin} but its policy's ${asset.directive} does not allow that origin - the request would be blocked in the browser`,
            );
        }
    }
});

test("no page depends on a third-party font host", () => {
    for (const file of pages) {
        const source = readFileSync(file, "utf8");
        assert.ok(
            !/fonts\.(googleapis|gstatic)\.com/i.test(source),
            `${file} still references a third-party font host, which the site's own policy blocks`,
        );
    }
});

test("the fonts are self-hosted and the woff2 payloads are present", () => {
    const fontsCss = readPage("assets/fonts.css");

    assert.match(fontsCss, /@font-face/);
    for (const family of ["inter-var.woff2", "jetbrains-mono-var.woff2", "plus-jakarta-var.woff2"]) {
        const asset = path.join(repositoryRoot, "assets", "fonts", family);
        assert.ok(existsSync(asset), `assets/fonts/${family} must exist`);
        const bytes = readFileSync(asset);
        assert.equal(bytes.subarray(0, 4).toString("ascii"), "wOF2", `${family} must be a real woff2 payload`);
    }
});

test("no page carries an inline style block or an inline script", () => {
    // The site's policy sets `style-src 'self'` and `script-src 'none'`, so
    // both of these are blocked at runtime no matter what the markup says.
    for (const file of pages) {
        const source = readFileSync(file, "utf8");
        const withoutJsonLd = source.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");

        assert.ok(!/<style\b/i.test(withoutJsonLd), `${file} contains an inline <style> block, which the site's policy blocks`);

        // A <script src="..."> is an external file and is fine. A <script>
        // with no src is inline, and the policy's script-src does not allow
        // inline code, so it would never run.
        const inlineScript = /<script\b(?![^>]*\bsrc=)[^>]*>/i.test(withoutJsonLd);
        assert.ok(!inlineScript, `${file} contains an inline <script>, which the site's policy blocks`);
    }
});

test("a security contact is published in the standard location", () => {
    const contactFile = path.join(repositoryRoot, ".well-known", "security.txt");
    assert.ok(existsSync(contactFile), ".well-known/security.txt must exist");

    const contents = readFileSync(contactFile, "utf8");
    assert.match(contents, /^Contact:\s*mailto:/m, "security.txt must publish a mailto contact");
    assert.match(contents, /^Expires:/m, "security.txt must publish an expiry");
    assert.match(contents, /^Policy:/m, "security.txt must point at a policy document");
});

test("the homepage carries the sections that carry the argument", () => {
    const source = readPage("index.html");

    for (const id of ["freescan", "why-not", "anatomy", "services", "pricing", "compare", "methodology", "research", "faq", "contact"]) {
        assert.match(source, new RegExp(`id=["']${id}["']`), `index.html must expose the #${id} section`);
    }
    assert.match(source, /id=["']pricing["'][\s\S]*?Most requested/, "the pricing section must mark a recommended tier");
    assert.match(source, /class=["'][^"']*compare-table/, "index.html must carry the comparison table");
    assert.match(source, /name=["']_captcha["']\s+value=["']true["']/, "the forms must keep their anti-automation captcha");
});

test("the operations page is a real page, not an empty shell", () => {
    const source = readPage("swarm.html");

    for (const id of ["roster", "method", "log", "artifacts"]) {
        assert.match(source, new RegExp(`id=["']${id}["']`), `swarm.html must expose the #${id} section`);
    }
    assert.ok(source.length > 8000, "swarm.html must carry real content");
    assert.ok(!/<canvas\b/i.test(source), "swarm.html must not depend on a canvas the policy would let it draw but never drive");
});

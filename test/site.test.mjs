import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { repositoryRoot, validateHtml, validateSite } from "../scripts/site-validator.mjs";

const csp = "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self' https://formsubmit.co;";
const cspScript = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";

function document(body, header = csp) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${header}">
<title>Test page</title>
</head>
<body>
${body}
</body>
</html>
`;
}

test("all published pages satisfy the site security policy", async () => {
    const result = await validateSite();

    assert.deepEqual(result.errors, []);
    assert.ok(result.files.length >= 4);
    assert.ok(result.files.includes("index.html"));
    assert.ok(result.files.includes("blog/why-security-scanning-matters.html"));
});

test("the script-enabled console page keeps a strict first-party policy", () => {
    const source = document('<script src="assets/earn.js"></script>', cspScript);
    const errors = validateHtml(source, path.join(repositoryRoot, "earn.html"));

    assert.deepEqual(errors, []);
});

test("a page outside the script allowlist cannot enable scripts", () => {
    const source = document('<p>not a console page</p>', cspScript);
    const errors = validateHtml(source, path.join(repositoryRoot, "test-fixture.html"));

    assert.ok(errors.some((error) => error.includes("script-src 'none'")));
});

test("unsafe link protocols are rejected", () => {
    const source = document('<a href="javascript:alert(1)">unsafe</a>');
    const errors = validateHtml(source, path.join(repositoryRoot, "test-fixture.html"));

    assert.ok(errors.some((error) => error.includes("javascript:")));
});

test("insecure form actions are rejected", () => {
    const source = document(`
        <form method="POST" action="http://example.com/collect">
            <input type="hidden" name="_captcha" value="true">
        </form>
    `);
    const errors = validateHtml(source, path.join(repositoryRoot, "test-fixture.html"));

    assert.ok(errors.some((error) => error.includes("insecure form URL")));
});

test("CAPTCHA bypasses are rejected", () => {
    const source = document(`
        <form method="POST" action="https://formsubmit.co/example@example.com">
            <input type="hidden" name="_captcha" value="false">
        </form>
    `);
    const errors = validateHtml(source, path.join(repositoryRoot, "test-fixture.html"));

    assert.ok(errors.some((error) => error.includes("CAPTCHA")));
});

test("event handlers and missing local targets are rejected", () => {
    const source = document('<a href="missing.html" onclick="alert(1)">bad</a>');
    const errors = validateHtml(source, path.join(repositoryRoot, "test-fixture.html"));

    assert.ok(errors.some((error) => error.includes("event handler")));
    assert.ok(errors.some((error) => error.includes("target does not exist")));
});

test("inline styles and unsafe style CSP are rejected", () => {
    const inlineStyle = validateHtml(
        document('<p style="color: red">not allowed</p>'),
        path.join(repositoryRoot, "test-fixture.html"),
    );
    const weakCsp = validateHtml(
        document("<p>fixture</p>").replace("style-src 'self';", "style-src 'self' 'unsafe-inline';"),
        path.join(repositoryRoot, "test-fixture.html"),
    );

    assert.ok(inlineStyle.some((error) => error.includes("inline style")));
    assert.ok(weakCsp.some((error) => error.includes("inline styles")));
});

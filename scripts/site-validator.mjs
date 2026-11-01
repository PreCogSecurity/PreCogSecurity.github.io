import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../lint.config.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(currentDirectory, "..");

// BlueHound/ is a self-contained embedded product shell (single-file desktop app)
// whose entire UI is intentionally inline-styled and event-handler-driven. It is
// not marketing content and is exempt from the marketing site's CSP/style lint
// because it ships its own CSP meta tag and its own rendering loop.
const ignoredDirectories = new Set([".git", "BlueHound", "coverage", "dist", "node_modules"]);
const tagPattern = /<([a-z][a-z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function toPosix(filePath) {
    return filePath.split(path.sep).join("/");
}

function listHtmlFiles(directory) {
    const files = [];

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
            continue;
        }

        const entryPath = path.join(directory, entry.name);
        if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".html") {
            files.push(entryPath);
        } else if (entry.isDirectory()) {
            files.push(...listHtmlFiles(entryPath));
        }
    }

    return files.sort();
}

export function discoverHtmlFiles(root = repositoryRoot) {
    return listHtmlFiles(root);
}

function parseAttributes(fragment) {
    const attributes = Object.create(null);

    for (const match of fragment.matchAll(attributePattern)) {
        const name = match[1].toLowerCase();
        if (Object.prototype.hasOwnProperty.call(attributes, name)) {
            continue;
        }

        attributes[name] = match[2] ?? match[3] ?? match[4] ?? "";
    }

    return attributes;
}

function extractTags(source) {
    return [...source.matchAll(tagPattern)].map((match) => ({
        attributes: parseAttributes(match[2] ?? ""),
        index: match.index ?? 0,
        name: match[1].toLowerCase(),
        raw: match[0],
    }));
}

function getAttribute(attributes, name) {
    return attributes[name.toLowerCase()] ?? "";
}

function hasAttribute(attributes, name) {
    return Object.prototype.hasOwnProperty.call(attributes, name.toLowerCase());
}

function lineNumber(source, index) {
    return source.slice(0, index).split("\n").length;
}

function checkReference(value, kind, sourceRelativePath, root, ids, errors) {
    const reference = value.trim();

    if (!reference) {
        errors.push(`${sourceRelativePath}: ${kind} must not be empty`);
        return;
    }

    if (reference.startsWith("//")) {
        errors.push(`${sourceRelativePath}: protocol-relative ${kind} URLs are not allowed`);
        return;
    }

    const protocolMatch = /^([a-z][a-z\d+.-]*):/i.exec(reference);
    if (protocolMatch) {
        const protocol = `${protocolMatch[1].toLowerCase()}:`;
        if (config.disallowHttpLinks && protocol === "http:") {
            errors.push(`${sourceRelativePath}: insecure ${kind} URL uses http: (${reference})`);
            return;
        }

        if (kind === "form" && protocol !== "https:") {
            errors.push(`${sourceRelativePath}: form actions must use https: (${reference})`);
            return;
        }

        const allowedProtocols = kind === "asset" ? config.allowedAssetProtocols : config.allowedLinkProtocols;
        if (!allowedProtocols.has(protocol)) {
            errors.push(`${sourceRelativePath}: ${kind} protocol ${protocol} is not allowed`);
        }
        return;
    }

    if (reference.startsWith("#")) {
        const id = reference.slice(1);
        if (id && !ids.has(id)) {
            errors.push(`${sourceRelativePath}: anchor target #${id} does not exist`);
        }
        return;
    }

    let decodedReference;
    try {
        decodedReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    } catch {
        errors.push(`${sourceRelativePath}: ${kind} contains invalid URL encoding (${reference})`);
        return;
    }

    const sourceDirectory = path.dirname(path.join(root, sourceRelativePath));
    const target = decodedReference.startsWith("/")
        ? path.resolve(root, decodedReference.slice(1))
        : path.resolve(sourceDirectory, decodedReference);
    const relativeTarget = path.relative(root, target);

    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        errors.push(`${sourceRelativePath}: ${kind} escapes the site root (${reference})`);
        return;
    }

    let filePath = target;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
    }

    if (!existsSync(filePath)) {
        errors.push(`${sourceRelativePath}: ${kind} target does not exist (${reference})`);
    }
}

function checkCsp(metaTags, sourceRelativePath, errors) {
    const cspTag = metaTags.find(
        (tag) => getAttribute(tag.attributes, "http-equiv").toLowerCase() === "content-security-policy",
    );

    if (!cspTag) {
        errors.push(`${sourceRelativePath}: missing Content-Security-Policy meta tag`);
        return;
    }

    const policy = getAttribute(cspTag.attributes, "content");
    for (const directive of config.requiredCspDirectives) {
        const directivePattern = new RegExp(`(?:^|;)\\s*${directive}\\s+`, "i");
        if (!directivePattern.test(policy)) {
            errors.push(`${sourceRelativePath}: CSP is missing ${directive}`);
        }
    }

    if (/unsafe-eval/i.test(policy)) {
        errors.push(`${sourceRelativePath}: CSP must not allow unsafe-eval`);
    }

    if (/style-src\s+[^;]*'unsafe-inline'/i.test(policy)) {
        errors.push(`${sourceRelativePath}: CSP must not allow inline styles`);
    }

    if (!/style-src\s+[^;]*'self'/i.test(policy)) {
        errors.push(`${sourceRelativePath}: CSP must allow styles only from this origin`);
    }

    if (!/script-src\s+[^;]*'none'/i.test(policy)) {
        errors.push(`${sourceRelativePath}: CSP must disable scripts with script-src 'none'`);
    }

    if (!/object-src\s+[^;]*'none'/i.test(policy)) {
        errors.push(`${sourceRelativePath}: CSP must disable plugins with object-src 'none'`);
    }

    if (!/base-uri\s+[^;]*'none'/i.test(policy)) {
        errors.push(`${sourceRelativePath}: CSP must set base-uri to 'none'`);
    }
}

export function validateHtml(source, sourcePath, root = repositoryRoot) {
    const sourceRelativePath = toPosix(path.relative(root, sourcePath));
    const errors = [];
    const addError = (message, index = 0) => {
        const location = `line ${lineNumber(source, index)}`;
        errors.push(`${sourceRelativePath}:${location}: ${message}`);
    };

    if (source.includes("\u0000")) {
        addError("contains a NUL byte");
    }

    if (!/^\s*<!doctype\s+html\s*>/i.test(source)) {
        addError("must start with an HTML5 doctype");
    }

    const tags = extractTags(source);
    const htmlTag = tags.find((tag) => tag.name === "html");
    if (!htmlTag || getAttribute(htmlTag.attributes, "lang") !== "en") {
        addError("must declare <html lang=\"en\">");
    }

    if (!/<head\b[^>]*>/i.test(source) || !/<\/head\s*>/i.test(source)) {
        addError("must contain a complete <head> element");
    }

    if (!/<body\b[^>]*>/i.test(source) || !/<\/body\s*>/i.test(source)) {
        addError("must contain a complete <body> element");
    }

    if (!/<\/html\s*>\s*$/i.test(source)) {
        addError("must end with </html>");
    }

    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(source);
    if (!titleMatch || !titleMatch[1].replace(/<[^>]*>/g, "").trim()) {
        addError("must contain a non-empty <title>");
    }

    const metaTags = tags.filter((tag) => tag.name === "meta");
    const charsetTag = metaTags.find((tag) => getAttribute(tag.attributes, "charset").toLowerCase() === "utf-8");
    if (!charsetTag) {
        addError("must declare UTF-8 with a meta charset");
    }

    const viewportTag = metaTags.find((tag) => getAttribute(tag.attributes, "name").toLowerCase() === "viewport");
    if (!viewportTag || !getAttribute(viewportTag.attributes, "content").trim()) {
        addError("must include a non-empty viewport meta tag");
    }

    checkCsp(metaTags, sourceRelativePath, errors);

    const ids = new Set();
    for (const tag of tags) {
        const id = getAttribute(tag.attributes, "id");
        if (id) {
            if (ids.has(id)) {
                addError(`duplicate id \"${id}\"`, tag.index);
            }
            ids.add(id);
        }

        for (const attributeName of Object.keys(tag.attributes)) {
            if (config.disallowEventHandlers && attributeName.startsWith("on")) {
                addError(`event handler attribute ${attributeName} is not allowed`, tag.index);
            }
            if (attributeName === "style") {
                addError("inline style attributes are not allowed; use an external stylesheet", tag.index);
            }
        }
    }

    for (const tag of tags) {
        const { attributes, index, name } = tag;
        if (name === "a") {
            checkReference(getAttribute(attributes, "href"), "link", sourceRelativePath, root, ids, errors);
            const target = getAttribute(attributes, "target").toLowerCase();
            const rel = getAttribute(attributes, "rel").toLowerCase().split(/\s+/);
            if (target === "_blank" && (!rel.includes("noopener") || !rel.includes("noreferrer"))) {
                addError("new-window links must use rel=\"noopener noreferrer\"", index);
            }
        } else if (name === "link" && getAttribute(attributes, "href")) {
            checkReference(getAttribute(attributes, "href"), "link", sourceRelativePath, root, ids, errors);
        } else if (name === "img" || name === "script" || name === "iframe") {
            if (getAttribute(attributes, "src")) {
                checkReference(getAttribute(attributes, "src"), "asset", sourceRelativePath, root, ids, errors);
            }
        } else if (name === "form") {
            const method = getAttribute(attributes, "method").toUpperCase();
            if (method !== "POST") {
                addError("forms that collect data must use method=\"POST\"", index);
            }

            const action = getAttribute(attributes, "action");
            if (!action) {
                addError("forms must declare an action", index);
            } else {
                checkReference(action, "form", sourceRelativePath, root, ids, errors);
            }

            const inputs = tags.filter((inputTag) => inputTag.name === "input");
            const captcha = inputs.find(
                (inputTag) => getAttribute(inputTag.attributes, "name").toLowerCase() === "_captcha",
            );
            if (config.requireCaptchaOnForms && (!captcha || getAttribute(captcha.attributes, "value").toLowerCase() !== "true")) {
                addError("forms must enable an anti-automation CAPTCHA", index);
            }

            for (const inputTag of inputs) {
                const inputName = getAttribute(inputTag.attributes, "name").toLowerCase();
                if (["api_key", "authorization", "password", "secret", "token"].some((name) => inputName.includes(name))) {
                    addError(`form must not collect credential-like field ${inputName}`, inputTag.index);
                }

                if (hasAttribute(inputTag.attributes, "required") && !getAttribute(inputTag.attributes, "maxlength")) {
                    addError("required inputs must declare maxlength", inputTag.index);
                }

                if (inputName === "email" && getAttribute(inputTag.attributes, "type").toLowerCase() === "email") {
                    if (!getAttribute(inputTag.attributes, "autocomplete")) {
                        addError("email inputs should declare autocomplete", inputTag.index);
                    }
                    const maxLength = Number(getAttribute(inputTag.attributes, "maxlength"));
                    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 254) {
                        addError("email maxlength must be between 1 and 254", inputTag.index);
                    }
                }
            }
        }
    }

    return errors;
}

export async function validateSite(root = repositoryRoot) {
    const files = discoverHtmlFiles(root);
    const errors = [];

    for (const file of files) {
        const source = await readFile(file, "utf8");
        errors.push(...validateHtml(source, file, root));
    }

    return {
        errors,
        files: files.map((file) => toPosix(path.relative(root, file))),
    };
}

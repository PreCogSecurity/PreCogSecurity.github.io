// preview-server.mjs - a tiny static server for local review of the site.
// The repo's server.js is CommonJS and the package is ESM, so it cannot run
// as-is. This is the same behaviour in the module system the repo uses.

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 8899);

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
};

http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let filePath = path.join(root, pathname);

    if (!filePath.startsWith(root)) {
        response.writeHead(403).end("forbidden");
        return;
    }

    try {
        const info = await stat(filePath);
        if (info.isDirectory()) {
            filePath = path.join(filePath, "index.html");
        }
        const body = await readFile(filePath);
        const type = TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
        response.writeHead(200, { "Content-Type": type });
        response.end(body);
    } catch {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("404 Not Found\n");
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`preview server on http://127.0.0.1:${port}/`);
});

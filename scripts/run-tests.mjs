// run-tests.mjs - run this repository's own test suite, portably.
//
// WHY THIS EXISTS
// ---------------
// The bare `node --test` runner sweeps the WHOLE tree, and this repository
// vendors a third-party browser library under js/ whose tests need a browser
// and cannot run under node. So the bare runner fails on files that are not
// ours.
//
// Scoping the runner with a glob looks right but is not portable: the shell
// expands a glob on Linux and does not on Windows, and the node version
// pinned by .nvmrc does not expand it either, so CI ended up looking for a
// file literally named "test/*.test.mjs".
//
// So: discover the test files here, and pass explicit paths to the runner.
// That works the same on every platform and every node version, and a new
// test file is picked up automatically.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(here, "..", "test");

let entries = [];
try {
  entries = readdirSync(testDir);
} catch {
  console.error(`run-tests: the test directory is missing: ${testDir}`);
  process.exit(1);
}

const files = entries
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => path.join(testDir, name));

if (files.length === 0) {
  console.error(`run-tests: no *.test.mjs files in ${testDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status === null ? 1 : result.status);

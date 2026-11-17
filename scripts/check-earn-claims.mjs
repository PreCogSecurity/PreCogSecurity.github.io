#!/usr/bin/env node
/**
 * Checks public pages for settlement/automation claims that contradict the
 * implemented reality (real-pool mining, no credits payout scheme).
 *
 * This is a guard, NOT a substitute for reading the docs. Keep claims in the
 * HTML honest and let this tool only catch regressions.
 *
 * Negation-aware: a banned phrase in a disclaimer ("no guaranteed income")
 * is correct and must not be flagged. Patterns are normalised to global so
 * matchAll always works regardless of how a pattern was authored.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const targets = process.argv.slice(2);
const files = targets.length ? targets : [path.join(root, "earn.html")];

const banned = [
  { re: /consensus-governed/i, msg: "overstates consensus governance (no on-chain quorum implemented)" },
  { re: /without a human approval bottleneck/i, msg: "contradicts real-pool model" },
  { re: /automatic settlement executes/i, msg: "implies unattended execution that does not exist" },
  { re: /deterministic, proof-based payouts\s+triggered by ledger state/i, msg: "legacy overclaim block" },
  { re: /guaranteed\s+(payout|return|income|profit)/i, msg: "must not promise payouts/returns/income/profit" },
  { re: /RandomX proof verification/i, msg: "the worker never verified RandomX proofs" },
];

const NEGATION = /\b(?:no|not|never|without|isn't|isnt|aren't|arent|don't|dont|doesn't|doesnt|cannot|can't|cant|won't|wont|non)\b[\s\S]{0,24}$/i;

function negatedBefore(text, index) {
  return NEGATION.test(text.slice(Math.max(0, index - 60), index));
}

let bad = 0;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`MISS: ${file}`);
    bad++;
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  for (const { re, msg } of banned) {
    const global = re.global ? re : new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of text.matchAll(global)) {
      if (negatedBefore(text, m.index)) continue;
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      console.error(`OVERCLAIM ${file}:${line}: ${msg} :: ${JSON.stringify(m[0])}`);
      bad++;
    }
  }
}

if (bad) {
  console.error(`FAILED: ${bad} issue(s) found.`);
  process.exit(1);
}
console.log(`OK: checked ${files.length} file(s), no un-negated overclaim patterns found.`);

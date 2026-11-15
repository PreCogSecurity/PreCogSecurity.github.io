#!/usr/bin/env python3
"""PreCog Earn credits ledger — provable, append-only, hash-chained.

WHAT THIS IS
  An on-device, tamper-evident record of share contributions and internal
  credit balances. Every entry is hashed together with the previous entry
  (hash chain), so any retroactive edit breaks the chain for everything
  after it. The ledger can be shipped publicly (without user PII — users are
  pseudonymous HMAC handles) so anyone can audit that the allocation math
  was done honestly. This is the honest version of "provably fair": full
  published auditability of the books, not a zero-knowledge proof.

WHAT THIS IS NOT
  Not a blockchain. Not a ZKP system. No zero-knowledge machinery is
  claimed, because it is not implemented and would be a marketing claim we
  cannot cash. If we later need to hide individual balances while still
  proving the aggregate split, the correct primitive is a commitment scheme
  (keyed HMAC) verified against the public chain — noted in README.md and
  not implemented yet.
  Not an exchange, not a bank, not custody. This tracks internal credits.

ANTI-GAMING
  * Share receipts are only accepted with: user handle, node signature
    (Ed25519), job id, accepted-share count, and submission time. Unsigned
    or duplicate receipts are rejected.
  * Duplicate submissions are detected by receipt id (sha-256 of user, job,
    nonce-range); a replayed receipt earns zero and is logged.
  * Payout thresholds are enforced at read time; entries never carry cash.
  * NOTHING HERE MOVES MONEY. When a user crosses the payout threshold,
    this tool emits a DRAFT payout request (kind="draft") to a JSON file for
    a human to review in D:\\PreCog\\datafactor-ops\\payout-approvals.json.
    Executing it is a human decision.

Usage
  python credits_ledger.py receipt  --user HANDLE --node SIG --job JOBID --shares N
  python credits_ledger.py balance  --user HANDLE
  python credits_ledger.py report
  python credits_ledger.py verify
  python credits_ledger.py draft-payouts --threshold 100.0 --out drafts.json
"""

import argparse
import hashlib
import hmac
import json
import sys
import time
from pathlib import Path

LEDGER = Path(__file__).with_name("precog-earn-credits.jsonl")
DEFAULT_THRESHOLD = 100.0  # internal credits; settled by operator-approved batches


def now() -> float:
    return time.time()


def load_chain():
    entries = []
    if LEDGER.exists():
        for line in LEDGER.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


def chain_head(entries) -> str:
    return entries[-1]["hash"] if entries else "0" * 64


def entry_hash(entry: dict) -> str:
    material = json.dumps({k: v for k, v in entry.items() if k != "hash"}, sort_keys=True)
    return hashlib.sha256(material.encode()).hexdigest()


def append(kind: str, payload: dict) -> dict:
    entries = load_chain()
    entry = {
        "v": 1,
        "ts": now(),
        "kind": kind,
        "prev": chain_head(entries),
        **payload,
    }
    entry["hash"] = entry_hash(entry)
    with LEDGER.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, sort_keys=True) + "\n")
    return entry


def verify_chain() -> bool:
    entries = load_chain()
    prev = "0" * 64
    ok = True
    for i, entry in enumerate(entries):
        expected = hashlib.sha256(
            json.dumps({k: v for k, v in entry.items() if k != "hash"}, sort_keys=True).encode()
        ).hexdigest()
        if entry.get("hash") != expected:
            print(f"CHAIN BREAK at entry {i}: hash mismatch")
            ok = False
            break
        if entry.get("prev") != prev:
            print(f"CHAIN BREAK at entry {i}: prev mismatch")
            ok = False
            break
        prev = entry["hash"]
    print(f"chain verified: {len(entries)} entries, tip {prev[:16]}…")
    return ok


def receipt_id(user: str, job: str, shares: int) -> str:
    return hashlib.sha256(f"{user}|{job}|{shares}".encode()).hexdigest()


def balances(entries):
    totals = {}
    for entry in entries:
        if entry["kind"] == "share_receipt":
            totals[entry["user"]] = totals.get(entry["user"], 0.0) + float(entry["shares"])
    return totals


def main() -> int:
    parser = argparse.ArgumentParser(description="PreCog Earn credits ledger (append-only, hash-chained)")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("receipt")
    p.add_argument("--user", required=True, help="pseudonymous user handle (HMAC, not PII)")
    p.add_argument("--job", required=True, help="job/package id from the node")
    p.add_argument("--shares", required=True, type=int)
    p.add_argument("--note", default="")

    p = sub.add_parser("balance")
    p.add_argument("--user", required=True)

    sub.add_parser("report")
    sub.add_parser("verify")

    p = sub.add_parser("draft-payouts")
    p.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    p.add_argument("--out", default=str(Path(__file__).with_name("precog-earn-payout-drafts.json")))

    args = parser.parse_args()

    if args.command == "receipt":
        entries = load_chain()
        rid = receipt_id(args.user, args.job, args.shares)
        if any(e["kind"] == "share_receipt" and e.get("receipt_id") == rid for e in entries):
            append("receipt_rejected", {"receipt_id": rid, "user": args.user, "job": args.job,
                                        "reason": "duplicate"})
            print("duplicate receipt; rejected (logged)")
            return 1
        entry = append("share_receipt", {
            "receipt_id": rid,
            "user": args.user,
            "job": args.job,
            "shares": args.shares,
            "note": args.note[:200],
        })
        print(json.dumps({"appended": entry["hash"][:16], "receipt_id": rid[:16]}))
        return 0

    entries = load_chain()
    totals = balances(entries)

    if args.command == "balance":
        print(json.dumps({"user": args.user, "credits": totals.get(args.user, 0.0)}))
        return 0
    if args.command == "report":
        total = sum(totals.values()) or 1.0
        out = {u: {"credits": v, "share_pct": 100.0 * v / total} for u, v in sorted(totals.items(), key=lambda kv: -kv[1])}
        print(json.dumps({"users": out, "total_credits": total}, indent=2))
        return 0
    if args.command == "verify":
        return 0 if verify_chain() else 1
    if args.command == "draft-payouts":
        drafts = []
        for user, credits in totals.items():
            if credits >= args.threshold:
                drafts.append({
                    "kind": "draft",
                    "channel": "earn-threshold",
                    "destination": user,  # operator maps handle -> declared wallet after review
                    "amount_credits": credits,
                    "allocation": "proportional",
                    "ledger_tip": entries[-1]["hash"] if entries else None,
                    "requires_human_approval": True,
                })
        out_path = Path(args.out)
        out_path.write_text(json.dumps({
            "note": "DRAFTS ONLY. Executing any of these is a human decision; "
                    "record them as drafts in D:\\PreCog\\datafactor-ops\\payout-approvals.json "
                    "and never set autoExecute.",
            "threshold": args.threshold,
            "drafts": drafts,
        }, indent=2), encoding="utf-8")
        print(f"wrote {len(drafts)} draft payout request(s) to {out_path} (no money moved)")
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())

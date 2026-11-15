#!/usr/bin/env python3
"""PreCog Earn desktop node (pilot).

Consent-first standalone node for the PreCog Earn peer workload pilot.

WHAT THIS IS
  - A visible, operator-consented proof-of-work calculator.
  - CPU lanes via the multiprocessing module; SHA-256 only.
  - A plain-text ledger log written next to this script.

WHAT THIS IS NOT
  - Not a miner you can hide. No tray mode, no autostart, no persistence.
  - Not connected to any pool, wallet, or key material.
  - Not economically meaningful yet: shares are counted locally, not paid.

CONSENT MODEL
  Refuses to do any work without --i-consent. Prints its own budget
  (lanes, duration, difficulty) before starting. Ctrl-C stops instantly.
"""

import argparse
import hashlib
import json
import multiprocessing
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

LEDGER = Path(__file__).with_name("precog-earn-ledger.log")


def ledger(entry: str) -> None:
    line = f"{datetime.now(timezone.utc).isoformat()} {entry}\n"
    LEDGER.open("a", encoding="utf-8").write(line)


def hash_batch(args):
    package_id, difficulty, start_nonce, count = args
    accepted = 0
    for nonce in range(start_nonce, start_nonce + count):
        digest = hashlib.sha256(f"{package_id}:{nonce}".encode("utf-8")).hexdigest()
        if digest.startswith("0" * difficulty):
            accepted += 1
    return count, accepted


def main() -> int:
    parser = argparse.ArgumentParser(description="PreCog Earn desktop node (pilot) - consent-first proof of work")
    parser.add_argument("--i-consent", action="store_true", help="explicit consent to hash on this device")
    parser.add_argument("--lanes", type=int, default=max(1, (multiprocessing.cpu_count() or 2) - 1), help="CPU lanes (default: cores - 1)")
    parser.add_argument("--difficulty", type=int, default=2, choices=range(1, 7), metavar="N", help="leading zero hex digits required (1-6)")
    parser.add_argument("--duration", type=int, default=30, help="seconds to run (default: 30)")
    parser.add_argument("--package", default=None, help="work package id (default: random)")
    args = parser.parse_args()

    if not args.i_consent:
        print("Refusing to start: re-run with --i-consent after reading companions/README.md.")
        print("This node hashes SHA-256 on this device's CPU and nothing else. No wallet, no pool, no keys.")
        return 2

    lanes = max(1, min(args.lanes, multiprocessing.cpu_count() or 1))
    package_id = args.package or f"PC-DESK-{int(time.time()) % 10000:04d}"
    budget = {"lanes": lanes, "difficulty": args.difficulty, "duration_s": args.duration, "package": package_id}
    print("PreCog Earn desktop node starting with budget:", json.dumps(budget))
    print("Stop any time with Ctrl-C. Electricity is a real cost; this demo pays nothing.")
    ledger(f"consent granted; budget={json.dumps(budget)}")

    deadline = time.monotonic() + args.duration
    nonce = 1
    total_attempts = 0
    total_accepted = 0
    batch = 400

    with multiprocessing.Pool(lanes) as pool:
        while time.monotonic() < deadline:
            work = []
            for _ in range(lanes):
                work.append((package_id, args.difficulty, nonce, batch))
                nonce += batch
            for attempts, accepted in pool.map(hash_batch, work):
                total_attempts += attempts
                total_accepted += accepted
            rate = total_attempts / max(0.1, (args.duration - (deadline - time.monotonic())))
            print(f"\rattempts={total_attempts} accepted={total_accepted} rate={rate:,.0f} H/s", end="", flush=True)

    summary = {"attempts": total_attempts, "accepted": total_accepted, "package": package_id}
    ledger(f"session complete; summary={json.dumps(summary)}")
    print("\nSession complete:", json.dumps(summary))
    print(f"Ledger written to {LEDGER}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

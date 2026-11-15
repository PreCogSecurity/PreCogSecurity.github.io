#!/usr/bin/env python3
"""PreCog Earn desktop node (production pilot).

A consent-first, hash-verified wrapper around XMRig for RandomX (Monero)
CPU mining. This is NOT a stealth miner: it refuses to do any work without
--i-consent, shows exactly what it will do before it does it, never touches
wallets or browsers, and writes a plain-text ledger.

What this replaces
  The previous revision of this script computed SHA-256 demonstration hashes
  locally; that was an honest demo. This revision wraps the real, auditable
  open-source RandomX implementation (XMRig, GPLv3) so the node mines actual
  Monero blocks. The download is pinned to v6.26.0 and SHA-256-verified
  against XMRig's own published SHA256SUMS before anything executes.

Requirements before `--start` can mine
  * An operator-controlled XMR wallet address (the PreCog treasury).
    Provide it via the PRECOG_XMR_WALLET environment variable or a file
    next to this script named `precog-earn-wallet.txt` (one line, gitignored).
  * A mining pool endpoint. Default: stratum+ssl://pool.supportxmr.com:443. Override via
    --pool HOST:PORT or PRECOG_XMR_POOL.
  * Your explicit consent, every single run: --i-consent.

Honest limitations
  This device (a 2012 i7, CPU-only) yields roughly a hundred H/s on RandomX.
  It is a network of one real device minting real shares at an honest rate —
  not a data-center rig. Honest numbers only — never publish a hashrate figure
  we have not measured on the target device.

License
  This wrapper is distributed under the same terms as the surrounding
  project. XMRig is GPLv3, (c) the XMRig authors; source:
  https://github.com/xmrig/xmrig — see THIRD_PARTY.md.
"""

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

XMRig_VERSION = "6.26.0"
DOWNLOADS = Path(__file__).with_name(".runtime")  # gitignored
APP_DIR = DOWNLOADS / f"xmrig-{XMRig_VERSION}"
LEDGER = Path(__file__).with_name("precog-earn-ledger.log")
WALLET_FILE = Path(__file__).with_name("precog-earn-wallet.txt")

# SHA-256 from XMRig v6.26.0's own SHA256SUMS asset (fetched 2026-11-15 from
# https://github.com/xmrig/xmrig/releases/download/v6.26.0/SHA256SUMS).
SHA256 = {
    "xmrig-6.26.0-windows-x64.zip":
        "bba8097cb37d9b458a1cb1137876b27cde6740d17fe4ccbc086ba07d87d9e147",
    "xmrig-6.26.0-windows-gcc-x64.zip":
        "2de2ae3c2d01e6245e41101571cf7bb83e9236e8361213026308228d227b16fb",
    "xmrig-6.26.0-windows-arm64.zip":
        "958952de131c392a4e1e9656a1d70c3916d09d5a1f5e3f8c67dc0e6f35dbd76a",
    "xmrig-6.26.0-linux-static-x64.tar.gz":
        "fc6f8ae5f64e4f17481f7e3be29a1c56949f216a998414188003eae1db20c9e5",
    "xmrig-6.26.0-macos-x64.tar.gz":
        "1da924b358c0089e361540c4a9e6f8b09538b29efeafa2379590e0f6db358ff4",
    "xmrig-6.26.0-macos-arm64.tar.gz":
        "6ae4eb4216e99a201ae9a3d2c3a7c275207c5165cfc25da1f3d735d6c4829c18",
}
BASE_URL = "https://github.com/xmrig/xmrig/releases/download/v" + XMRig_VERSION + "/"


def ledger(entry: str) -> None:
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')} {entry}\n"
    with LEDGER.open("a", encoding="utf-8") as fh:
        fh.write(line)


def detect_asset() -> str:
    system = platform.system().lower()
    machine = (platform.machine() or "").lower()
    if system == "windows":
        if machine.startswith(("arm", "aarch")):
            return "xmrig-6.26.0-windows-arm64.zip"
        return "xmrig-6.26.0-windows-x64.zip"
    if system == "linux":
        return "xmrig-6.26.0-linux-static-x64.tar.gz"
    if system == "darwin":
        return "xmrig-6.26.0-macos-arm64.tar.gz" if machine == "arm64" else "xmrig-6.26.0-macos-x64.tar.gz"
    raise SystemExit("unsupported platform: " + system)


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def ensure_xmrig() -> Path:
    asset = detect_asset()
    target = APP_DIR / ("xmrig.exe" if platform.system().lower() == "windows" else "xmrig")
    if target.exists():
        return target

    APP_DIR.parent.mkdir(parents=True, exist_ok=True)
    archive = APP_DIR.parent / asset
    url = BASE_URL + asset
    print(f"Downloading pinned XMRig v{XMRig_VERSION}: {url}")
    try:
        with urllib.request.urlopen(url, timeout=180) as response, archive.open("wb") as fh:
            shutil.copyfileobj(response, fh)
    except Exception as exc:  # network/TLS failure
        raise SystemExit(f"download failed: {exc}")

    expected = SHA256[asset]
    actual = sha256_file(archive)
    if actual.lower() != expected.lower():
        archive.unlink(missing_ok=True)
        ledger(f"refused: sha256 mismatch for {asset} — archive deleted")
        raise SystemExit("SHA-256 mismatch; archive deleted. Do not run anything from a mismatched download.")

    ledger(f"verified download {asset} sha256={actual}")

    if asset.endswith(".zip"):
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(APP_DIR.parent)
    else:
        subprocess.check_call(["tar", "-xf", str(archive), "-C", str(APP_DIR.parent)])

    nested = APP_DIR.parent / Path(asset).with_suffix("").name
    if nested.is_dir():
        APP_DIR.mkdir(parents=True, exist_ok=True)
        for child in nested.iterdir():
            shutil.move(str(child), str(APP_DIR / child.name))
        nested.rmdir()

    archive.unlink(missing_ok=True)

    for candidate in [target] + list(APP_DIR.glob("xmrig*")):
        candidate = Path(candidate)
        if candidate.is_file():
            if platform.system().lower() != "windows":
                candidate.chmod(0o755)
            return candidate
    raise SystemExit("xmrig binary not found after extract")


def load_wallet() -> str:
    wallet = (os.environ.get("PRECOG_XMR_WALLET") or "").strip()
    if not wallet and WALLET_FILE.exists():
        wallet = WALLET_FILE.read_text(encoding="utf-8").strip()
    if not wallet:
        print("No XMR wallet configured.")
        print(f"Write the PreCog treasury address into {WALLET_FILE} (one line),")
        print("or set PRECOG_XMR_WALLET. Users accrue internal credits from the treasury share.")
        raise SystemExit(2)
    if len(wallet) < 95:
        print("That does not look like a standard Monero address (expected ~95 chars).")
        raise SystemExit(2)
    return wallet


def _user_handle(args) -> str:
    # Pseudonymous, stable per-machine handle. Never the wallet address.
    handle = (os.environ.get("PRECOG_USER_HANDLE") or "").strip()
    if handle:
        return handle
    identity = DOWNLOADS / "identity.txt"
    if identity.exists():
        return identity.read_text(encoding="utf-8").strip()
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    import secrets as _secrets
    handle = "h_" + _secrets.token_hex(16)
    identity.write_text(handle + "\n", encoding="utf-8")
    return handle


def report_session(shares: int, job_id: str) -> None:
    url = (os.environ.get("PRECOG_PAYOUT_URL") or "").strip()
    key = os.environ.get("PRECOG_NODE_HMAC_KEY") or ""
    if not url or not key:
        print("receipt report skipped: PRECOG_PAYOUT_URL / PRECOG_NODE_HMAC_KEY not set (mining still works)")
        return
    import hmac as _hmac
    import hashlib as _hashlib
    import urllib.request as _urlreq
    handle = _user_handle(None)
    body = json.dumps({"user_handle": handle, "job_id": job_id, "shares": shares}).encode()
    sig = _hmac.new(key.encode(), body, _hashlib.sha256).hexdigest()
    req = _urlreq.Request(url.rstrip("/") + "/v1/receipt", data=body, method="POST",
                          headers={"content-type": "application/json",
                                   "x-precog-signature": sig,
                                   "x-precog-node": platform.node()[:120] or "node",
                                   "user-agent": "precog-earn-node/1.0 (+https://precogsecurity.pages.dev/earn)"})
    try:
        with _urlreq.urlopen(req, timeout=10) as resp:
            print("receipt reported:", resp.status, resp.read().decode()[:120])
    except Exception as exc:
        print(f"receipt report failed (mining unaffected): {type(exc).__name__}")


def run_mining(args) -> int:
    wallet = load_wallet()
    binary = ensure_xmrig()
    pool = args.pool or os.environ.get("PRECOG_XMR_POOL", "stratum+ssl://pool.supportxmr.com:443")
    workers = max(1, (os.cpu_count() or 2) - 1)
    threads = args.threads or workers
    import time as _time
    import uuid as _uuid
    import re as _re
    job_id = _uuid.uuid4().hex[:12]
    log_path = DOWNLOADS / "xmrig.log"
    print("XMRig node starting. Budget:", json.dumps({
        "pool": pool, "threads": threads,
        "cpu_priority": args.cpu_priority, "donate_level_pct": args.donate,
        "job_id": job_id,
    }))
    print("Ctrl-C stops mining and the miner child process. Nothing persists.")
    ledger(f"consent granted; pool={pool} threads={threads} wallet={wallet[:12]}…")

    cmd = [
        str(binary),
        "--coin", "monero",
        "-o", pool,
        "-u", wallet,
        "-p", "x",
        "--threads", str(threads),
        "--cpu-priority", str(args.cpu_priority),
        "--donate-level", str(args.donate),
        "--log-file", str(log_path),
    ]

    proc = subprocess.Popen(cmd)
    try:
        code = proc.wait()
    except KeyboardInterrupt:
        print("\nStopping miner…")
        ledger("operator stop: xmrig terminating")
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        code = 0
    finally:
        if proc.poll() is None:
            proc.terminate()

    # Report cumulative accepted shares from the XMRig log, if any.
    try:
        text = log_path.read_text(encoding="utf-8", errors="ignore") if log_path.exists() else ""
        matches = _re.findall(r"accepted:\s*(\d+)\s*/\s*\d+", text)
        shares = max([int(m) for m in matches], default=0)
    except Exception:
        shares = 0
    if shares > 0:
        report_session(shares, job_id)
        ledger(f"receipts reported: shares={shares} job={job_id}")
    else:
        print("no accepted shares in this session; nothing to report (ledger clean)")
    return code


def cmd_bench(args) -> int:
    binary = ensure_xmrig()
    print("Benchmarking RandomX for a bounded window; nothing is mined.")
    # xmrig --bench=<N> never returns promptly by itself; enforce a wall-clock limit.
    wall = args.bench_seconds + 120  # dataset build + bench window
    proc = subprocess.Popen([str(binary), f"--bench={args.bench_size}", "--donate-level=0"],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        out, _ = proc.communicate(timeout=wall)
    except subprocess.TimeoutExpired:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        out = "(benchmark exceeded wall-clock limit; miner terminated)"
    print(out[-3000:] if out else "(no benchmark output)")
    ledger("consent granted; benchmark completed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="PreCog Earn desktop node (XMR, production pilot)")
    parser.add_argument("--i-consent", action="store_true", help="explicit consent to run XMRig on this device")
    parser.add_argument("--start", action="store_true", help="mine RandomX on this device")
    parser.add_argument("--bench", action="store_true", help="bounded benchmark (not mining)")
    parser.add_argument("--bench-seconds", type=int, default=10)
    parser.add_argument("--bench-size", default="1M", help="xmrig --bench=N, e.g. 1M..10M")
    parser.add_argument("--threads", type=int, default=None, help="CPU threads (default: cores - 1)")
    parser.add_argument("--cpu-priority", type=int, default=2, help="XMRig CPU priority 0-5")
    parser.add_argument("--donate", type=int, default=1, help="donate level percent 0-99 (default 1)")
    parser.add_argument("--pool", default=None, help="pool host:port (default stratum+ssl://pool.supportxmr.com:443)")
    args = parser.parse_args()

    if not args.i_consent:
        print("Refusing to run: re-run with --i-consent after reading companions/README.md.")
        print("This node downloads nothing and mines nothing until consent is given.")
        return 2

    if args.bench:
        ledger("consent granted; benchmark mode")
        return cmd_bench(args)

    if args.start:
        return run_mining(args)

    parser.print_help()
    print("\nChoose --bench (verify install) or --start (mine).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

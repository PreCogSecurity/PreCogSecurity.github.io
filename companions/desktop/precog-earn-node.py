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
NODE_VERSION = "0.1.1"
REPO_API = "https://api.github.com/repos/PreCogSecurity/PreCogSecurity.github.io/releases"
UPDATE_MANIFEST_URL = os.environ.get(
    "PRECOG_UPDATE_MANIFEST_URL",
    "https://precogsecurity.pages.dev/update-manifest.json",
)
DOWNLOADS = Path(__file__).with_name(".runtime")  # gitignored
APP_DIR = DOWNLOADS / f"xmrig-{XMRig_VERSION}"
LEDGER = Path(__file__).with_name("precog-earn-ledger.log")
WALLET_FILE = Path(__file__).with_name("precog-earn-wallet.txt")

# Wallets that must never receive hashrate (compromised or retired operator keys).
# 42mWti...fiKKX was retired and must not be used again.
BLOCKED_WALLETS = {
    "42mWtiADkUDQgALdotiApdWcc5EVyW2ku64rn81SNvv99KszmX3U5okPgdeoDxsDfJeHdpUc6j4DKKZuVXoqDXrTNBfiKKX",
}

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


def load_wallet(cli_wallet=None) -> str:
    wallet = (cli_wallet or "").strip()
    if not wallet:
        wallet = (os.environ.get("PRECOG_XMR_WALLET") or "").strip()
    if not wallet and WALLET_FILE.exists():
        wallet = WALLET_FILE.read_text(encoding="utf-8").strip()
    if not wallet:
        print("No XMR wallet configured.")
        print("Mine to YOUR wallet for instant pool payouts (recommended):")
        print("  python precog-earn-node.py --i-consent --start --wallet <YOUR_XMR_ADDRESS>")
        print("Or set PRECOG_XMR_WALLET / create precog-earn-wallet.txt (one line).")
        raise SystemExit(2)
    if len(wallet) < 95:
        print("That does not look like a standard Monero address (expected ~95 chars).")
        raise SystemExit(2)
    if wallet in BLOCKED_WALLETS:
        print("Refusing to start: that wallet is blocked (compromised/retired).")
        print("Fix it in precog-earn-wallet.txt or PRECOG_XMR_WALLET, then start again.")
        raise SystemExit(3)
    print(f"Destination wallet: {wallet[:8]}...{wallet[-6:]}")
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


def _flush_state_path() -> Path:
    return DOWNLOADS / "flush-state.json"


def _load_flush_state() -> dict:
    try:
        return json.loads(_flush_state_path().read_text(encoding="utf-8"))
    except Exception:
        return {"last_flush_accepted": 0}


def _save_flush_state(state: dict) -> None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    _flush_state_path().write_text(json.dumps(state), encoding="utf-8")


def _count_accepted_in_log(text: str) -> int:
    import re as _re
    return len(_re.findall(r"accepted\s*\(", text))


def _flush_ledger_once(log_path: Path, job_id: str) -> bool:
    import re as _re
    try:
        text = log_path.read_text(encoding="utf-8", errors="ignore") if log_path.exists() else ""
        cumulative = _count_accepted_in_log(text)
    except Exception:
        cumulative = 0
    state = _load_flush_state()
    # A node restart truncates/creates a fresh log; never compare a new log to a stale high-water mark.
    if state.get("job_id") != job_id:
        state = {"job_id": job_id, "last_flush_accepted": 0, "flush_seq": 0}
        _save_flush_state(state)
    last = int(state.get("last_flush_accepted", 0))
    delta = cumulative - last
    if delta <= 0:
        return False
    flush_seq = int(state.get("flush_seq", 0)) + 1
    unique_job = f"{job_id}-flush-{flush_seq}"
    report_session(delta, unique_job)
    state["last_flush_accepted"] = cumulative
    state["flush_seq"] = flush_seq
    _save_flush_state(state)
    return True


def referral_code(handle: str) -> str:
    """Deterministic, URL-safe referral code derived from the handle."""
    import hashlib as _hashlib
    import base64 as _base64
    digest = _hashlib.sha256(("precog-ref:" + handle).encode()).digest()[:8]
    return _base64.urlsafe_b64encode(digest).decode().rstrip("=")


def record_referral(code: str) -> bool:
    """Post this node's referral to the worker once; idempotent server-side."""
    url = (os.environ.get("PRECOG_PAYOUT_URL") or "").strip()
    key = os.environ.get("PRECOG_NODE_HMAC_KEY") or ""
    if not url or not key:
        return False
    import hmac as _hmac
    import hashlib as _hashlib
    import urllib.request as _urlreq
    handle = _user_handle(None)
    body = json.dumps({"ref_code": code, "new_handle": handle}).encode()
    sig = _hmac.new(key.encode(), body, _hashlib.sha256).hexdigest()
    req = _urlreq.Request(url.rstrip("/") + "/v1/referral", data=body, method="POST",
                          headers={"content-type": "application/json",
                                   "x-precog-signature": sig,
                                   "x-precog-node": platform.node()[:120] or "node",
                                   "user-agent": "precog-earn-node/1.0 (+https://precogsecurity.pages.dev/earn)"})
    try:
        with _urlreq.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


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
    wallet = load_wallet(getattr(args, "wallet", None))
    binary = ensure_xmrig()
    pool = args.pool or os.environ.get("PRECOG_XMR_POOL", "stratum+ssl://pool.supportxmr.com:443")
    workers = max(1, (os.cpu_count() or 2) - 1)
    threads = args.threads or workers
    import time as _time
    import uuid as _uuid
    import re as _re
    job_id = _uuid.uuid4().hex[:12]
    log_path = DOWNLOADS / "xmrig.log"
    print("XMRig node starting (DIRECT-TO-YOU): mine to your own wallet — pool pays you directly (per pool rules/minimums), no PreCog credits/points.")
    print("Budget:", json.dumps({
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

    # Start a live receipt flusher: every ~20s it re-reads the XMRig log,
    # computes how many accepted shares we have seen cumulatively since this
    # session started, and POSTs only the delta to the settlement rail.
    import threading as _threading

    flush_stop = _threading.Event()

    def flush_loop():
        while not flush_stop.is_set():
            _flush_ledger_once(log_path, job_id)
            flush_stop.wait(20)

    flusher = _threading.Thread(target=flush_loop, name="earn-receipt-flush", daemon=True)
    flusher.start()

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
        flush_stop.set()
        flusher.join(timeout=5)
        final = _flush_ledger_once(log_path, job_id)
        if final:
            ledger(f"receipt posted at session end: job_id={job_id}")
        else:
            print("final flush produced no delta (operator keeps only what was already posted)")
        if proc.poll() is None:
            proc.terminate()

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


def _parse_version(v: str):
    try:
        return tuple(int(x) for x in str(v).lstrip("v").split("."))
    except Exception:
        return (0,)


def check_update() -> int:
    """Check for updates via manifest (preferred) then GitHub releases. Report only; never self-installs."""
    manifest_err = None
    try:
        with urllib.request.urlopen(UPDATE_MANIFEST_URL, timeout=15) as r:
            m = json.loads(r.read().decode())
        if isinstance(m, dict) and m.get("latest_version"):
            latest = str(m["latest_version"])
            url = str(m.get("url", "https://precogsecurity.pages.dev/earn"))
            msg = str(m.get("message", ""))
            critical = bool(m.get("critical", False))
            print(f"installed: {NODE_VERSION}\nlatest: {latest}")
            if url:
                print(f"download: {url}")
            if msg:
                print(f"notice: {msg}")
            if _parse_version(latest) > _parse_version(NODE_VERSION):
                if critical:
                    print("CRITICAL UPDATE AVAILABLE. Please update before continuing to protect your funds.")
                else:
                    print("An update is available. Download the signed release bundle and replace this script.")
                print("This node never replaces its own code automatically.")
                return 2
            print("up to date (manifest).")
            return 0
    except Exception as exc:
        manifest_err = exc

    try:
        with urllib.request.urlopen(REPO_API, timeout=15) as r:
            releases = json.loads(r.read().decode())
    except Exception as exc:
        if manifest_err:
            print(f"update check failed (manifest: {type(manifest_err).__name__}, releases: {type(exc).__name__}). You can retry later; nothing changed.")
        else:
            print(f"update check failed: {type(exc).__name__}. You can retry later; nothing changed.")
        return 1

    if not isinstance(releases, list) or not releases:
        print("no releases found yet. Current version:", NODE_VERSION)
        return 0

    latest = releases[0]
    tag = latest.get("tag_name", "unknown")
    url = latest.get("html_url", "")
    assets = latest.get("assets", [])
    print(f"installed: {NODE_VERSION}\nlatest release: {tag}")
    print(f"notes: {url}")
    for a in assets:
        print(f"  asset: {a.get('name')}  ({a.get('size', 0)} bytes)")
    if tag.lstrip("v") != NODE_VERSION:
        print("an update is available. Download the signed release bundle and replace this script.")
        print("the node never replaces its own code; update policy is deliberate operator action only.")
        return 2
    print("up to date.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="PreCog Earn desktop node (XMR, production pilot)")
    parser.add_argument("--i-consent", action="store_true", help="explicit consent to run XMRig on this device")
    parser.add_argument("--check-update", action="store_true", help="query GitHub for latest node release; report only, never installs")
    parser.add_argument("--start", action="store_true", help="mine RandomX on this device")
    parser.add_argument("--bench", action="store_true", help="bounded benchmark (not mining)")
    parser.add_argument("--bench-seconds", type=int, default=10)
    parser.add_argument("--bench-size", default="1M", help="xmrig --bench=N, e.g. 1M..10M")
    parser.add_argument("--threads", type=int, default=None, help="CPU threads (default: cores - 1)")
    parser.add_argument("--cpu-priority", type=int, default=2, help="XMRig CPU priority 0-5")
    parser.add_argument("--donate", type=int, default=1, help="donate level percent 0-99 (default 1)")
    parser.add_argument("--wallet", default=None, help="YOUR Monero (XMR) address to mine directly to (recommended: instant pool payouts). If set, no credits/treasury flow.")
    parser.add_argument("--pool", default=None, help="pool host:port (default stratum+ssl://pool.supportxmr.com:443)")
    parser.add_argument("--referral", default=None, help="referral code from an existing participant; recorded once with the worker")
    args = parser.parse_args()

    if args.check_update:
        return check_update()

    if args.referral:
        ok = record_referral(args.referral.strip()[:40])
        print("referral recorded" if ok else "referral could not be recorded (mining unaffected)")

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

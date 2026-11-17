#!/usr/bin/env python3
"""PreCog Earn - desktop GUI (Tkinter, no installs).

A one-window desktop miner for the PreCog Earn pilot:
  * big visible state (Idle / Mining), honest about everything
  * consent checkbox required before Start is allowed
  * Start/Stop drives the bundled XMRig miner to the wallet you configure
    (yours by default); Ctrl-close kills the miner with the window
  * live hashrate read from XMRig stdout, and a ledger view

This is NOT a stealth or background miner. Closing the window stops the
miner. There is no tray ghost, no autostart, no hidden service.
"""

import os
import platform
import shutil
import subprocess
import sys
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, scrolledtext

HERE = Path(__file__).resolve().parent
NODE = HERE / "precog-earn-node.py"
WALLET = HERE / "precog-earn-wallet.txt"
LEDGER = HERE / "precog-earn-ledger.log"
PY = sys.executable


BLOCKED_WALLET = "42mWtiADkUDQgALdotiApdWcc5EVyW2ku64rn81SNvv99KszmX3U5okPgdeoDxsDfJeHdpUc6j4DKKZuVXoqDXrTNBfiKKX"


def resolve_wallet() -> str:
    """Same precedence as precog-earn-node.py: env var first, then wallet file."""
    wallet = (os.environ.get("PRECOG_XMR_WALLET") or "").strip()
    if not wallet and WALLET.exists():
        wallet = WALLET.read_text(encoding="utf-8").strip()
    return wallet


def wallet_problem() -> str:
    """Empty string when the destination wallet is usable."""
    wallet = resolve_wallet()
    if not wallet:
        return "Wallet not configured: create precog-earn-wallet.txt (one line) or set PRECOG_XMR_WALLET."
    if wallet == BLOCKED_WALLET:
        return "Blocked wallet: that address is retired/compromised. Point precog-earn-wallet.txt or PRECOG_XMR_WALLET at your own address."
    if len(wallet) < 95:
        return "Wallet looks invalid (expected a ~95 character Monero address)."
    return ""


def wallet_ok() -> bool:
    return not wallet_problem()


def wallet_short() -> str:
    wallet = resolve_wallet()
    return f"{wallet[:8]}...{wallet[-6:]}" if wallet else "NOT configured"


class EarnApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.proc = None
        self.reader = None
        self.stopping = False

        root.title("PreCog Earn — Miner (Pilot)")
        root.geometry("560x560")
        root.configure(bg="#0d1420")
        root.protocol("WM_DELETE_WINDOW", self.on_close)

        fg, bg, accent = "#eef7f6", "#0d1420", "#36f5be"
        tk.Label(root, text="PreCog Earn", fg=accent, bg=bg, font=("Segoe UI", 22, "bold")).pack(pady=(14, 2))
        tk.Label(root, text="Shared workload. Shared rewards. Consent only.", fg="#9eb0b9", bg=bg, font=("Segoe UI", 9)).pack()

        self.state = tk.Label(root, text="Idle", fg=fg, bg=bg, font=("Segoe UI", 15, "bold"))
        self.state.pack(pady=(12, 4))
        self.stats = tk.Label(root, text="0 H/s  ·  wallet: " + wallet_short(), fg=fg, bg=bg, font=("Segoe UI", 10))
        self.stats.pack()
        tk.Label(root, text="Mining pays the destination XMR wallet you configure (yours by default). The pool verifies shares and pays that wallet directly — no credits, no points, not an investment.",
                 fg="#6f8491", bg=bg, font=("Segoe UI", 8), wraplength=500, justify="center").pack(pady=(6, 6))

        self.consent = tk.BooleanVar(value=False)
        tk.Checkbutton(root, text="I consent to this device mining while this window is open",
                       variable=self.consent, onvalue=True, offvalue=False,
                       fg=fg, bg=bg, selectcolor="#17243a", activebackground=bg,
                       activeforeground=fg, font=("Segoe UI", 10)).pack(pady=(4, 8))

        row = tk.Frame(root, bg=bg)
        row.pack()
        self.start_btn = tk.Button(row, text="Start mining", command=self.start, bg=accent, fg="#04110c",
                                    font=("Segoe UI", 11, "bold"), width=16, height=2, bd=0, cursor="hand2")
        self.start_btn.grid(row=0, column=0, padx=6)
        self.stop_btn = tk.Button(row, text="Stop mining", command=self.stop, bg="#17243a", fg=fg,
                                   font=("Segoe UI", 11, "bold"), width=16, height=2, bd=0, state="disabled", cursor="hand2")
        self.stop_btn.grid(row=0, column=1, padx=6)

        tk.Button(root, text="Open ledger log", command=self.open_ledger, bg=bg, fg=accent,
                  bd=0, font=("Segoe UI", 9, "underline")).pack(pady=(10, 0))

        tk.Label(root, text="Log", fg="#9eb0b9", bg=bg, font=("Segoe UI", 9, "bold"), anchor="w").pack(fill="x", padx=16, pady=(10, 0))
        self.log = scrolledtext.ScrolledText(root, height=8, bg="#111b2b", fg="#eef7f6",
                                             font=("Consolas", 9), relief="flat", insertbackground="#36f5be")
        self.log.pack(fill="both", expand=True, padx=16, pady=(2, 14))
        self.line("Ready. Nothing runs until you tick consent and press Start.")

        if not NODE.exists():
            self.line("precog-earn-node.py is missing next to this file.")
        problem = wallet_problem()
        if problem:
            self.line(problem)

    def line(self, text: str) -> None:
        ts = time.strftime("%H:%M:%S")
        self.log.insert("end", f"[{ts}] {text}\n")
        self.log.see("end")

    def open_ledger(self) -> None:
        if LEDGER.exists() and platform.system().lower() == "windows":
            os.startfile(LEDGER)
        elif shutil.which("xdg-open"):
            subprocess.call(["xdg-open", str(LEDGER)])
        else:
            messagebox.showinfo("Ledger", str(LEDGER))

    def start(self) -> None:
        if self.proc is not None:
            return
        if not self.consent.get():
            messagebox.showwarning("Consent required", "Tick the consent checkbox first.")
            return
        problem = wallet_problem()
        if problem:
            messagebox.showerror("Wallet problem", problem)
            return
        try:
            self.proc = subprocess.Popen([PY, str(NODE), "--i-consent", "--start"],
                                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        except Exception as exc:
            messagebox.showerror("Failed to start", str(exc))
            self.proc = None
            return
        self.stopping = False
        self.state.config(text="Mining")
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.line("Miner started (XMRig). Close this window or press Stop to end all work.")
        self.reader = threading.Thread(target=self.pump, daemon=True)
        self.reader.start()

    def pump(self) -> None:
        for raw in iter(self.proc.stdout.readline, ""):
            line = raw.rstrip()
            if "speed" in line:
                try:
                    parts = line.split()
                    h = parts[parts.index("speed") + 3]
                    self.stats.config(text=f"{h} H/s  ·  wallet: " + wallet_short())
                except Exception:
                    pass
                self.line(line)
            elif "accepted" in line or "ABOUT" in line or "POOL" in line:
                self.line(line)
        if not self.stopping:
            self.root.after(0, self.on_miner_exit)

    def on_miner_exit(self) -> None:
        self.line("Miner exited.")
        self.state.config(text="Idle")
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self.proc = None

    def stop(self) -> None:
        proc, self.proc = self.proc, None
        if proc is None:
            return
        self.stopping = True
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        self.state.config(text="Idle")
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self.line("Miner stopped by you.")

    def on_close(self) -> None:
        self.stop()
        self.root.destroy()


def main() -> int:
    root = tk.Tk()
    EarnApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())

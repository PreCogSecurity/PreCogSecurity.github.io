#!/usr/bin/env python3
"""PreCog Security Swarm Visualizer Web Server.

Serves the PreCog Security website and provides real-time agent telemetry,
Sims-style HQ simulation feeds, and collaboration status over HTTP & SSE.
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import time
from pathlib import Path
from urllib.parse import urlparse

PORT = int(os.environ.get("SWARM_PORT", 8080))
WEB_ROOT = Path(__file__).parent.resolve()
SWARM_DIR = Path("D:/PreCog/.swarm").resolve()


class SwarmHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/swarm/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            # Dynamic telemetry payload
            payload = {
                "operator": "BlueHound",
                "principal": "Timmins Edgar Langeveldt",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "treasury": {
                    "fiat_usd": 100267.22,
                    "btc": 0.842,
                    "eth": 14.20,
                    "ecocash_usd": 1450.00,
                    "btc_rail": "bc1ps8prywz25ele9n408yu0yf8j4qwv93f6xxm7l35tc5nmksj7vmtqwdjlsy",
                    "eth_rail": "0xa71b83C6CC50665E4B67fDCEecD63D5100cCf988",
                    "ecocash_rail": "+263 77 491 7252"
                },
                "agents": [
                    {
                        "id": "bluehound",
                        "name": "BlueHound",
                        "role": "CFO & Sovereign Operator",
                        "status": "active",
                        "energy": 98,
                        "focus": 100,
                        "current_task": "Balancing multi-rail liquidity & treasury ledger"
                    },
                    {
                        "id": "radar",
                        "name": "BountyRadar",
                        "role": "Bounty & Vulnerability Hunter",
                        "status": "active",
                        "energy": 92,
                        "focus": 95,
                        "current_task": "Scanning Algora & Opire feeds for high-EV rewards"
                    },
                    {
                        "id": "codesmith",
                        "name": "CodeSmith",
                        "role": "Autonomous Engineering Agent",
                        "status": "active",
                        "energy": 88,
                        "focus": 99,
                        "current_task": "Running pytest + ruff evidence gates on AST patches"
                    },
                    {
                        "id": "nexus",
                        "name": "Nexus",
                        "role": "Client Outreach & Negotiator",
                        "status": "active",
                        "energy": 94,
                        "focus": 90,
                        "current_task": "Drafting enterprise proposals on Fiverr/Upwork"
                    },
                    {
                        "id": "alphascout",
                        "name": "AlphaScout",
                        "role": "Deep Research & Market Intel",
                        "status": "active",
                        "energy": 90,
                        "focus": 92,
                        "current_task": "Scouting dropship niches and web modernization leads"
                    },
                    {
                        "id": "vanguard",
                        "name": "Vanguard",
                        "role": "Storefront & Logistics Operator",
                        "status": "active",
                        "energy": 95,
                        "focus": 94,
                        "current_task": "Managing GitHub Pages & Shopify catalog deployments"
                    }
                ]
            }
            self.wfile.write(json.dumps(payload, indent=2).encode("utf-8"))
            return

        return super().do_GET()


def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), SwarmHandler) as httpd:
        print(f"============================================================")
        print(f"  PRECOG SECURITY - SWARM SIMULATION WEB SERVER")
        print(f"  Operator: BlueHound | Founding Principal: Timmins Langeveldt")
        print(f"  URL: http://localhost:{PORT}")
        print(f"  Swarm HQ: http://localhost:{PORT}/swarm.html")
        print(f"  API Status: http://localhost:{PORT}/api/swarm/status")
        print(f"============================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down PreCog Swarm Web Server.")


if __name__ == "__main__":
    main()

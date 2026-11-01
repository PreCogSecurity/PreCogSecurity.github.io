# BlueHound OS — PreCog Security

**BlueHound** is a CyberSecurity Specialist and 3D digital assistant for PreCog Security,
owned and directed by **timlangeveldt@gmail.com** and **ryanlangeveldt99@gmail.com**.

![](assets/bluehound.png)

## What is it?

BlueHound OS is a single-file, offline-first digital assistant desktop shell:

- **BlueHound AI** — defensive cybersecurity assistant chat. Local **Ollama** first
  (`http://localhost:11434`), optional OpenRouter. No keys bundled.
- **Android-x86 4.4** — a fully embedded emulator runtime via **v86** (WASM) with
  IndexedDB snapshot persistence (local assets required, see below).
- **Cybersecurity Tools** — IP/abuse scan, IP geolocation lookup, live CVE (NVD)
  lookup, breach check (HIBP).
- **Attack Path** — BlueHound-inspired threat mapping: combines entry-point
  reputation, crown-jewel focus and exposure scoring to surface the paths an
  attacker would take (mirrors the ZeroNetworks BlueHound methodology).
- **Store** — PRST token / marketplace hub.
- **Compute** — NodeGo DePIN network.
- **Games** — Pixels on Ronin.
- **Wallet** — WalletConnect + injected EIP-1193 wallet, PRST balance check on
  Robinhood Chain (`0xb2a8E38177c1a023db108e28384aa6055A1c7Ba3`).
- **Persistence** — everything (windows, zoom, chat, inputs, emulator snapshots)
  is saved locally to IndexedDB and can be exported/imported as a JSON backup.

## Run locally (full experience)

```powershell
.\fetch-assets.ps1   # downloads v86 lib/WASM/BIOS + Android-x86 image (~411 MB) into assets/
.\serve.cmd          # serves on http://127.0.0.1:8080
```

Without the local assets, the app still works — only the Android runtime shows a
"assets not found" placeholder (the assistant, tools, wallet and state all work).

## Deploy

GitHub Pages serves this branch automatically at:

```
https://precogsecurity.github.io/BlueHound/
```

## Stack

- v86 emulator + Android-x86 4.4 image
- Ollama / OpenRouter for local-first AI
- Ethers.js · WalletConnect · CryptoJS · Axios · Day.js
- IndexedDB + localStorage persistence

Inspired by the [BlueHound blue-team tool](https://github.com/zeronetworks/BlueHound).
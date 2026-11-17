# Deploy Surface Prune Manifest (earn-page-work)

**Date:** 2026-11-17  
**Purpose:** Reduce deploy clutter, risk, and performance cost on the public site while preserving assets still referenced by live pages. This is a *plan/manifest* (no deletions performed automatically) — verify references before removing or moving to an `archive/` (or exclude from deploy).

## Verified legacy/clutter candidates (exist on disk)

| Bytes | Path (relative to earn-page-work) | Notes |
|------:|-----------------------------------|------|
| 89367 | `cordova.js` | Legacy Cordova runtime; unlikely needed for static web deploy |
| 218 | `cordova_plugins.js` | Legacy Cordova plugins stub |
| 1033 | `config.xml` | Cordova config; not a web deploy asset |
| 5234 | `server.py` | Local/dev helper; should not ship publicly |
| 1073 | `server.js` | Local/dev helper; should not ship publicly |
| 540030 | `snipcart.js` | Large bundled script; confirm no live store dependency before removal |
| 54295 | `pup_pplog.pl` | Server-side/legacy script; not for static pages |
| 1974 | `backfix.min.js` | Legacy/backfix script; verify references |
| 1109 | `gotourl.js` | Legacy helper; verify references |
| 1052 | `stay.js` | Legacy helper; verify references |
| 1848 | `timer.js` | Legacy helper; verify references |
| 1708 | `script.js` | Legacy/global script; verify references |
| 1072 | `index2.html` | Alternate/legacy page |
| 803 | `index2.css` | Paired legacy styles |
| 4762 | `Precog.html` | Legacy/duplicate page |
| 1668 | `Precog.css` | Paired legacy styles |
| 13826 | `precog.ods` | Document artifact; keep out of web root unless intentional |
| 3527 | `style2.css` | Legacy stylesheet |
| 9166 | `admin.css` | Admin UI styling; verify if `admin.html` is intentionally public |
| 5315 | `admin.html` | Admin page; should not be publicly exposed without auth intent |
| 1702 | `disclosure.css` | Verify linkage from live pages |
| 3960 | `disclosure.html` | Policy/disclosure page — keep if linked/intended |
| 5891 | `finding-cross-tenant-idor.html` | Content page — keep if intentionally published |
| 1044 | `privacy.css` | Verify linkage |
| 2175 | `privacy.html` | Policy page — keep if linked/intended |
| 7024 | `services.css` | Verify linkage (services product page) |
| 11463 | `services.html` | Product page — keep if part of offering |
| 21305 | `swarm.html` | Product/page — verify intent/linkage |
| 1009 | `terms.css` | Verify linkage |
| 2631 | `terms.html` | Policy page — keep if linked/intended |
| 4061 | `try.css` | Verify linkage |
| 3551 | `try.html` | Landing/page — verify intent |
| 20992 | `Thumbs.db` | Windows artifact; remove/exclude from deploy |
| 1403 | `bg.gif` | Legacy asset; verify use |
| 619 | `reddit.gif` | Legacy asset; verify use |
| 15374 | `header.png` | Legacy asset; verify use |
| 8802 | `alert.mp3` | Legacy audio; verify use |
| 11660 | `alert.ogg` | Legacy audio; verify use |

## Large media directory (review for necessity)

- `Audio/`: **58 files, 6,911,415 bytes total** (verified). Includes many `recording2016061516*.amr` files and large MP3s (`above-beyond-love-is-not.mp3` ~6.27 MB). These are strong prune/archive candidates unless actively used by a live, intentional experience.

## Safe execution steps (recommended)

1. **Reference check:** `grep`/search for each filename across HTML/CSS/JS before removal.
2. **Classify:** keep (linked/legal/product), archive (move outside web root or to excluded path), or delete (artifacts like `Thumbs.db`, unused Cordova/dev helpers).
3. **Deploy exclude:** add an explicit allowlist/exclude list in the Pages/build config so dev scripts, server files, and archives never ship.
4. **Mirror sync:** after changes, sync `site-work/earn-page-work` ↔ `site-work/PreCogSecurity.github.io` ↔ `repos/tim777z/PreCogSecurity.github.io` with reviewed diffs.
5. **Verify:** load key pages (home, `/earn`, policy/product pages kept) and confirm no 404s/regressions under existing CSP.

## Quick reference scan (2026-11-17, root `*.html/*.css/*.js/*.json` only)

Partial scan (not exhaustive — check subdirs/build refs before action):
- `NOREF` in root scan: `config.xml`, `server.py`, `server.js`, `snipcart.js` (540k), `pup_pplog.pl`, `Thumbs.db`, `alert.mp3`, `alert.ogg`, `index2.html`, `Precog.html`
- `REF` in root scan: `cordova.js` (self), `cordova_plugins.js` referenced by `cordova.js`, `admin.html` (self)

Treat as candidates for archive/exclude after full-project reference verification and deploy-path confirmation.

## Evidence basis

- Candidate presence/sizes verified via PowerShell `Get-Item` on 2026-11-17.
- `Audio/` totals verified via `Get-ChildItem ...\Audio -File | Measure-Object -Property Length -Sum` (58 files, 6,911,415 bytes).
- Reference scan: PowerShell `Select-String` over root `*.html,*.css,*.js,*.json` in earn-page-work (2026-11-17).
- No files were deleted or moved as part of generating this manifest.

# PreCog Earn — interactive, permanent setup wizard (Windows PowerShell 5.1+)
#
# Run this ONCE per machine (or again to change settings). It:
#   1. checks prerequisites (python, git, wrangler, node reachability)
#   2. asks for treasury/pool/threads/identity questions and saves them PERMANENTLY
#      (User-scope environment variables + companions/desktop/precog-earn-config.json)
#   3. configures the settlement worker secrets (ADMIN_TOKEN, RPC_URL/RPC_AUTH optional)
#   4. asks EXPLICITLY whether to enable live settlement (DRY_RUN=0). Default is NO.
#   5. verifies everything end-to-end and prints your referral link.
#
# Secrets are written only to the Cloudflare account secrets vault and User env.
# This script never prints secret values. It never enables live settlement without
# you typing ENABLE-LIVE. Re-run any time; it is idempotent.

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "PreCog Earn setup"

$RepoRoot   = Split-Path -Parent $PSScriptRoot          # ...\site-work\earn-page-work
$WorkerDir  = Join-Path $PSScriptRoot "payout-worker"
$DesktopDir = Join-Path $PSScriptRoot "desktop"
$ConfigFile = Join-Path $DesktopDir "precog-earn-config.json"

function Say($msg)  { Write-Host "== $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   [ok] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "   [!] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "   [x] $msg" -ForegroundColor Red; Read-Host "Press Enter to exit" | Out-Null; exit 1 }
function Ask($prompt, $default) {
    $d = if ($default) { " [$default]" } else { "" }
    $v = Read-Host "   $prompt$d"
    if ([string]::IsNullOrWhiteSpace($v)) { return $default }
    return $v.Trim()
}

# ---------- 1. prerequisites ----------
Say "Prerequisites"
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { Fail "python not found on PATH. Install Python 3.9+ from python.org and re-run." }
$pyv = & python --version 2>&1
Ok "python: $pyv"

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { Fail "git not found on PATH." }
Ok "git present"

Push-Location $WorkerDir
$npxOk = $false
try { & npx --yes wrangler --version 2>&1 | Out-Null; $npxOk = $true } catch {}
Pop-Location
if (-not $npxOk) { Fail "npx/wrangler unusable. Run: npm i -g wrangler" }
Ok "wrangler available"

Say "Cloudflare auth"
$who = ""
try { $who = & npx --yes wrangler whoami 2>&1 | Out-String } catch {}
if ($who -match "not logged in|Usage|error") { Fail "wrangler not logged in. Run: npx wrangler login" }
Ok "wrangler authenticated"

# ---------- 2. identity + mining config ----------
Say "Identity & mining config"
if (-not (Test-Path (Join-Path $DesktopDir "precog-earn-node.py"))) { Fail "precog-earn-node.py missing next to this script." }

$wallet = [Environment]::GetEnvironmentVariable("PRECOG_XMR_WALLET", "User")
if (-not $wallet) { $wallet = Ask "Treasury XMR address (95 chars, starts with 4)" $null }
if ($wallet -notmatch '^[48A-Za-z0-9]{95}$') { Fail "That does not look like a standard Monero address." }
Ok "wallet set (never printed)"

$pool = [Environment]::GetEnvironmentVariable("PRECOG_XMR_POOL", "User")
if (-not $pool) { $pool = Ask "Mining pool" "stratum+ssl://pool.supportxmr.com:443" }
Ok "pool: $pool"

$threads = [Environment]::GetEnvironmentVariable("PRECOG_THREADS", "User")
if (-not $threads) { $cores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors; $def = [Math]::Max(1, $cores - 1); $threads = Ask "CPU threads" "$def" }
Ok "threads: $threads"

$handle = [Environment]::GetEnvironmentVariable("PRECOG_USER_HANDLE", "User")
if (-not $handle) { $handle = Ask "Public handle for this node (letters/numbers, optional)" ("node-" + (Get-Random -Maximum 99999)) }
Ok "handle: $handle"

$hmac = [Environment]::GetEnvironmentVariable("PRECOG_NODE_HMAC_KEY", "User")
if (-not $hmac) {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $hmac = [Convert]::ToBase64String($bytes) -replace '[/+=]', ''
    Ok "generated a fresh node HMAC key"
} else { Ok "reusing existing node HMAC key" }

$payoutUrl = [Environment]::GetEnvironmentVariable("PRECOG_PAYOUT_URL", "User")
if (-not $payoutUrl) { $payoutUrl = Ask "Payout worker URL" "https://precog-earn-payout.precogsecurity.workers.dev" }
Ok "payout worker: $payoutUrl"

# write permanent env (User scope) + local non-secret config
[Environment]::SetEnvironmentVariable("PRECOG_XMR_WALLET", $wallet, "User")
[Environment]::SetEnvironmentVariable("PRECOG_XMR_POOL", $pool, "User")
[Environment]::SetEnvironmentVariable("PRECOG_THREADS", "$threads", "User")
[Environment]::SetEnvironmentVariable("PRECOG_USER_HANDLE", $handle, "User")
[Environment]::SetEnvironmentVariable("PRECOG_NODE_HMAC_KEY", $hmac, "User")
[Environment]::SetEnvironmentVariable("PRECOG_PAYOUT_URL", $payoutUrl, "User")
$cfg = @{ wallet_set = $true; pool = $pool; threads = "$threads"; handle = $handle; payout_url = $payoutUrl; updated = (Get-Date -Format o) }
$cfg | ConvertTo-Json | Set-Content $ConfigFile -Encoding UTF8
Ok "saved $ConfigFile and User env vars (permanent)"

# ---------- 3. worker secrets ----------
Say "Settlement worker secrets"
Push-Location $WorkerDir
$admin = ""
try { $admin = (& npx --yes wrangler secret list 2>&1 | Out-String) } catch {}
if ($admin -notmatch "ADMIN_TOKEN") {
    $admBytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($admBytes)
    $admVal = [Convert]::ToBase64String($admBytes) -replace '[/+=]', ''
    $admVal | & npx --yes wrangler secret put ADMIN_TOKEN 2>&1 | Out-Null
    Ok "ADMIN_TOKEN generated and stored in Cloudflare secrets"
} else { Ok "ADMIN_TOKEN already present" }

$rpcUrl = [Environment]::GetEnvironmentVariable("PRECOG_RPC_URL", "User")
if ($rpcUrl) {
    $rpcUrl | & npx --yes wrangler secret put RPC_URL 2>&1 | Out-Null
    Ok "RPC_URL set from PRECOG_RPC_URL env"
} else {
    Warn "No PRECOG_RPC_URL env set. Live settlement needs your monero-wallet-rpc endpoint."
    $ans = Ask "Set RPC_URL now? (y/N)" "N"
    if ($ans -eq "y" -or $ans -eq "Y") {
        $u = Read-Host "   RPC_URL (e.g. http://127.0.0.1:18082)"
        $a = Read-Host "   RPC_AUTH (base64 user:pass)"
        $u | & npx --yes wrangler secret put RPC_URL 2>&1 | Out-Null
        $a | & npx --yes wrangler secret put RPC_AUTH 2>&1 | Out-Null
        Ok "RPC secrets stored"
    }
}

# HALT must be 0 for sends; set explicitly
"0" | & npx --yes wrangler secret put HALT 2>&1 | Out-Null
Ok "HALT=0 (spend path not frozen)"

# ---------- 4. live settlement decision ----------
Say "Live settlement decision (read carefully)"
Write-Host "   DRY_RUN=1  -> worker refuses every payout (default, safest)."
Write-Host "   DRY_RUN=0  -> payouts execute when you POST /v1/payout-execute with the admin token."
Write-Host "   Nothing executes automatically either way; the cron today is report-only."
$choice = Ask "Enable live settlement now? Type ENABLE-LIVE to set DRY_RUN=0, anything else keeps DRY_RUN=1" ""
if ($choice -eq "ENABLE-LIVE") {
    "0" | & npx --yes wrangler secret put DRY_RUN 2>&1 | Out-Null
    Ok "DRY_RUN=0 — live settlement ENABLED. Revers any time: set DRY_RUN=1."
} else {
    "1" | & npx --yes wrangler secret put DRY_RUN 2>&1 | Out-Null
    Ok "DRY_RUN=1 — settlement stays in dry-run."
}
Pop-Location

# ---------- 5. verify ----------
Say "Verification"
$health = ""
try { $health = (Invoke-WebRequest -Uri "$payoutUrl/v1/health" -UseBasicParsing -TimeoutSec 20).Content } catch {}
Write-Host "   health: $health"

Push-Location $DesktopDir
$env:PRECOG_PAYOUT_URL = $payoutUrl
$env:PRECOG_NODE_HMAC_KEY = $hmac
$upd = & python (Join-Path $DesktopDir "precog-earn-node.py") --check-update 2>&1 | Out-String
Write-Host "   node: $($upd.Trim())"
Pop-Location

$refScript = @"
import importlib.util as u
spec = u.spec_from_file_location('n', r'$DesktopDir\precog-earn-node.py')
m = u.module_from_spec(spec); spec.loader.exec_module(m)
h = m._user_handle(None)
print(h, m.referral_code(h))
"@
$refOut = & python -c $refScript 2>&1 | Out-String
$parts = $refOut.Trim() -split "\s+"
if ($parts.Count -ge 2) {
    $refCode = $parts[-1]
    Ok "your referral link: https://precogsecurity.pages.dev/earn?ref=$refCode"
    Ok "your referral stats: $payoutUrl/v1/referral-stats?ref=$refCode"
} else {
    Warn "could not derive referral code automatically"
}

Say "Done. Next steps:"
Write-Host "   1. Mine:  cd $DesktopDir ; python precog-earn-node.py --i-consent --start --threads $threads"
Write-Host "   2. GUI:   double-click earn.bat"
Write-Host "   3. Share: https://precogsecurity.pages.dev/earn?ref=$refCode"
Write-Host "   4. Verify ledger growth: $payoutUrl/v1/balance?user=$handle"
Read-Host "Press Enter to exit" | Out-Null

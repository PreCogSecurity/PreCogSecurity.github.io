$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$assets = Join-Path $here 'assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
$base = 'https://copy.sh/v86'
$imgSha1 = '67867c7990c3c0bbd01cadecf18188701b53315f'

$files = @(
  @{ name = 'libv86.js';           url = "$base/build/libv86.js" },
  @{ name = 'v86.wasm';            url = "$base/build/v86.wasm" },
  @{ name = 'seabios.bin';         url = "$base/bios/seabios.bin" },
  @{ name = 'vgabios.bin';         url = "$base/bios/vgabios.bin" },
  @{ name = 'android-x86-4.4-r2.img'; url = 'https://sourceforge.net/projects/android-x86/files/Release%204.4/android-x86-4.4-r2.img/download' }
)

$n = 0
foreach ($f in $files) {
  $n++
  $out = Join-Path $assets $f.name
  Write-Host "[$n/$($files.Count)] $($f.name)"
  if (Test-Path $out -PathType Leaf) {
    Write-Host "  exists, skipping"
    continue
  }
  curl.exe -fL --retry 3 -o $out $f.url
  if (-not $?) { throw "Failed to download $($f.name)" }
}

$img = Join-Path $assets 'android-x86-4.4-r2.img'
if (Test-Path $img -PathType Leaf) {
  Write-Host "Verifying Android image SHA-1..."
  $sha1 = (Get-FileHash -Algorithm SHA1 $img).Hash.ToLower()
  if ($sha1 -eq $imgSha1) { Write-Host "  OK ($sha1)" } else { Write-Host "  WARNING: hash mismatch ($sha1)" }
}

Write-Host "`nAssets ready in: $assets"
Write-Host "Launch with serve.cmd and open http://127.0.0.1:8080/"
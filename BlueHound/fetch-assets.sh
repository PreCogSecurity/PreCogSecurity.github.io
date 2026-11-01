#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/assets"
mkdir -p "$A"
base="https://raw.githubusercontent.com/copy/v86/master"
echo '[1/5] libv86.js'
curl -fL --retry 3 "$base/build/libv86.js" -o "$A/libv86.js"
echo '[2/5] v86.wasm'
curl -fL --retry 3 "$base/build/v86.wasm" -o "$A/v86.wasm"
echo '[3/5] SeaBIOS'
curl -fL --retry 3 "$base/bios/seabios.bin" -o "$A/seabios.bin"
echo '[4/5] VGA BIOS'
curl -fL --retry 3 "$base/bios/vgabios.bin" -o "$A/vgabios.bin"
echo '[5/5] Android-x86 4.4-r2 disk image (~411 MB)'
curl -fL --retry 3 "https://sourceforge.net/projects/android-x86/files/Release%204.4/android-x86-4.4-r2.img/download" -o "$A/android-x86-4.4-r2.img"
echo 'Verifying Android image SHA1...'
echo '67867c7990c3c0bbd01cadecf18188701b53315f  '"$A/android-x86-4.4-r2.img" | sha1sum -c -
echo 'All v86/Android assets installed.'

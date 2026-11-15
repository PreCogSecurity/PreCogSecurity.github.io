# Third-party components

## XMRig v6.26.0 (RandomX / Monero CPU mining)

- Project: https://github.com/xmrig/xmrig
- License: GNU General Public License v3.0, Copyright (c) the XMRig authors
  and contributors
- Used by: `companions/desktop/precog-earn-node.py` as a downloaded,
  hash-verified binary at first run. Nothing is compiled or shipped inside
  this repository; the wrapper downloads the official, pinned release and
  verifies its SHA-256 against XMRig's own published `SHA256SUMS` before
  executing it.
- Corresponding source for the pinned release:
  https://github.com/xmrig/xmrig/tree/v6.26.0
- If you distribute or modify this wrapper along with a built artifact, you
  must satisfy GPLv3 obligations (provide source, license notices, same
  license). This repository distributes THAT SOURCE ONLY via download —
  it does not authorize relicensing XMRig.

## Other

- Monero address and pool infrastructure: the operator connects the node to
  public pools and holds the treasury wallet. Not part of this repository.

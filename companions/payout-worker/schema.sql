-- PreCog Earn payout worker — D1 schema.
-- Append-only ledger: receipts (share claims), payout_addresses (operator-managed
-- declared destinations keyed by pseudonymous handle), settlements (executed/planned
-- batches), meta (kill switches).

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  user_handle TEXT NOT NULL,          -- pseudonymous; HMAC of the user's key
  job_id TEXT NOT NULL,
  shares REAL NOT NULL,
  receipt_id TEXT NOT NULL UNIQUE,    -- node-signed idempotency key
  redeemed INTEGER NOT NULL DEFAULT 0 -- 0 = outstanding; 1 = settled
);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_handle);
CREATE INDEX IF NOT EXISTS idx_receipts_redeemed ON receipts(redeemed);

CREATE TABLE IF NOT EXISTS payout_addresses (
  user_handle TEXT PRIMARY KEY,       -- matches receipts.user_handle
  address TEXT NOT NULL,              -- operator-declared payout destination
  declared_at INTEGER NOT NULL DEFAULT (unixepoch()),
  declared_by TEXT NOT NULL           -- e.g. 'operator-import-2026-11-15'
);

CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  pool_xmr REAL NOT NULL,
  recipients_json TEXT NOT NULL,
  txid TEXT,
  mode TEXT NOT NULL DEFAULT 'live'   -- 'live' or 'dry-run-preview'
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta(key, value) VALUES ('HALT', '0');

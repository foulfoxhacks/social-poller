-- Short-lived encrypted authorization-code handoffs only. No social tokens.
CREATE TABLE oauth_handoffs (
  id TEXT PRIMARY KEY,
  poll_hash TEXT NOT NULL,
  public_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('pending','authorizing','ready')),
  state_hash TEXT UNIQUE,
  browser_hash TEXT,
  result TEXT
);
CREATE INDEX oauth_handoffs_expiry ON oauth_handoffs(expires_at);

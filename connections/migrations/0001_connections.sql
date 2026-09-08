-- Staged in a SEPARATE migration directory. Not applied to the history DB.
PRAGMA foreign_keys = ON;
CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  hold_days INTEGER NOT NULL CHECK(hold_days IN (1,7,30)),
  expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_states_expiry ON oauth_states(expires_at);
CREATE TABLE creator_connections (
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider='twitch'),
  account_id TEXT NOT NULL,
  token_envelope TEXT NOT NULL,
  hold_until INTEGER NOT NULL,
  validated_at INTEGER NOT NULL,
  access_expires_at INTEGER NOT NULL,
  public_metrics TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(public_metrics)),
  PRIMARY KEY(tenant_id,provider,account_id)
);
CREATE INDEX creator_connections_expiry ON creator_connections(hold_until);
CREATE TABLE connection_metrics (
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('followers','viewers')),
  value REAL NOT NULL CHECK(value>=0),
  observed_at INTEGER NOT NULL,
  retain_until INTEGER NOT NULL,
  PRIMARY KEY(tenant_id,provider,account_id,metric,observed_at),
  FOREIGN KEY(tenant_id,provider,account_id) REFERENCES creator_connections(tenant_id,provider,account_id) ON DELETE CASCADE
);
CREATE INDEX connection_metrics_expiry ON connection_metrics(retain_until);

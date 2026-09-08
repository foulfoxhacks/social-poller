-- Only registered creators' published aggregate observations. No raw exports.
CREATE TABLE observations (
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  metric TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  value REAL NOT NULL CHECK(value >= 0),
  precision TEXT NOT NULL,
  scope TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_url TEXT NOT NULL,
  sample_size INTEGER,
  PRIMARY KEY(platform, username, metric, observed_at, scope, source_kind)
) WITHOUT ROWID;
CREATE INDEX observations_retention ON observations(observed_at);

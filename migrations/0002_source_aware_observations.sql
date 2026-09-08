-- Preserve all existing observations while widening identity to include
-- provider URL, precision and sample size. Wrangler applies this atomically.
CREATE TABLE observations_source_aware (
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  metric TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  value REAL NOT NULL CHECK(value >= 0),
  precision TEXT NOT NULL,
  scope TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_url TEXT NOT NULL,
  sample_size INTEGER
);
INSERT INTO observations_source_aware SELECT * FROM observations;
DROP TABLE observations;
ALTER TABLE observations_source_aware RENAME TO observations;
CREATE UNIQUE INDEX observations_identity ON observations
  (platform,username,metric,observed_at,scope,source_kind,source_url,precision,coalesce(sample_size,-1));
CREATE INDEX observations_lookup ON observations(platform,username,metric,observed_at);
CREATE INDEX observations_retention ON observations(observed_at);

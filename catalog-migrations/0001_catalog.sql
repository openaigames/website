CREATE TABLE catalog_entries (
  channel TEXT NOT NULL,
  revision TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (channel, revision)
);
CREATE TABLE catalog_heads (
  channel TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  sequence INTEGER NOT NULL
);

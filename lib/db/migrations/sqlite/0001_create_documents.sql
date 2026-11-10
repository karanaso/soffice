CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('word', 'excel', 'powerpoint', 'drawing')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT documents_name_key_unique UNIQUE (name_key)
);

CREATE INDEX IF NOT EXISTS documents_updated_at_idx
  ON documents (updated_at DESC, id ASC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('word', 'excel', 'powerpoint', 'drawing')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT documents_name_key_unique UNIQUE (name_key)
);

CREATE INDEX IF NOT EXISTS documents_updated_at_idx
  ON documents (updated_at DESC, id ASC);

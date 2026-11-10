CREATE TABLE IF NOT EXISTS document_contents (
  document_id TEXT PRIMARY KEY NOT NULL
    REFERENCES documents (id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

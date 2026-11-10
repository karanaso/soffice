CREATE TABLE IF NOT EXISTS document_contents (
  document_id UUID PRIMARY KEY NOT NULL
    REFERENCES documents (id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

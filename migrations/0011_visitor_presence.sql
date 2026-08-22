CREATE TABLE IF NOT EXISTS visitor_presence (
  session_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen
  ON visitor_presence(last_seen);

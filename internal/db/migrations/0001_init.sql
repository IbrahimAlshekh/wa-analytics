CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  jid TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  display_name TEXT,
  added_at INTEGER NOT NULL,
  tracking_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS presence_events (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  last_seen INTEGER,
  observed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presence_contact_time ON presence_events(contact_id, observed_at);

CREATE TABLE IF NOT EXISTS profile_picture_history (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  picture_id TEXT,
  url TEXT,
  sha256 TEXT,
  captured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_picture_contact_time ON profile_picture_history(contact_id, captured_at);

CREATE TABLE IF NOT EXISTS about_history (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  text TEXT,
  set_at INTEGER,
  captured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_about_contact_time ON about_history(contact_id, captured_at);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

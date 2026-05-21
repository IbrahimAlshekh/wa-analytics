CREATE TABLE IF NOT EXISTS stories (
  id          INTEGER PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id  INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  sender_jid  TEXT NOT NULL,
  story_id    TEXT NOT NULL,
  media_type  TEXT,
  media_path  TEXT,
  caption     TEXT,
  posted_at   INTEGER NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_account_story ON stories(account_id, story_id);
CREATE INDEX IF NOT EXISTS idx_stories_contact_time ON stories(contact_id, posted_at DESC);

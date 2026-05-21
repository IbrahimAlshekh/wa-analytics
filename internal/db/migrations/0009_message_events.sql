ALTER TABLE messages ADD COLUMN quoted_message_id TEXT;

CREATE TABLE IF NOT EXISTS message_events (
    id                INTEGER PRIMARY KEY,
    account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id        INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    target_message_id TEXT    NOT NULL,
    kind              TEXT    NOT NULL,
    actor_jid         TEXT    NOT NULL,
    is_from_me        INTEGER NOT NULL DEFAULT 0,
    emoji             TEXT,
    new_text          TEXT,
    observed_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_message_events_account_target
    ON message_events(account_id, target_message_id);
CREATE INDEX IF NOT EXISTS idx_message_events_contact_time
    ON message_events(contact_id, observed_at);

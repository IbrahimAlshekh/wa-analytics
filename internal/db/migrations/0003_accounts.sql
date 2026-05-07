CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    jid TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT '',
    tracking_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

ALTER TABLE contacts ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    chat_jid TEXT NOT NULL,
    message_id TEXT NOT NULL,
    sender_jid TEXT NOT NULL,
    is_from_me INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL,
    text TEXT,
    media_type TEXT,
    received_at INTEGER NOT NULL,
    UNIQUE(account_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(account_id, chat_jid, timestamp);

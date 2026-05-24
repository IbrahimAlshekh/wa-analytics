-- Shared sticker catalogue: one row per unique sticker image (hash-addressed).
CREATE TABLE IF NOT EXISTS stickers (
    hash       TEXT    NOT NULL PRIMARY KEY,   -- hex-encoded SHA-256 of the raw image bytes
    path       TEXT    NOT NULL,               -- relative path under media dir, e.g. "stickers/<hash>.webp"
    created_at INTEGER NOT NULL
);

-- Per-message sticker reference (nullable; only set for media_type='sticker').
ALTER TABLE messages ADD COLUMN sticker_hash TEXT REFERENCES stickers(hash);

-- Per-contact sticker usage analytics.
CREATE TABLE IF NOT EXISTS analytics_sticker_daily (
    contact_id   INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    day          TEXT    NOT NULL,
    sender_side  TEXT    NOT NULL,
    sticker_hash TEXT    NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, day, sender_side, sticker_hash)
);
CREATE INDEX IF NOT EXISTS idx_analytics_sticker_contact_day
    ON analytics_sticker_daily(contact_id, day, sender_side);

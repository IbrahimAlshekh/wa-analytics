CREATE TABLE IF NOT EXISTS analytics_daily (
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    day         TEXT    NOT NULL,   -- YYYY-MM-DD in server local TZ
    sender_side TEXT    NOT NULL,   -- 'me' | 'them'
    messages    INTEGER NOT NULL DEFAULT 0,
    words       INTEGER NOT NULL DEFAULT 0,
    chars       INTEGER NOT NULL DEFAULT 0,
    voice_notes INTEGER NOT NULL DEFAULT 0,
    photos      INTEGER NOT NULL DEFAULT 0,
    videos      INTEGER NOT NULL DEFAULT 0,
    stickers    INTEGER NOT NULL DEFAULT 0,
    documents   INTEGER NOT NULL DEFAULT 0,
    links       INTEGER NOT NULL DEFAULT 0,
    questions   INTEGER NOT NULL DEFAULT 0,
    laughter_msgs INTEGER NOT NULL DEFAULT 0,
    night_msgs  INTEGER NOT NULL DEFAULT 0,
    e_love      INTEGER NOT NULL DEFAULT 0,
    e_miss      INTEGER NOT NULL DEFAULT 0,
    e_happy     INTEGER NOT NULL DEFAULT 0,
    e_sad       INTEGER NOT NULL DEFAULT 0,
    e_care      INTEGER NOT NULL DEFAULT 0,
    e_encourage INTEGER NOT NULL DEFAULT 0,
    e_apology   INTEGER NOT NULL DEFAULT 0,
    e_gratitude INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, day, sender_side)
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_contact_day ON analytics_daily(contact_id, day);

CREATE TABLE IF NOT EXISTS analytics_emoji_daily (
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    day         TEXT    NOT NULL,
    sender_side TEXT    NOT NULL,
    emoji       TEXT    NOT NULL,
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, day, sender_side, emoji)
);
CREATE INDEX IF NOT EXISTS idx_analytics_emoji_contact_day ON analytics_emoji_daily(contact_id, day, sender_side);

CREATE TABLE IF NOT EXISTS analytics_word_daily (
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    day         TEXT    NOT NULL,
    sender_side TEXT    NOT NULL,
    word        TEXT    NOT NULL,
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, day, sender_side, word)
);
CREATE INDEX IF NOT EXISTS idx_analytics_word_contact_day ON analytics_word_daily(contact_id, day, sender_side);

CREATE TABLE IF NOT EXISTS analytics_domain_daily (
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    day         TEXT    NOT NULL,
    sender_side TEXT    NOT NULL,
    domain      TEXT    NOT NULL,
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, day, sender_side, domain)
);
CREATE INDEX IF NOT EXISTS idx_analytics_domain_contact_day ON analytics_domain_daily(contact_id, day, sender_side);

CREATE TABLE IF NOT EXISTS analytics_hour_daily (
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    day         TEXT    NOT NULL,
    sender_side TEXT    NOT NULL,
    hour        INTEGER NOT NULL,   -- 0-23
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, day, sender_side, hour)
);
CREATE INDEX IF NOT EXISTS idx_analytics_hour_contact_day ON analytics_hour_daily(contact_id, day, sender_side);

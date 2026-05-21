ALTER TABLE accounts ADD COLUMN force_offline INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS account_schedule_slots (
    id         INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    start_min  INTEGER NOT NULL,   -- minutes from midnight [0, 1439]
    end_min    INTEGER NOT NULL    -- minutes from midnight [0, 1439]; may be < start_min for overnight slots
);

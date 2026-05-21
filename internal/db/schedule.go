package db

import "context"

type ScheduleSlot struct {
	ID       int64 `json:"id"`
	StartMin int   `json:"startMin"`
	EndMin   int   `json:"endMin"`
}

func (db *DB) GetAccountSchedule(ctx context.Context, accountID int64) (forceOffline bool, slots []ScheduleSlot, err error) {
	var offline int
	err = db.QueryRowContext(ctx, `SELECT COALESCE(force_offline, 0) FROM accounts WHERE id=?`, accountID).Scan(&offline)
	if err != nil {
		return
	}
	forceOffline = offline != 0

	rows, err := db.QueryContext(ctx,
		`SELECT id, start_min, end_min FROM account_schedule_slots WHERE account_id=? ORDER BY start_min`,
		accountID,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var s ScheduleSlot
		if err = rows.Scan(&s.ID, &s.StartMin, &s.EndMin); err != nil {
			return
		}
		slots = append(slots, s)
	}
	err = rows.Err()
	return
}

func (db *DB) SetAccountSchedule(ctx context.Context, accountID int64, forceOffline bool, slots []ScheduleSlot) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	forceOfflineInt := 0
	if forceOffline {
		forceOfflineInt = 1
	}

	if _, err = tx.ExecContext(ctx,
		`UPDATE accounts SET force_offline=? WHERE id=?`,
		forceOfflineInt, accountID,
	); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx,
		`DELETE FROM account_schedule_slots WHERE account_id=?`,
		accountID,
	); err != nil {
		return err
	}

	for _, s := range slots {
		if _, err = tx.ExecContext(ctx,
			`INSERT INTO account_schedule_slots (account_id, start_min, end_min) VALUES (?, ?, ?)`,
			accountID, s.StartMin, s.EndMin,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

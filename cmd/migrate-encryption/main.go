// migrate-encryption is a one-time tool that encrypts plaintext JID, phone, and
// sender fields in an existing database using the app key from the .env file.
//
// Run it once after the first deployment that includes encryption support:
//
//	./bin/migrate-encryption
//
// The tool is safe to run multiple times — already-encrypted rows are skipped.
// Once migration is confirmed, this directory can be deleted from the project.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	_ "github.com/mattn/go-sqlite3"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/crypto"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		os.Exit(1)
	}

	ctx := context.Background()

	if err := run(ctx, cfg.TrackerDBPath(), cfg.DBKey); err != nil {
		fmt.Fprintf(os.Stderr, "migration failed: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, dbPath string, key []byte) error {
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000", dbPath)
	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer sqlDB.Close()
	sqlDB.SetMaxOpenConns(1)

	// Check if already migrated.
	var version string
	err = sqlDB.QueryRowContext(ctx, `SELECT value FROM app_meta WHERE key='encryption_version'`).Scan(&version)
	if err == nil && version == "1" {
		fmt.Println("Already migrated (encryption_version=1). Nothing to do.")
		return nil
	}

	fmt.Println("Starting encryption migration...")

	tx, err := sqlDB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	// --- contacts: jid, lid, phone ---
	type contactRow struct {
		id    int64
		jid   string
		lid   string
		phone string
	}
	rows, err := tx.QueryContext(ctx, `SELECT id, jid, COALESCE(lid,''), phone FROM contacts`)
	if err != nil {
		return fmt.Errorf("query contacts: %w", err)
	}
	var contacts []contactRow
	for rows.Next() {
		var c contactRow
		if err := rows.Scan(&c.id, &c.jid, &c.lid, &c.phone); err != nil {
			rows.Close()
			return err
		}
		contacts = append(contacts, c)
	}
	rows.Close()

	skippedContacts := 0
	for _, c := range contacts {
		if crypto.IsEncrypted(c.jid) {
			skippedContacts++
			continue // already encrypted
		}
		newJID := crypto.Encrypt(c.jid, key)
		newLID := ""
		if c.lid != "" {
			newLID = crypto.Encrypt(c.lid, key)
		}
		newPhone := crypto.Encrypt(c.phone, key)
		if _, err := tx.ExecContext(ctx,
			`UPDATE contacts SET jid=?, lid=?, phone=? WHERE id=?`,
			newJID, nullStr(newLID), newPhone, c.id); err != nil {
			return fmt.Errorf("update contact %d: %w", c.id, err)
		}
	}
	fmt.Printf("  contacts:  %d encrypted, %d already done\n",
		len(contacts)-skippedContacts, skippedContacts)

	// --- accounts: jid ---
	type accountRow struct {
		id  int64
		jid string
	}
	arows, err := tx.QueryContext(ctx, `SELECT id, jid FROM accounts`)
	if err != nil {
		return fmt.Errorf("query accounts: %w", err)
	}
	var accounts []accountRow
	for arows.Next() {
		var a accountRow
		if err := arows.Scan(&a.id, &a.jid); err != nil {
			arows.Close()
			return err
		}
		accounts = append(accounts, a)
	}
	arows.Close()

	skippedAccounts := 0
	for _, a := range accounts {
		if crypto.IsEncrypted(a.jid) {
			skippedAccounts++
			continue
		}
		newJID := crypto.Encrypt(a.jid, key)
		if _, err := tx.ExecContext(ctx,
			`UPDATE accounts SET jid=? WHERE id=?`, newJID, a.id); err != nil {
			return fmt.Errorf("update account %d: %w", a.id, err)
		}
	}
	fmt.Printf("  accounts:  %d encrypted, %d already done\n",
		len(accounts)-skippedAccounts, skippedAccounts)

	// --- messages: chat_jid, sender_jid ---
	type msgRow struct {
		id        int64
		chatJID   string
		senderJID string
	}
	mrows, err := tx.QueryContext(ctx, `SELECT id, chat_jid, sender_jid FROM messages`)
	if err != nil {
		return fmt.Errorf("query messages: %w", err)
	}
	var msgs []msgRow
	for mrows.Next() {
		var m msgRow
		if err := mrows.Scan(&m.id, &m.chatJID, &m.senderJID); err != nil {
			mrows.Close()
			return err
		}
		msgs = append(msgs, m)
	}
	mrows.Close()

	skippedMsgs := 0
	for _, m := range msgs {
		if crypto.IsEncrypted(m.chatJID) {
			skippedMsgs++
			continue
		}
		newChat := crypto.Encrypt(m.chatJID, key)
		newSender := crypto.Encrypt(m.senderJID, key)
		if _, err := tx.ExecContext(ctx,
			`UPDATE messages SET chat_jid=?, sender_jid=? WHERE id=?`,
			newChat, newSender, m.id); err != nil {
			return fmt.Errorf("update message %d: %w", m.id, err)
		}
	}
	fmt.Printf("  messages:  %d encrypted, %d already done\n",
		len(msgs)-skippedMsgs, skippedMsgs)

	// Mark as complete.
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO app_meta (key, value) VALUES ('encryption_version', '1')
		 ON CONFLICT(key) DO UPDATE SET value='1'`); err != nil {
		return fmt.Errorf("set encryption_version: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	fmt.Println("Migration complete. encryption_version=1 recorded.")
	fmt.Println("You can delete cmd/migrate-encryption/ from the project if no longer needed.")
	return nil
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// analytics-backfill populates derived analytics columns and aggregate tables for
// all messages that were stored before analytics tracking was introduced.
//
// Run once after deploying the analytics feature:
//
//	./bin/analytics-backfill
//
// Safe to re-run: already-processed messages (word_count IS NOT NULL) are skipped.
// Progress is checkpointed in app_meta.analytics_version so a crashed run can continue.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

const chunkSize = 1000

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		os.Exit(1)
	}

	ctx := context.Background()
	if err := run(ctx, cfg.TrackerDBPath(), cfg.DBKey); err != nil {
		fmt.Fprintf(os.Stderr, "backfill failed: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, dbPath string, key []byte) error {
	store, err := db.Open(ctx, dbPath, key)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer store.Close()

	// Check if already completed.
	var version string
	_ = store.QueryRowContext(ctx, `SELECT value FROM app_meta WHERE key='analytics_version'`).Scan(&version)
	if version == "1" {
		fmt.Println("Already done (analytics_version=1). Nothing to do.")
		return nil
	}

	// Count remaining work.
	var total int
	_ = store.QueryRowContext(ctx, `SELECT COUNT(*) FROM messages WHERE word_count IS NULL`).Scan(&total)
	if total == 0 {
		fmt.Println("No unprocessed messages found.")
		return markDone(ctx, store)
	}
	fmt.Printf("Processing %d messages in chunks of %d...\n", total, chunkSize)

	processed := 0
	lastID := int64(0)

	for {
		chunk, err := fetchChunk(ctx, store, lastID)
		if err != nil {
			return fmt.Errorf("fetch chunk after id=%d: %w", lastID, err)
		}
		if len(chunk) == 0 {
			break
		}

		if err := processChunk(ctx, store, chunk); err != nil {
			return fmt.Errorf("process chunk (first id=%d): %w", chunk[0].id, err)
		}

		processed += len(chunk)
		lastID = chunk[len(chunk)-1].id
		fmt.Printf("  %d / %d processed (%.0f%%)\n", processed, total, float64(processed)/float64(total)*100)

		if len(chunk) < chunkSize {
			break
		}
	}

	if err := markDone(ctx, store); err != nil {
		return err
	}
	fmt.Printf("\nBackfill complete. %d messages processed.\n", processed)
	return nil
}

// msgRow holds the minimal data needed to compute analytics features for a message.
type msgRow struct {
	id          int64
	contactID   sql.NullInt64
	isFromMe    bool
	timestamp   int64
	text        string
	mediaType   string
	stickerHash string
}

func fetchChunk(ctx context.Context, store *db.DB, afterID int64) ([]msgRow, error) {
	rows, err := store.QueryContext(ctx,
		`SELECT id, contact_id, is_from_me, timestamp,
		        COALESCE(text,''), COALESCE(media_type,''), COALESCE(sticker_hash,'')
		 FROM messages WHERE word_count IS NULL AND id > ?
		 ORDER BY id LIMIT ?`, afterID, chunkSize)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chunk []msgRow
	for rows.Next() {
		var r msgRow
		var fromMe int
		if err := rows.Scan(&r.id, &r.contactID, &fromMe, &r.timestamp, &r.text, &r.mediaType, &r.stickerHash); err != nil {
			return nil, err
		}
		r.isFromMe = fromMe == 1
		chunk = append(chunk, r)
	}
	return chunk, rows.Err()
}

func processChunk(ctx context.Context, store *db.DB, chunk []msgRow) error {
	tx, err := store.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	for _, r := range chunk {
		ts := time.Unix(r.timestamp, 0)
		f := analytics.ExtractFeatures(r.text, ts)

		if err := store.UpdateMessageDerivedTx(ctx, tx, r.id, f); err != nil {
			return fmt.Errorf("update message %d: %w", r.id, err)
		}

		if r.contactID.Valid {
			side := "them"
			if r.isFromMe {
				side = "me"
			}
			day := ts.Local().Format("2006-01-02")
			if err := store.ApplyMessageAnalyticsTx(ctx, tx, r.contactID.Int64, side, day, r.mediaType, r.stickerHash, f); err != nil {
				return fmt.Errorf("analytics for message %d: %w", r.id, err)
			}
		}
	}

	return tx.Commit()
}

func markDone(ctx context.Context, store *db.DB) error {
	_, err := store.ExecContext(ctx,
		`INSERT INTO app_meta (key, value) VALUES ('analytics_version', '1')
		 ON CONFLICT(key) DO UPDATE SET value='1'`)
	return err
}

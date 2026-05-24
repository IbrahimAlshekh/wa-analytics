package db_test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// ---- UpsertSticker / GetStickerByHash ----------------------------------------

func TestUpsertSticker_New(t *testing.T) {
	store := testutil.OpenTestDB(t)
	ctx := context.Background()

	s, err := store.UpsertSticker(ctx, "abc123", "stickers/abc123.webp")
	require.NoError(t, err)
	assert.Equal(t, "abc123", s.Hash)
	assert.Equal(t, "stickers/abc123.webp", s.Path)
	assert.Greater(t, s.CreatedAt, int64(0))
}

func TestUpsertSticker_Idempotent(t *testing.T) {
	store := testutil.OpenTestDB(t)
	ctx := context.Background()

	s1, err := store.UpsertSticker(ctx, "deadbeef", "stickers/deadbeef.webp")
	require.NoError(t, err)

	// Second upsert with a different path must not overwrite the first record.
	s2, err := store.UpsertSticker(ctx, "deadbeef", "stickers/different.webp")
	require.NoError(t, err)

	assert.Equal(t, s1.Hash, s2.Hash)
	assert.Equal(t, s1.Path, s2.Path, "path must not be overwritten on conflict")
	assert.Equal(t, s1.CreatedAt, s2.CreatedAt, "created_at must not change on conflict")
}

func TestGetStickerByHash_NotFound(t *testing.T) {
	store := testutil.OpenTestDB(t)
	_, err := store.GetStickerByHash(context.Background(), "nonexistent")
	assert.ErrorIs(t, err, sql.ErrNoRows)
}

func TestGetStickerByHash_Found(t *testing.T) {
	store := testutil.OpenTestDB(t)
	ctx := context.Background()

	_, err := store.UpsertSticker(ctx, "cafebabe", "stickers/cafebabe.webp")
	require.NoError(t, err)

	s, err := store.GetStickerByHash(ctx, "cafebabe")
	require.NoError(t, err)
	assert.Equal(t, "cafebabe", s.Hash)
	assert.Equal(t, "stickers/cafebabe.webp", s.Path)
}

// ---- StickerHash stored on messages -----------------------------------------

func TestInsertMessageWithAnalytics_StickerHash(t *testing.T) {
	store := testutil.OpenTestDB(t)
	ctx := context.Background()
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	hash := "feedface"
	_, err := store.UpsertSticker(ctx, hash, "stickers/feedface.webp")
	require.NoError(t, err)

	cid := contact.ID
	now := time.Now()
	m, err := store.InsertMessageWithAnalytics(ctx,
		db.Message{
			AccountID:   acc.ID,
			ContactID:   &cid,
			ChatJID:     contact.JID,
			MessageID:   "msg-sticker-1",
			SenderJID:   contact.JID,
			Timestamp:   now.Unix(),
			MediaType:   "sticker",
			MediaPath:   "stickers/feedface.webp",
			StickerHash: hash,
			ReceivedAt:  now.Unix(),
		},
		analytics.ExtractFeatures("", now),
	)
	require.NoError(t, err)
	assert.Equal(t, hash, m.StickerHash)

	// Verify the hash is persisted and round-trips through ListMessages.
	msgs, err := store.ListMessages(ctx, contact.ID, 0, 10)
	require.NoError(t, err)
	require.Len(t, msgs, 1)
	assert.Equal(t, hash, msgs[0].StickerHash)
}

// ---- Sticker analytics aggregation ------------------------------------------

func TestGetTopStickers(t *testing.T) {
	store := testutil.OpenTestDB(t)
	ctx := context.Background()
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	cid := contact.ID

	hashes := []string{"hash1", "hash2", "hash3"}
	for _, h := range hashes {
		_, err := store.UpsertSticker(ctx, h, "stickers/"+h+".webp")
		require.NoError(t, err)
	}

	now := time.Now()
	day := now.Local().Format("2006-01-02")

	// seed: hash1 sent 3 times by them, hash2 once by me, hash3 twice by them.
	type seed struct {
		side  string
		hash  string
		count int
	}
	for _, s := range []seed{
		{"them", "hash1", 3},
		{"me", "hash2", 1},
		{"them", "hash3", 2},
	} {
		for i := 0; i < s.count; i++ {
			tx, err := store.BeginTx(ctx, nil)
			require.NoError(t, err)
			err = store.ApplyMessageAnalyticsTx(ctx, tx, cid, s.side, day, "sticker", s.hash,
				analytics.ExtractFeatures("", now))
			require.NoError(t, err)
			require.NoError(t, tx.Commit())
		}
	}

	me, them, err := store.GetTopStickers(ctx, cid, day, day, 10)
	require.NoError(t, err)

	require.Len(t, me, 1)
	assert.Equal(t, "hash2", me[0].Hash)
	assert.Equal(t, int64(1), me[0].Count)
	assert.Equal(t, "stickers/hash2.webp", me[0].Path)

	require.Len(t, them, 2)
	assert.Equal(t, "hash1", them[0].Hash) // highest count first
	assert.Equal(t, int64(3), them[0].Count)
	assert.Equal(t, "hash3", them[1].Hash)
	assert.Equal(t, int64(2), them[1].Count)
}

func TestGetTopStickers_Limit(t *testing.T) {
	store := testutil.OpenTestDB(t)
	ctx := context.Background()
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	cid := contact.ID

	now := time.Now()
	day := now.Local().Format("2006-01-02")

	// Seed 5 different stickers sent by "me".
	for i := 0; i < 5; i++ {
		h := fmt.Sprintf("sticker%d", i)
		_, err := store.UpsertSticker(ctx, h, "stickers/"+h+".webp")
		require.NoError(t, err)
		tx, err := store.BeginTx(ctx, nil)
		require.NoError(t, err)
		err = store.ApplyMessageAnalyticsTx(ctx, tx, cid, "me", day, "sticker", h,
			analytics.ExtractFeatures("", now))
		require.NoError(t, err)
		require.NoError(t, tx.Commit())
	}

	me, _, err := store.GetTopStickers(ctx, cid, day, day, 3)
	require.NoError(t, err)
	assert.Len(t, me, 3, "should be capped at limit")
}

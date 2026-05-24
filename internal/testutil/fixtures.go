package testutil

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

// SeedAccount inserts a test account and returns it.
func SeedAccount(tb testing.TB, store *db.DB) db.Account {
	tb.Helper()
	jid := fmt.Sprintf("test_%d@s.whatsapp.net", time.Now().UnixNano())
	acc, err := store.InsertAccount(context.Background(), jid, "Test Account")
	if err != nil {
		tb.Fatalf("testutil: seed account: %v", err)
	}
	return acc
}

// SeedContact inserts a tracked test contact under accountID.
func SeedContact(tb testing.TB, store *db.DB, accountID int64, jid string) db.Contact {
	tb.Helper()
	if jid == "" {
		jid = fmt.Sprintf("contact_%d@s.whatsapp.net", time.Now().UnixNano())
	}
	phone := "14155550000"
	contact, err := store.InsertContact(context.Background(), accountID, jid, phone, "Test Contact")
	if err != nil {
		tb.Fatalf("testutil: seed contact: %v", err)
	}
	return contact
}

// SeedPresence inserts a presence event for contactID.
func SeedPresence(tb testing.TB, store *db.DB, contactID int64, state string, at time.Time) db.PresenceEvent {
	tb.Helper()
	ev, err := store.InsertPresence(context.Background(), contactID, state, nil, at.Unix())
	if err != nil {
		tb.Fatalf("testutil: seed presence: %v", err)
	}
	return ev
}

// SeedMessage inserts a message for contactID and returns it.
func SeedMessage(tb testing.TB, store *db.DB, accountID, contactID int64, text string, at time.Time) db.Message {
	tb.Helper()
	cid := contactID
	msg := db.Message{
		AccountID: accountID,
		ContactID: &cid,
		ChatJID:   "contact@s.whatsapp.net",
		SenderJID: "contact@s.whatsapp.net",
		IsFromMe:  false,
		Text:      text,
		Timestamp: at.Unix(),
	}
	m, err := store.InsertMessage(context.Background(), msg)
	if err != nil {
		tb.Fatalf("testutil: seed message: %v", err)
	}
	return m
}

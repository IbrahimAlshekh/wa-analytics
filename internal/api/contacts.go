package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
	"go.mau.fi/whatsmeow/types"
)

type createContactReq struct {
	Phone       string `json:"phone"`
	DisplayName string `json:"displayName"`
}

type patchContactReq struct {
	DisplayName     *string `json:"displayName,omitempty"`
	TrackingEnabled *bool   `json:"trackingEnabled,omitempty"`
}

func (s *Server) handleListContacts(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	contacts, err := s.db.ListContacts(r.Context(), accountID)
	if err != nil {
		slog.Error("contacts: list failed", "accountID", accountID, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Debug("contacts: listed", "accountID", accountID, "count", len(contacts))
	if contacts == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	writeJSON(w, http.StatusOK, contacts)
}

func (s *Server) handleCreateContact(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	var req createContactReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(req.Phone) == "" {
		writeErr(w, http.StatusBadRequest, errors.New("phone required"))
		return
	}
	jid, err := wajid(req.Phone)
	if err != nil {
		slog.Warn("contacts: invalid phone", "accountID", accountID, "phone", req.Phone, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	contact, err := s.db.InsertContact(r.Context(), accountID, jid, req.Phone, strings.TrimSpace(req.DisplayName))
	if err != nil {
		slog.Error("contacts: insert failed", "accountID", accountID, "phone", req.Phone, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	slog.Info("contacts: created", "accountID", accountID, "id", contact.ID, "phone", contact.Phone, "jid", contact.JID)
	go s.tracker.SubscribeContact(context.Background(), contact)
	writeJSON(w, http.StatusCreated, contact)
}

func (s *Server) handlePatchContact(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	cid, err := parseCID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	var req patchContactReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.db.UpdateContact(r.Context(), cid, req.DisplayName, req.TrackingEnabled); err != nil {
		slog.Error("contacts: update failed", "accountID", accountID, "id", cid, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	contact, err := s.db.GetContact(r.Context(), accountID, cid)
	if err != nil {
		slog.Warn("contacts: get after update failed", "accountID", accountID, "id", cid, "err", err)
		writeErr(w, http.StatusNotFound, err)
		return
	}
	slog.Info("contacts: patched", "accountID", accountID, "id", cid, "tracking_enabled", contact.TrackingEnabled)
	if req.TrackingEnabled != nil && *req.TrackingEnabled {
		go s.tracker.SubscribeContact(context.Background(), contact)
	}
	writeJSON(w, http.StatusOK, contact)
}

func (s *Server) handleSyncContacts(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	client := s.manager.GetByAccountID(accountID)
	if client == nil {
		writeErr(w, http.StatusNotFound, errors.New("account not found or not connected"))
		return
	}
	n, err := SyncWAContacts(r.Context(), client, s.db, accountID)
	if err != nil {
		slog.Error("contacts: sync failed", "accountID", accountID, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Info("contacts: synced from WA store", "accountID", accountID, "total", n)
	writeJSON(w, http.StatusOK, map[string]int{"synced": n})
}

// SyncWAContacts reads all contacts from the whatsmeow local store and inserts
// any individual contacts not yet in tracker.db as untracked.
// Returns the total number of contacts found in the WA store.
func SyncWAContacts(ctx context.Context, client *wa.Client, store *db.DB, accountID int64) (int, error) {
	contacts, err := client.GetAllContacts(ctx)
	if err != nil {
		return 0, err
	}
	n := 0
	for jid, info := range contacts {
		if jid.Server != types.DefaultUserServer {
			continue // skip groups and other server types
		}
		if jid.User == "" {
			continue
		}
		name := info.FullName
		if name == "" {
			name = info.PushName
		}
		if name == "" {
			name = info.FirstName
		}
		if err := store.UpsertContactUntracked(ctx, accountID, jid.String(), jid.User, name); err != nil {
			slog.Warn("contacts: upsert untracked failed", "jid", jid, "err", err)
			continue
		}
		n++
	}
	return n, nil
}

func (s *Server) handleDeleteContact(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	cid, err := parseCID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.db.DeleteContact(r.Context(), cid); err != nil {
		slog.Error("contacts: delete failed", "accountID", accountID, "id", cid, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Info("contacts: deleted", "accountID", accountID, "id", cid)
	w.WriteHeader(http.StatusNoContent)
}

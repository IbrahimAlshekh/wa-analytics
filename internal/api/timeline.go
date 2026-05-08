package api

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/stats"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

func (s *Server) handleTimeline(w http.ResponseWriter, r *http.Request) {
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
	since := int64(0)
	if v := r.URL.Query().Get("since"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			since = n
		}
	}
	contact, err := s.db.GetContact(r.Context(), accountID, cid)
	if err != nil {
		slog.Warn("timeline: contact not found", "accountID", accountID, "id", cid, "err", err)
		writeErr(w, http.StatusNotFound, err)
		return
	}
	entries, err := s.db.Timeline(r.Context(), cid, since)
	if err != nil {
		slog.Error("timeline: query failed", "accountID", accountID, "id", cid, "since", since, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if entries == nil {
		entries = []db.TimelineEntry{}
	}
	slog.Debug("timeline: fetched", "accountID", accountID, "contact_id", cid, "entries", len(entries), "since", since)
	writeJSON(w, http.StatusOK, map[string]any{
		"contact": contact,
		"entries": entries,
	})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
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
	// Verify contact belongs to account.
	if _, err := s.db.GetContact(r.Context(), accountID, cid); err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	rng := r.URL.Query().Get("range")
	if rng == "" {
		rng = "today"
	}
	out, err := stats.Compute(r.Context(), s.db, cid, rng, time.Now())
	if err != nil {
		slog.Warn("stats: compute failed", "accountID", accountID, "contact_id", cid, "range", rng, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	slog.Debug("stats: computed", "accountID", accountID, "contact_id", cid, "range", rng, "online_seconds", out.OnlineSecondsAll)
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleMessages(w http.ResponseWriter, r *http.Request) {
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
	// Verify contact belongs to account.
	if _, err := s.db.GetContact(r.Context(), accountID, cid); err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	before := int64(0)
	if v := r.URL.Query().Get("before"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			before = n
		}
	}
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	msgs, err := s.db.ListMessages(r.Context(), cid, before, limit)
	if err != nil {
		slog.Error("messages: list failed", "accountID", accountID, "contact_id", cid, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if msgs == nil {
		msgs = []db.Message{}
	}
	slog.Debug("messages: listed", "accountID", accountID, "contact_id", cid, "count", len(msgs))
	writeJSON(w, http.StatusOK, msgs)
}

func (s *Server) handleSendMessage(w http.ResponseWriter, r *http.Request) {
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

	contact, err := s.db.GetContact(r.Context(), accountID, cid)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}

	targetJID, err := types.ParseJID(contact.JID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	client := s.manager.GetByAccountID(accountID)
	if client == nil || !client.IsConnected() {
		writeErr(w, http.StatusServiceUnavailable, fmt.Errorf("account not connected"))
		return
	}

	var text string
	var mediaData []byte
	var mediaType string
	var fileName string

	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		text = r.FormValue("text")
		file, header, err := r.FormFile("file")
		if err == nil {
			defer file.Close()
			fileName = header.Filename
			mediaData, _ = io.ReadAll(file)
			mediaType = header.Header.Get("Content-Type")
		}
	} else {
		var body struct {
			Text string `json:"text"`
		}
		if err := readJSON(r, &body); err == nil {
			text = body.Text
		}
	}

	if text == "" && len(mediaData) == 0 {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("empty message"))
		return
	}

	var waMsg waE2E.Message
	var appMediaType string
	var finalMediaType string

	if len(mediaData) > 0 {
		// Determine whatsmeow media type
		mt := whatsmeow.MediaImage
		appMediaType = "image"
		finalMediaType = "image"
		if strings.HasPrefix(mediaType, "video/") {
			mt = whatsmeow.MediaVideo
			appMediaType = "video"
			finalMediaType = "video"
		} else if strings.HasPrefix(mediaType, "audio/") {
			mt = whatsmeow.MediaAudio
			appMediaType = "audio"
			finalMediaType = "audio"
		} else if !strings.HasPrefix(mediaType, "image/") {
			mt = whatsmeow.MediaDocument
			appMediaType = "document"
			finalMediaType = "document"
		}

		resp, err := client.UploadMedia(r.Context(), mediaData, mt)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, fmt.Errorf("upload failed: %w", err))
			return
		}

		switch mt {
		case whatsmeow.MediaImage:
			waMsg.ImageMessage = &waE2E.ImageMessage{
				Caption:       proto.String(text),
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String(mediaType),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			}
		case whatsmeow.MediaVideo:
			waMsg.VideoMessage = &waE2E.VideoMessage{
				Caption:       proto.String(text),
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String(mediaType),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			}
		case whatsmeow.MediaAudio:
			waMsg.AudioMessage = &waE2E.AudioMessage{
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String(mediaType),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			}
		case whatsmeow.MediaDocument:
			waMsg.DocumentMessage = &waE2E.DocumentMessage{
				Caption:       proto.String(text),
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String(mediaType),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
				FileName:      proto.String(fileName),
			}
		}
	} else {
		waMsg.Conversation = proto.String(text)
	}

	resp, err := client.SendMessage(r.Context(), targetJID, &waMsg)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, fmt.Errorf("send failed: %w", err))
		return
	}

	// Save the outgoing message to our local DB so it appears in the timeline.
	now := time.Now().Unix()
	var mediaPath string
	if len(mediaData) > 0 && s.cfg.MediaDir != "" {
		ext := filepath.Ext(fileName)
		if ext == "" {
			switch appMediaType {
			case "image":
				ext = ".jpg"
			case "video":
				ext = ".mp4"
			case "audio":
				ext = ".ogg"
			default:
				ext = ".bin"
			}
		}
		mediaPath = fmt.Sprintf("%d_%s%s", accountID, resp.ID, ext)
		_ = os.WriteFile(filepath.Join(s.cfg.MediaDir, mediaPath), mediaData, 0o644)
	}

	m := db.Message{
		AccountID:  accountID,
		ContactID:  &cid,
		ChatJID:    contact.JID,
		MessageID:  resp.ID,
		SenderJID:  client.OwnJID(),
		IsFromMe:   true,
		Timestamp:  now,
		Text:       text,
		MediaType:  finalMediaType,
		MediaPath:  mediaPath,
		ReceivedAt: now,
	}
	_, _ = s.db.InsertMessage(r.Context(), m)

	// Broadcast the outgoing message over WS so other dashboard instances see it.
	s.hub.Broadcast("message", map[string]any{
		"accountId": accountID,
		"contactId": cid,
		"chatJid":   contact.JID,
		"messageId": resp.ID,
		"from":      client.OwnJID(),
		"isFromMe":  true,
		"text":      text,
		"mediaType": finalMediaType,
		"mediaPath": mediaPath,
		"timestamp": now,
	})

	writeJSON(w, http.StatusOK, map[string]any{"id": resp.ID, "timestamp": now})
}

// wajid converts a phone number to a JID string.
func wajid(phone string) (string, error) {
	jid, err := wa.JIDFromPhone(phone)
	if err != nil {
		return "", err
	}
	return jid.String(), nil
}

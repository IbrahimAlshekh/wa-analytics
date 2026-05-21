package api

import (
	"archive/zip"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func (s *Server) handleBackup(w http.ResponseWriter, r *http.Request) {
	date := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("backup_%s.zip", date)

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Cache-Control", "no-store")

	zw := zip.NewWriter(w)

	// Core data files (skip silently if missing)
	for _, name := range []string{"tracker.db", "whatsmeow.db", ".env"} {
		src := filepath.Join(s.cfg.DataDir, name)
		if err := zipAddFile(zw, src, name); err != nil && !os.IsNotExist(err) {
			slog.Warn("backup: skip file", "name", name, "err", err)
		}
	}

	// Media directory — walk recursively
	mediaDir := filepath.Join(s.cfg.DataDir, "media")
	_ = filepath.WalkDir(mediaDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		rel, relErr := filepath.Rel(s.cfg.DataDir, path)
		if relErr != nil {
			return nil
		}
		// Use forward slashes for zip entry names (cross-platform standard)
		entryName := filepath.ToSlash(rel)
		if addErr := zipAddFile(zw, path, entryName); addErr != nil {
			slog.Warn("backup: skip media file", "path", path, "err", addErr)
		}
		return nil
	})

	if err := zw.Close(); err != nil {
		slog.Warn("backup: zip close error", "err", err)
	}
}

func zipAddFile(zw *zip.Writer, srcPath, entryName string) error {
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()

	w, err := zw.Create(entryName)
	if err != nil {
		return err
	}

	_, err = io.Copy(w, f)
	return err
}

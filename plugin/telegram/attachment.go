package telegram

import (
	"log/slog"
	"path/filepath"
)

type Attachment struct {
	FileName string
	MimeType string
	FileSize int64
	Data     []byte
}

var mimeTypes = map[string]string{
	".jpg": "image/jpeg",
	".png": "image/png",
	".mp4": "video/mp4", // for video note
	".oga": "audio/ogg", // for voice
}

func (b Attachment) GetMimeType() string {
	if b.MimeType != "" {
		return b.MimeType
	}

	mime, ok := mimeTypes[filepath.Ext(b.FileName)]
	if !ok {
		slog.Warn("Unknown file extension", slog.String("file", b.FileName))
		return "application/octet-stream"
	}

	return mime
}

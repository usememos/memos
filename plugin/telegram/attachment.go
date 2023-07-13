package telegram

import "path"

type Attachment struct {
	FileName string
	MimeType string
	FileSize int64
	Data     []byte
}

var mimeTypes = map[string]string{
	".jpg": "image/jpeg",
	".png": "image/png",
	".mp4": "video/mp4",
}

func (b Attachment) GetMimeType() string {
	if b.MimeType != "" {
		return b.MimeType
	}

	mime, ok := mimeTypes[path.Ext(b.FileName)]
	if !ok {
		// Handle unknown file extension
		// This could be logging an error, returning a default mime type, etc.
		return "application/octet-stream"
	}

	return mime
}

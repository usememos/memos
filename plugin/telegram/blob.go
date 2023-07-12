package telegram

import "path"

type Blob struct {
	FileName string
	MimeType string
	FileSize int64
	Data     []byte
}

func (b Blob) GetMimeType() string {
	if b.MimeType != "" {
		return b.MimeType
	}

	mime := "application/octet-stream"
	switch path.Ext(b.FileName) {
	case ".jpg":
		mime = "image/jpeg"
	case ".png":
		mime = "image/png"
	case ".mp4":
		mime = "video/mp4"
	}

	return mime
}

package telegram

// Document represents a general file.
type Document struct {
	// FileID is an identifier for this file, which can be used to download or
	// reuse the file
	FileID string `json:"file_id"`
	// FileUniqueID is the unique identifier for this file, which is supposed to
	// be the same over time and for different bots. Can't be used to download
	// or reuse the file.
	FileUniqueID string `json:"file_unique_id"`
	// Thumbnail document thumbnail as defined by sender
	Thumbnail *PhotoSize `json:"thumb"`
	// FileName original filename as defined by sender
	FileName string `json:"file_name"`
	// MimeType  of the file as defined by sender
	MimeType string `json:"mime_type"`
	// FileSize file size
	FileSize int `json:"file_size"`
}

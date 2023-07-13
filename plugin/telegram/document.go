package telegram

// Document represents a general file.
type Document struct {
	FileID       string     `json:"file_id"`        // FileID is an identifier for this file, which can be used to download or reuse the file
	FileUniqueID string     `json:"file_unique_id"` // FileUniqueID is the unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file.
	Thumbnail    *PhotoSize `json:"thumb"`          // Thumbnail document thumbnail as defined by sender
	FileName     string     `json:"file_name"`      // FileName original filename as defined by sender
	MimeType     string     `json:"mime_type"`      // MimeType  of the file as defined by sender
	FileSize     int        `json:"file_size"`
}

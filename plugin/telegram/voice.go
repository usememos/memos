package telegram

// Voice represents a voice note.
type Voice struct {
	FileID       string `json:"file_id"`        // FileID identifier for this file, which can be used to download or reuse the file
	FileUniqueID string `json:"file_unique_id"` // FileUniqueID is the unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file.
	Duration     int    `json:"duration"`       // Duration of the audio in seconds as defined by sender
	MimeType     string `json:"mime_type"`      // MimeType of the file as defined by sender
	FileSize     int    `json:"file_size"`
}

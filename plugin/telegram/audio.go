package telegram

// Audio represents an audio file to be treated as music by the Telegram clients.
type Audio struct {
	FileID       string     `json:"file_id"`        // FileID is an identifier for this file, which can be used to download or reuse the file
	FileUniqueID string     `json:"file_unique_id"` // FileUniqueID is the unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file.
	Duration     int        `json:"duration"`       // Duration of the audio in seconds as defined by sender
	Performer    string     `json:"performer"`      // Performer of the audio as defined by sender or by audio tags
	Title        string     `json:"title"`          // Title of the audio as defined by sender or by audio tags
	FileName     string     `json:"file_name"`      // FileName is the original filename as defined by sender
	MimeType     string     `json:"mime_type"`      // MimeType of the file as defined by sender
	FileSize     int        `json:"file_size"`      // FileSize file size
	Thumbnail    *PhotoSize `json:"thumb"`          // Thumbnail is the album cover to which the music file belongs
}

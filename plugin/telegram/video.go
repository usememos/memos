package telegram

// Video represents a video file.
type Video struct {
	FileID       string     `json:"file_id"`        // FileID identifier for this file, which can be used to download or reuse
	FileUniqueID string     `json:"file_unique_id"` // FileUniqueID is the unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file.
	Width        int        `json:"width"`          // Width video width as defined by sender
	Height       int        `json:"height"`         // Height video height as defined by sender
	Duration     int        `json:"duration"`       // Duration of the video in seconds as defined by sender
	Thumbnail    *PhotoSize `json:"thumb"`          // Thumbnail video thumbnail
	FileName     string     `json:"file_name"`      // FileName is the original filename as defined by sender
	MimeType     string     `json:"mime_type"`      // MimeType of a file as defined by sender
	FileSize     int        `json:"file_size"`
}

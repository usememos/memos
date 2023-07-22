package telegram

// Animation represents an animation file.
type Animation struct {
	FileID       string     `json:"file_id"`        // FileID is the identifier for this file, which can be used to download or reuse the file
	FileUniqueID string     `json:"file_unique_id"` // FileUniqueID is the unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file.
	Width        int        `json:"width"`          // Width video width as defined by sender
	Height       int        `json:"height"`         // Height video height as defined by sender
	Duration     int        `json:"duration"`       // Duration of the video in seconds as defined by sender
	Thumbnail    *PhotoSize `json:"thumb"`          // Thumbnail animation thumbnail as defined by sender
	FileName     string     `json:"file_name"`      // FileName original animation filename as defined by sender
	MimeType     string     `json:"mime_type"`      // MimeType of the file as defined by sender
	FileSize     int        `json:"file_size"`
}

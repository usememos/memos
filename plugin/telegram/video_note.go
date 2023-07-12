package telegram

// VideoNote object represents a video message.
type VideoNote struct {
	FileID       string     `json:"file_id"`         // FileID identifier for this file, which can be used to download or reuse the file
	FileUniqueID string     `json:"file_unique_id"`  // FileUniqueID is the unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file.
	Length       int        `json:"length"`          // Length video width and height (diameter of the video message) as defined by sender
	Duration     int        `json:"duration"`        // Duration of the video in seconds as defined by sender
	Thumbnail    *PhotoSize `json:"thumb,omitempty"` // Thumbnail video thumbnail
	FileSize     int        `json:"file_size"`
}

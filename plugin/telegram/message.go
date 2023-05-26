package telegram

type Message struct {
	MessageID    int         `json:"message_id"`
	From         User        `json:"from"`
	Date         int         `json:"date"`
	Text         *string     `json:"text"`
	Chat         *Chat       `json:"chat"`
	MediaGroupID *string     `json:"media_group_id"`
	Photo        []PhotoSize `json:"photo"`
	Caption      *string     `json:"caption"`
}

func (m Message) GetMaxPhotoFileID() string {
	var fileSize int64
	var photoSize PhotoSize
	for _, p := range m.Photo {
		if p.FileSize > fileSize {
			photoSize = p
		}
	}

	return photoSize.FileID
}

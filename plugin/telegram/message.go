package telegram

import "fmt"

type Message struct {
	// MessageID is a unique message identifier inside this chat
	MessageID int `json:"message_id"`
	// From is a sender, empty for messages sent to channels;
	From User `json:"from"`
	// Date of the message was sent in Unix time
	Date int `json:"date"`
	// Text is for text messages, the actual UTF-8 text of the message, 0-4096 characters;
	Text *string `json:"text"`
	// Chat is the conversation the message belongs to
	Chat *Chat `json:"chat"`
	// ForwardFromChat for messages forwarded from channels,
	// information about the original channel;
	ForwardFromChat *Chat `json:"forward_from_chat"`
	// ForwardFromMessageID for messages forwarded from channels,
	// identifier of the original message in the channel;
	ForwardFromMessageID int `json:"forward_from_message_id,omitempty"`
	// MediaGroupID is the unique identifier of a media message group this message belongs to;
	MediaGroupID *string `json:"media_group_id"`
	// Photo message is a photo, available sizes of the photo;
	Photo []PhotoSize `json:"photo"`
	// Caption for the animation, audio, document, photo, video or voice, 0-1024 characters;
	Caption *string `json:"caption"`
	// Entities are for text messages, special entities like usernames,
	// URLs, bot commands, etc. that appear in the text;
	Entities []MessageEntity `json:"entities"`
	// CaptionEntities;
	CaptionEntities []MessageEntity `json:"caption_entities"`
	// Document message is a general file, information about the file;
	Document *Document `json:"document"`
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

func (m Message) IsForwardMessage() bool {
	return m.ForwardFromMessageID > 0
}

func (m Message) GetMessageLink() string {
	if !m.IsForwardMessage() {
		return ""
	}

	if m.ForwardFromChat.IsChannel() {
		return fmt.Sprintf("https://t.me/%s/%d", m.ForwardFromChat.UserName, m.ForwardFromMessageID)
	}

	return ""
}

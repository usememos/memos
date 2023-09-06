package telegram

import "fmt"

type Message struct {
	MessageID            int64           `json:"message_id"`              // MessageID is a unique message identifier inside this chat
	From                 User            `json:"from"`                    // From is a sender, empty for messages sent to channels;
	Date                 int             `json:"date"`                    // Date of the message was sent in Unix time
	Text                 *string         `json:"text"`                    // Text is for text messages, the actual UTF-8 text of the message, 0-4096 characters;
	Chat                 *Chat           `json:"chat"`                    // Chat is the conversation the message belongs to
	ForwardFromChat      *Chat           `json:"forward_from_chat"`       // ForwardFromChat for messages forwarded from channels, information about the original channel;
	ForwardFromMessageID int64           `json:"forward_from_message_id"` // ForwardFromMessageID for messages forwarded from channels, identifier of the original message in the channel;
	MediaGroupID         *string         `json:"media_group_id"`          // MediaGroupID is the unique identifier of a media message group this message belongs to;
	Photo                []PhotoSize     `json:"photo"`                   // Photo message is a photo, available sizes of the photo;
	Caption              *string         `json:"caption"`                 // Caption for the animation, audio, document, photo, video or voice, 0-1024 characters;
	Entities             []MessageEntity `json:"entities"`                // Entities are for text messages, special entities like usernames, URLs, bot commands, etc. that appear in the text;
	CaptionEntities      []MessageEntity `json:"caption_entities"`        // CaptionEntities are for messages with a caption, special entities like usernames, URLs, bot commands, etc. that appear in the caption;
	Document             *Document       `json:"document"`                // Document message is a general file, information about the file;
	Video                *Video          `json:"video"`                   // Video message is a video, information about the video;
	VideoNote            *VideoNote      `json:"video_note"`              // VideoNote message is a video note, information about the video message;
	Voice                *Voice          `json:"voice"`                   // Voice message is a voice message, information about the file;
	Audio                *Audio          `json:"audio"`                   // Audio message is an audio file, information about the file;
	Animation            *Animation      `json:"animation"`               // Animation message is an animation, information about the animation. For backward compatibility, when this field is set, the document field will also be set;
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

func (m Message) GetMessageLink() string {
	if m.ForwardFromChat != nil && m.ForwardFromChat.Type == Channel {
		return fmt.Sprintf("https://t.me/%s/%d", m.ForwardFromChat.UserName, m.ForwardFromMessageID)
	}

	return ""
}

func (m Message) IsSupported() bool {
	return m.Text != nil || m.Caption != nil || m.Document != nil || m.Photo != nil || m.Video != nil ||
		m.Voice != nil || m.VideoNote != nil || m.Audio != nil || m.Animation != nil
}

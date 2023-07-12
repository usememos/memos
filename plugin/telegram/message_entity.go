package telegram

type MessageEntityType string

const (
	Mention       MessageEntityType = "mention"       //  “mention” (@username)
	Hashtag       MessageEntityType = "hashtag"       //  “hashtag” (#hashtag)
	CashTag       MessageEntityType = "cashtag"       //  “cashtag” ($USD)
	BotCommand    MessageEntityType = "bot_command"   //  “bot_command” (/start@jobs_bot)
	URL           MessageEntityType = "url"           //  “url” (https://telegram.org)
	Email         MessageEntityType = "email"         //  “email” (do-not-reply@telegram.org)
	PhoneNumber   MessageEntityType = "phone_number"  //  “phone_number” (+1-212-555-0123)
	Bold          MessageEntityType = "bold"          //  “bold” (bold text)
	Italic        MessageEntityType = "italic"        //  “italic” (italic text)
	Underline     MessageEntityType = "underline"     //  “underline” (underlined text)
	Strikethrough MessageEntityType = "strikethrough" //  “strikethrough” (strikethrough text)
	Code          MessageEntityType = "code"          //  “code” (monowidth string)
	Pre           MessageEntityType = "pre"           //  “pre” (monowidth block)
	TextLink      MessageEntityType = "text_link"     //  “text_link” (for clickable text URLs)
	TextMention   MessageEntityType = "text_mention"  //  “text_mention” (for users without usernames)
)

// MessageEntity represents one special entity in a text message.
type MessageEntity struct {
	Type     MessageEntityType `json:"type"`   // Type of the entity.
	Offset   int               `json:"offset"` // Offset in UTF-16 code units to the start of the entity
	Length   int               `json:"length"`
	URL      string            `json:"url"`      // URL for “text_link” only, url that will be opened after user taps on the text
	User     *User             `json:"user"`     // User for “text_mention” only, the mentioned user
	Language string            `json:"language"` // Language for “pre” only, the programming language of the entity text
}

package telegram

type MessageEntityType string

const (
	Mention       = "mention"       //  “mention” (@username)
	Hashtag       = "hashtag"       //  “hashtag” (#hashtag)
	CashTag       = "cashtag"       //  “cashtag” ($USD)
	BotCommand    = "bot_command"   //  “bot_command” (/start@jobs_bot)
	URL           = "url"           //  “url” (https://telegram.org)
	Email         = "email"         //  “email” (do-not-reply@telegram.org)
	PhoneNumber   = "phone_number"  //  “phone_number” (+1-212-555-0123)
	Bold          = "bold"          //  “bold” (bold text)
	Italic        = "italic"        //  “italic” (italic text)
	Underline     = "underline"     //  “underline” (underlined text)
	Strikethrough = "strikethrough" //  “strikethrough” (strikethrough text)
	Code          = "code"          //  “code” (monowidth string)
	Pre           = "pre"           //  “pre” (monowidth block)
	TextLink      = "text_link"     //  “text_link” (for clickable text URLs)
	TextMention   = "text_mention"  //  “text_mention” (for users without usernames)
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

package telegram

// CallbackQuery represents an incoming callback query from a callback button in
// an inline keyboard (PUBLIC, PROTECTED, PRIVATE).
type CallbackQuery struct {
	ID              string   `json:"id"`
	From            User     `json:"from"`
	Message         *Message `json:"message"`
	InlineMessageID string   `json:"inline_message_id"`
	ChatInstance    string   `json:"chat_instance"`
	Data            string   `json:"data"`
	GameShortName   string   `json:"game_short_name"`
}

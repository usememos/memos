package telegram

type Update struct {
	UpdateID      int            `json:"update_id"`
	Message       *Message       `json:"message"`
	ChannelPost   *Message       `json:"channel_post"`
	CallbackQuery *CallbackQuery `json:"callback_query"`
}

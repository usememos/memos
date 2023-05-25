package telegram

type Message struct {
	MessageID int    `json:"message_id"`
	From      User   `json:"from"`
	Date      int    `json:"date"`
	Text      string `json:"text"`
	Chat      Chat   `json:"chat"`
}

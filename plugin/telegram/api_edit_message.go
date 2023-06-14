package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
)

// EditMessage make an editMessageText api request.
func (b *Bot) EditMessage(ctx context.Context, chatID, messageID int, text string, inlineKeyboards [][]InlineKeyboardButton) (*Message, error) {
	formData := url.Values{
		"message_id": {strconv.Itoa(messageID)},
		"chat_id":    {strconv.Itoa(chatID)},
		"text":       {text},
	}

	if len(inlineKeyboards) > 0 {
		var markup struct {
			InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
		}
		markup.InlineKeyboard = inlineKeyboards
		data, err := json.Marshal(markup)
		if err != nil {
			return nil, fmt.Errorf("fail to encode inlineKeyboard: %s", err)
		}
		formData.Set("reply_markup", string(data))
	}

	var result Message
	err := b.postForm(ctx, "/editMessageText", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

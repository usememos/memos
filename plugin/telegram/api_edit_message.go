package telegram

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"

	"github.com/pkg/errors"
)

// EditMessage make an editMessageText api request.
func (b *Bot) EditMessage(ctx context.Context, chatID, messageID int64, text string, inlineKeyboards [][]InlineKeyboardButton) (*Message, error) {
	formData := url.Values{
		"message_id": {strconv.FormatInt(messageID, 10)},
		"chat_id":    {strconv.FormatInt(chatID, 10)},
		"text":       {text},
	}

	if len(inlineKeyboards) > 0 {
		var markup struct {
			InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
		}
		markup.InlineKeyboard = inlineKeyboards
		data, err := json.Marshal(markup)
		if err != nil {
			return nil, errors.Wrap(err, "fail to encode inlineKeyboard")
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

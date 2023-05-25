package telegram

import (
	"context"
	"net/url"
	"strconv"
)

// EditMessage make an editMessageText api request
func (r *Robot) EditMessage(ctx context.Context, chatId, messageId int, text string) (*Message, error) {
	formData := url.Values{
		"message_id": {strconv.Itoa(messageId)},
		"chat_id":    {strconv.Itoa(chatId)},
		"text":       {text},
	}

	var result Message
	err := r.postForm(ctx, "/editMessageText", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

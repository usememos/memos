package telegram

import (
	"context"
	"net/url"
	"strconv"
)

// SendReplyMessage make a sendMessage api request.
func (r *Robot) SendReplyMessage(ctx context.Context, chatID, replyID int, text string) (*Message, error) {
	formData := url.Values{
		"reply_to_message_id": {strconv.Itoa(replyID)},
		"chat_id":             {strconv.Itoa(chatID)},
		"text":                {text},
	}

	var result Message
	err := r.postForm(ctx, "/sendMessage", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

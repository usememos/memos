package telegram

import (
	"context"
	"net/url"
	"strconv"
)

// SendReplyMessage make a sendMessage api request.
func (b *Bot) SendReplyMessage(ctx context.Context, chatID, replyID int64, text string) (*Message, error) {
	formData := url.Values{
		"chat_id": {strconv.FormatInt(chatID, 10)},
		"text":    {text},
	}

	if replyID > 0 {
		formData.Set("reply_to_message_id", strconv.FormatInt(replyID, 10))
	}

	var result Message
	err := b.postForm(ctx, "/sendMessage", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// SendMessage make a sendMessage api request.
func (b *Bot) SendMessage(ctx context.Context, chatID int64, text string) (*Message, error) {
	return b.SendReplyMessage(ctx, chatID, 0, text)
}

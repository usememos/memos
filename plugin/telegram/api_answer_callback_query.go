package telegram

import (
	"context"
	"net/url"
)

// AnswerCallbackQuery make an answerCallbackQuery api request.
func (b *Bot) AnswerCallbackQuery(ctx context.Context, callbackQueryID, text string) error {
	formData := url.Values{
		"callback_query_id": {callbackQueryID},
		"text":              {text},
	}

	err := b.postForm(ctx, "/answerCallbackQuery", formData, nil)
	if err != nil {
		return err
	}

	return nil
}

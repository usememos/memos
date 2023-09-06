package telegram

import (
	"context"
	"net/url"
	"strconv"
)

// GetUpdates make a getUpdates api request.
func (b *Bot) GetUpdates(ctx context.Context, offset int64) ([]Update, error) {
	formData := url.Values{
		"timeout": {"60"},
		"offset":  {strconv.FormatInt(offset, 10)},
	}

	var result []Update
	err := b.postForm(ctx, "/getUpdates", formData, &result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

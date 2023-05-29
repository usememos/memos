package telegram

import (
	"context"
	"net/url"
)

// GetFile get download info of File by fileID from Telegram.
func (b *Bot) GetFile(ctx context.Context, fileID string) (*File, error) {
	formData := url.Values{
		"file_id": {fileID},
	}

	var result File
	err := b.postForm(ctx, "/getFile", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

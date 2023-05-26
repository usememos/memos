package telegram

import (
	"context"
	"net/url"
)

// GetFile get download info of File by fileID from Telegram.
func (r *Robot) GetFile(ctx context.Context, fileID string) (*File, error) {
	formData := url.Values{
		"file_id": {fileID},
	}

	var result File
	err := r.postForm(ctx, "/getFile", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

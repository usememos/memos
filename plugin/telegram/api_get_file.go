package telegram

import (
	"context"
	"net/url"
)

// GetFile get download info of File by FileId from Telegram
func (r *Robot) GetFile(ctx context.Context, fileId string) (*File, error) {
	formData := url.Values{
		"file_id": {fileId},
	}

	var result File
	err := r.postForm(ctx, "/getFile", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

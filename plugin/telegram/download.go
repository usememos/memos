package telegram

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func (b *Bot) downloadAttachment(ctx context.Context, message *Message) (*Attachment, error) {
	var fileID, fileName, mimeType string
	switch {
	case len(message.Photo) > 0:
		fileID = message.GetMaxPhotoFileID()
	case message.Animation != nil:
		fileID = message.Animation.FileID
		fileName = message.Animation.FileName
		mimeType = message.Animation.MimeType
	case message.Audio != nil:
		fileID = message.Audio.FileID
		fileName = message.Audio.FileName
		mimeType = message.Audio.MimeType
	case message.Document != nil:
		fileID = message.Document.FileID
		fileName = message.Document.FileName
		mimeType = message.Document.MimeType
	case message.Video != nil:
		fileID = message.Video.FileID
		fileName = message.Video.FileName
		mimeType = message.Video.MimeType
	case message.VideoNote != nil:
		fileID = message.VideoNote.FileID
	case message.Voice != nil:
		fileID = message.Voice.FileID
		mimeType = message.Voice.MimeType
	}

	if fileID == "" {
		return nil, nil
	}

	attachment, err := b.downloadFileID(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if fileName != "" {
		attachment.FileName = fileName
	}

	if mimeType != "" {
		attachment.MimeType = mimeType
	}

	return attachment, nil
}

// downloadFileId download file with fileID, return Blob struct.
func (b *Bot) downloadFileID(ctx context.Context, fileID string) (*Attachment, error) {
	file, err := b.GetFile(ctx, fileID)
	if err != nil {
		return nil, err
	}
	data, err := b.downloadFilepath(ctx, file.FilePath)
	if err != nil {
		return nil, err
	}

	blob := &Attachment{
		FileName: file.FilePath,
		Data:     data,
		FileSize: file.FileSize,
	}

	return blob, nil
}

// downloadFilepath download file with filepath, you can get filepath by calling GetFile.
func (b *Bot) downloadFilepath(ctx context.Context, filePath string) ([]byte, error) {
	apiURL, err := b.apiURL(ctx)
	if err != nil {
		return nil, err
	}

	idx := strings.LastIndex(apiURL, "/bot")
	if idx < 0 {
		return nil, ErrInvalidToken
	}

	fileURL := apiURL[:idx] + "/file" + apiURL[idx:]

	resp, err := http.Get(fileURL + "/" + filePath)
	if err != nil {
		return nil, fmt.Errorf("fail to http.Get: %s", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("fail to io.ReadAll: %s", err)
	}

	return body, nil
}

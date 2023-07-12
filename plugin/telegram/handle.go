package telegram

import (
	"context"
	"fmt"
)

const (
	failDownload = "fail to downloadFileID"
)

// handleSingleMessages handle single messages not belongs to group.
func (b *Bot) handleSingleMessages(ctx context.Context, messages []Message) error {
	for _, message := range messages {
		var blobs []Blob

		// download blob if provided
		if len(message.Photo) > 0 {
			blob, err := b.downloadFileID(ctx, message.GetMaxPhotoFileID())
			if err != nil {
				return err
			}

			blobs = append(blobs, *blob)
		}

		if message.Animation != nil {
			blob, err := b.downloadFileID(ctx, message.Animation.FileID)
			if err != nil {
				return err
			}

			blob.FileName = message.Animation.FileName
			blob.MimeType = message.Animation.MimeType

			blobs = append(blobs, *blob)
		}

		if message.Audio != nil {
			blob, err := b.downloadFileID(ctx, message.Audio.FileID)
			if err != nil {
				return err
			}

			blob.FileName = message.Audio.FileName
			blob.MimeType = message.Audio.MimeType

			blobs = append(blobs, *blob)
		}

		if message.Document != nil {
			blob, err := b.downloadFileID(ctx, message.Document.FileID)
			if err != nil {
				return err
			}

			blob.FileName = message.Document.FileName
			blob.MimeType = message.Document.MimeType

			blobs = append(blobs, *blob)
		}

		if message.Video != nil {
			blob, err := b.downloadFileID(ctx, message.Video.FileID)
			if err != nil {
				return err
			}

			blob.FileName = message.Video.FileName
			blob.MimeType = message.Video.MimeType

			blobs = append(blobs, *blob)
		}

		if message.VideoNote != nil {
			blob, err := b.downloadFileID(ctx, message.VideoNote.FileID)
			if err != nil {
				return err
			}

			blobs = append(blobs, *blob)
		}

		if message.Voice != nil {
			blob, err := b.downloadFileID(ctx, message.Voice.FileID)
			if err != nil {
				return err
			}

			blob.MimeType = message.Voice.MimeType

			blobs = append(blobs, *blob)
		}

		err := b.handler.MessageHandle(ctx, b, message, blobs)
		if err != nil {
			return err
		}
	}

	return nil
}

// handleGroupMessages handle a message belongs to group.
func (b *Bot) handleGroupMessages(ctx context.Context, groupMessages []Message) error {
	captions := make(map[string]string, len(groupMessages))
	messages := make(map[string]Message, len(groupMessages))
	blobs := make(map[string][]Blob, len(groupMessages))

	// Group all captions, blobs and messages
	for _, message := range groupMessages {
		groupID := *message.MediaGroupID

		messages[groupID] = message

		if message.Caption != nil {
			captions[groupID] += *message.Caption
		}

		if len(message.Photo) > 0 {
			blob, err := b.downloadFileID(ctx, message.GetMaxPhotoFileID())
			if err != nil {
				return fmt.Errorf(failDownload)
			}
			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}

		if message.Animation != nil {
			blob, err := b.downloadFileID(ctx, message.Animation.FileID)
			if err != nil {
				return fmt.Errorf(failDownload)
			}

			blob.FileName = message.Animation.FileName
			blob.MimeType = message.Animation.MimeType

			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}

		if message.Audio != nil {
			blob, err := b.downloadFileID(ctx, message.Audio.FileID)
			if err != nil {
				return fmt.Errorf(failDownload)
			}

			blob.FileName = message.Audio.FileName
			blob.MimeType = message.Audio.MimeType

			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}

		if message.Document != nil {
			blob, err := b.downloadFileID(ctx, message.Document.FileID)
			if err != nil {
				return fmt.Errorf(failDownload)
			}

			blob.FileName = message.Document.FileName
			blob.MimeType = message.Document.MimeType

			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}

		if message.Video != nil {
			blob, err := b.downloadFileID(ctx, message.Video.FileID)
			if err != nil {
				return fmt.Errorf(failDownload)
			}

			blob.FileName = message.Video.FileName
			blob.MimeType = message.Video.MimeType

			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}

		if message.VideoNote != nil {
			blob, err := b.downloadFileID(ctx, message.VideoNote.FileID)
			if err != nil {
				return fmt.Errorf(failDownload)
			}

			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}

		if message.Voice != nil {
			blob, err := b.downloadFileID(ctx, message.Voice.FileID)
			if err != nil {
				return fmt.Errorf(failDownload)
			}

			blob.MimeType = message.Voice.MimeType

			if _, found := blobs[groupID]; !found {
				blobs[groupID] = []Blob{}
			}

			blobs[groupID] = append(blobs[groupID], *blob)
		}
	}

	// Handle each group message
	for groupID, message := range messages {
		// replace Caption with all Caption in the group
		caption := captions[groupID]
		message.Caption = &caption
		err := b.handler.MessageHandle(ctx, b, message, blobs[groupID])
		if err != nil {
			return err
		}
	}

	return nil
}

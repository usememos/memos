package telegram

import (
	"context"
	"fmt"
)

// handleSingleMessages handle single messages not belongs to group.
func (b *Bot) handleSingleMessages(ctx context.Context, messages []Message) error {
	for _, message := range messages {
		var blobs map[string][]byte

		// download blob if provided
		if len(message.Photo) > 0 {
			filepath, blob, err := b.downloadFileID(ctx, message.GetMaxPhotoFileID())
			if err != nil {
				return err
			}
			blobs = map[string][]byte{filepath: blob}
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
	blobs := make(map[string]map[string][]byte, len(groupMessages))

	// Group all captions, blobs and messages
	for _, message := range groupMessages {
		groupID := *message.MediaGroupID

		messages[groupID] = message

		if message.Caption != nil {
			captions[groupID] += *message.Caption
		}

		filepath, blob, err := b.downloadFileID(ctx, message.GetMaxPhotoFileID())
		if err != nil {
			return fmt.Errorf("fail to downloadFileID")
		}
		if _, found := blobs[groupID]; !found {
			blobs[groupID] = make(map[string][]byte)
		}
		blobs[groupID][filepath] = blob
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

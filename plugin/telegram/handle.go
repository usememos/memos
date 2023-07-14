package telegram

import (
	"context"
)

// handleSingleMessages handle single messages not belongs to group.
func (b *Bot) handleSingleMessages(ctx context.Context, messages []Message) error {
	var attachments []Attachment

	for _, message := range messages {
		attachment, err := b.downloadAttachment(ctx, &message)
		if err != nil {
			return err
		}

		if attachment != nil {
			attachments = append(attachments, *attachment)
		}

		err = b.handler.MessageHandle(ctx, b, message, attachments)
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
	attachments := make(map[string][]Attachment, len(groupMessages))

	// Group all captions, blobs and messages
	for _, message := range groupMessages {
		groupID := *message.MediaGroupID

		messages[groupID] = message

		if message.Caption != nil {
			captions[groupID] += *message.Caption
		}

		attachment, err := b.downloadAttachment(ctx, &message)
		if err != nil {
			return err
		}

		if attachment != nil {
			attachments[groupID] = append(attachments[groupID], *attachment)
		}
	}

	// Handle each group message
	for groupID, message := range messages {
		// replace Caption with all Caption in the group
		caption := captions[groupID]
		message.Caption = &caption
		err := b.handler.MessageHandle(ctx, b, message, attachments[groupID])
		if err != nil {
			return err
		}
	}

	return nil
}

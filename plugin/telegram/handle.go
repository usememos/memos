package telegram

import (
	"context"
	"fmt"

	"github.com/usememos/memos/common/log"
	"go.uber.org/zap"
)

// notice message send to telegram.
const (
	workingMessage = "Working on send your memo..."
	successMessage = "Success"
)

// handleSingleMessage handle a message not belongs to group.
func (r *Robot) handleSingleMessage(ctx context.Context, message Message) error {
	reply, err := r.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, workingMessage)
	if err != nil {
		return fmt.Errorf("fail to SendReplyMessage: %s", err)
	}

	var blobs map[string][]byte

	// download blob if need
	if len(message.Photo) > 0 {
		filepath, blob, err := r.downloadFileID(ctx, message.GetMaxPhotoFileID())
		if err != nil {
			log.Error("fail to downloadFileID", zap.Error(err))
			_, err = r.EditMessage(ctx, message.Chat.ID, reply.MessageID, err.Error())
			if err != nil {
				return fmt.Errorf("fail to EditMessage: %s", err)
			}
			return fmt.Errorf("fail to downloadFileID: %s", err)
		}
		blobs = map[string][]byte{filepath: blob}
	}

	err = r.handler.MessageHandle(ctx, message, blobs)
	if err != nil {
		if _, err := r.EditMessage(ctx, message.Chat.ID, reply.MessageID, err.Error()); err != nil {
			return fmt.Errorf("fail to EditMessage: %s", err)
		}
		return fmt.Errorf("fail to MessageHandle: %s", err)
	}

	if _, err := r.EditMessage(ctx, message.Chat.ID, reply.MessageID, successMessage); err != nil {
		return fmt.Errorf("fail to EditMessage: %s", err)
	}

	return nil
}

// handleGroupMessages handle a message belongs to group.
func (r *Robot) handleGroupMessages(ctx context.Context, groupMessages []Message) error {
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

		filepath, blob, err := r.downloadFileID(ctx, message.GetMaxPhotoFileID())
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
		reply, err := r.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, workingMessage)
		if err != nil {
			return fmt.Errorf("fail to SendReplyMessage: %s", err)
		}

		// replace Caption with all Caption in the group
		caption := captions[groupID]
		message.Caption = &caption
		if err := r.handler.MessageHandle(ctx, message, blobs[groupID]); err != nil {
			if _, err = r.EditMessage(ctx, message.Chat.ID, reply.MessageID, err.Error()); err != nil {
				return fmt.Errorf("fail to EditMessage: %s", err)
			}
			return fmt.Errorf("fail to MessageHandle: %s", err)
		}

		if _, err := r.EditMessage(ctx, message.Chat.ID, reply.MessageID, successMessage); err != nil {
			return fmt.Errorf("fail to EditMessage: %s", err)
		}
	}

	return nil
}

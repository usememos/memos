package telegram

import (
	"context"
	"fmt"

	"github.com/usememos/memos/common/log"
	"go.uber.org/zap"
)

// notice message send to telegram
const (
	workingMessage = "Working on send your memo..."
	successMessage = "Success"
)

// handleSingleMessage handle a message not belongs to group
func (r *Robot) handleSingleMessage(ctx context.Context, message Message) error {
	reply, err := r.SendReplyMessage(ctx, message.Chat.Id, message.MessageId, workingMessage)
	if err != nil {
		return fmt.Errorf("fail to SendReplyMessage: %s", err)
	}

	var blobs map[string][]byte

	// download blob if need
	if len(message.Photo) > 0 {
		filepath, blob, err := r.downloadFileId(ctx, message.GetMaxPhotoFileId())
		if err != nil {
			log.Error("fail to downloadFileId", zap.Error(err))
			_, err = r.EditMessage(ctx, message.Chat.Id, reply.MessageId, err.Error())
			if err != nil {
				return fmt.Errorf("fail to EditMessage: %s", err)
			}
			return fmt.Errorf("fail to downloadFileId: %s", err)
		}
		blobs = map[string][]byte{filepath: blob}
	}

	err = r.handler.MessageHandle(ctx, message, blobs)
	if err != nil {
		if _, err := r.EditMessage(ctx, message.Chat.Id, reply.MessageId, err.Error()); err != nil {
			return fmt.Errorf("fail to EditMessage: %s", err)
		}
		return fmt.Errorf("fail to MessageHandle: %s", err)
	}

	if _, err := r.EditMessage(ctx, message.Chat.Id, reply.MessageId, successMessage); err != nil {
		return fmt.Errorf("fail to EditMessage: %s", err)
	}

	return nil
}

// handleGroupMessages handle a message belongs to group
func (r *Robot) handleGroupMessages(ctx context.Context, groupMessages []Message) error {
	captions := make(map[string]string, len(groupMessages))
	messages := make(map[string]Message, len(groupMessages))
	blobs := make(map[string]map[string][]byte, len(groupMessages))

	// Group all captions, blobs and messages
	for _, message := range groupMessages {
		groupId := *message.MediaGroupId

		messages[groupId] = message

		if message.Caption != nil {
			captions[groupId] += *message.Caption
		}

		filepath, blob, err := r.downloadFileId(ctx, message.GetMaxPhotoFileId())
		if err != nil {
			return fmt.Errorf("fail to downloadFileId")
		}
		if _, found := blobs[groupId]; !found {
			blobs[groupId] = make(map[string][]byte)
		}
		blobs[groupId][filepath] = blob
	}

	// Handle each group message
	for groupId, message := range messages {
		reply, err := r.SendReplyMessage(ctx, message.Chat.Id, message.MessageId, workingMessage)
		if err != nil {
			return fmt.Errorf("fail to SendReplyMessage: %s", err)
		}

		// replace Caption with all Caption in the group
		caption := captions[groupId]
		message.Caption = &caption
		if err := r.handler.MessageHandle(ctx, message, blobs[groupId]); err != nil {
			if _, err = r.EditMessage(ctx, message.Chat.Id, reply.MessageId, err.Error()); err != nil {
				return fmt.Errorf("fail to EditMessage: %s", err)
			}
			return fmt.Errorf("fail to MessageHandle: %s", err)
		}

		if _, err := r.EditMessage(ctx, message.Chat.Id, reply.MessageId, successMessage); err != nil {
			return fmt.Errorf("fail to EditMessage: %s", err)
		}
	}

	return nil
}

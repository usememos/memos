package telegram

import (
	"context"
	"fmt"
	"time"

	"github.com/usememos/memos/common/log"
	"go.uber.org/zap"
)

type Handler interface {
	RobotToken(ctx context.Context) string
	MessageHandle(ctx context.Context, message Message, blobs map[string][]byte) error
}

type Robot struct {
	handler Handler
}

// NewRobotWithHandler create a telegram robot with specified handler.
func NewRobotWithHandler(h Handler) *Robot {
	return &Robot{handler: h}
}

const noTokenWait = 30 * time.Second
const errRetryWait = 10 * time.Second

// Start start an infinity call of getUpdates from Telegram, call r.MessageHandle while get new message updates.
func (r *Robot) Start(ctx context.Context) {
	var offset int

	for {
		updates, err := r.GetUpdates(ctx, offset)
		if err == ErrNoToken {
			time.Sleep(noTokenWait)
			continue
		}
		if err != nil {
			log.Warn("fail to telegram.GetUpdates", zap.Error(err))
			time.Sleep(errRetryWait)
			continue
		}

		groupMessages := make([]Message, 0, len(updates))

		for _, update := range updates {
			offset = update.UpdateID + 1
			if update.Message == nil {
				continue
			}
			message := *update.Message

			// skip message other than text or photo
			if message.Text == nil && message.Photo == nil {
				_, err := r.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, "Only text or photo message be supported")
				if err != nil {
					log.Error(fmt.Sprintf("fail to telegram.SendReplyMessage for messageID=%d", message.MessageID), zap.Error(err))
				}
				continue
			}

			// Group message need do more
			if message.MediaGroupID != nil {
				groupMessages = append(groupMessages, message)
				continue
			}

			err = r.handleSingleMessage(ctx, message)
			if err != nil {
				log.Error(fmt.Sprintf("fail to handleSingleMessage for messageID=%d", message.MessageID), zap.Error(err))
				continue
			}
		}

		err = r.handleGroupMessages(ctx, groupMessages)
		if err != nil {
			log.Error("fail to handle plain text message", zap.Error(err))
		}
	}
}

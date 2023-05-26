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
	MessageHandle(ctx context.Context, message Message) error
}

type Robot struct {
	handler Handler
}

// NewRobotWithHandler create a telegram robot with specified handler
func NewRobotWithHandler(h Handler) *Robot {
	return &Robot{handler: h}
}

const noTokenWait = 30 * time.Second

// Start start an infinity call of getUpdates from Telegram, call r.MessageHandle while get new message updates
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
			continue
		}

		for _, update := range updates {
			offset = update.UpdateID + 1
			if update.Message == nil {
				continue
			}

			message := *update.Message

			reply, err := r.SendReplyMessage(ctx, message.Chat.Id, message.MessageID, "Working on send your memo...")
			if reply == nil || err != nil {
				log.Warn("fail to telegram.SendMessage", zap.Error(err))
				continue
			}

			result := "Success!"
			err = r.handler.MessageHandle(ctx, message)
			if err != nil {
				result = fmt.Sprintf("fail to send memo: `%s`", err)
			}

			_, err = r.EditMessage(ctx, reply.Chat.Id, reply.MessageID, result)
			if err != nil {
				log.Warn("fail to telegram.EditMessage", zap.Error(err))
			}
		}
	}
}

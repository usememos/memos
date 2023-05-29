package telegram

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/usememos/memos/common/log"
	"go.uber.org/zap"
)

type Handler interface {
	BotToken(ctx context.Context) string
	MessageHandle(ctx context.Context, message Message, blobs map[string][]byte) error
}

type Bot struct {
	handler Handler
}

// NewBotWithHandler create a telegram bot with specified handler.
func NewBotWithHandler(h Handler) *Bot {
	return &Bot{handler: h}
}

const noTokenWait = 30 * time.Second
const errRetryWait = 10 * time.Second

// Start start an infinity call of getUpdates from Telegram, call r.MessageHandle while get new message updates.
func (b *Bot) Start(ctx context.Context) {
	var offset int

	for {
		updates, err := b.GetUpdates(ctx, offset)
		if err == ErrInvalidToken {
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
				_, err := b.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, "Only text or photo message be supported")
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

			err = b.handleSingleMessage(ctx, message)
			if err != nil {
				log.Error(fmt.Sprintf("fail to handleSingleMessage for messageID=%d", message.MessageID), zap.Error(err))
				continue
			}
		}

		err = b.handleGroupMessages(ctx, groupMessages)
		if err != nil {
			log.Error("fail to handle plain text message", zap.Error(err))
		}
	}
}

var ErrInvalidToken = errors.New("token is invalid")

func (b *Bot) apiURL(ctx context.Context) (string, error) {
	token := b.handler.BotToken(ctx)
	if token == "" {
		return "", ErrInvalidToken
	}

	if strings.HasPrefix(token, "http") {
		return token, nil
	}

	return "https://api.telegram.org/bot" + token, nil
}

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
	MessageHandle(ctx context.Context, bot *Bot, message Message, attachments []Attachment) error
	CallbackQueryHandle(ctx context.Context, bot *Bot, callbackQuery CallbackQuery) error
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

		singleMessages := make([]Message, 0, len(updates))
		groupMessages := make([]Message, 0, len(updates))

		for _, update := range updates {
			offset = update.UpdateID + 1

			// handle CallbackQuery update
			if update.CallbackQuery != nil {
				err := b.handler.CallbackQueryHandle(ctx, b, *update.CallbackQuery)
				if err != nil {
					log.Error("fail to handle CallbackQuery", zap.Error(err))
				}

				continue
			}

			// handle Message update
			if update.Message != nil {
				message := *update.Message

				// skip unsupported message
				if !message.IsSupported() {
					_, err := b.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, "Supported messages: animation, audio, text, document, photo, video, video note, voice, other messages with caption")
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

				singleMessages = append(singleMessages, message)
				continue
			}
		}

		err = b.handleSingleMessages(ctx, singleMessages)
		if err != nil {
			log.Error("fail to handle singleMessage", zap.Error(err))
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

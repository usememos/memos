package email

import (
	"log/slog"

	"github.com/pkg/errors"
)

type asyncEmailRequest struct {
	config  *Config
	message *Message
}

var asyncEmailQueue = make(chan asyncEmailRequest, 128)

func init() {
	for range 2 {
		go func() {
			for request := range asyncEmailQueue {
				if err := Send(request.config, request.message); err != nil {
					recipients := ""
					if request.message != nil && len(request.message.To) > 0 {
						recipients = request.message.To[0]
						if len(request.message.To) > 1 {
							recipients += " and others"
						}
					}

					slog.Warn("Failed to send email asynchronously",
						slog.String("recipients", recipients),
						slog.Any("error", err))
				}
			}
		}()
	}
}

// Send sends an email synchronously.
// Returns an error if the email fails to send.
func Send(config *Config, message *Message) error {
	if config == nil {
		return errors.New("email configuration is required")
	}
	if message == nil {
		return errors.New("email message is required")
	}

	client := NewClient(config)
	return client.Send(message)
}

// SendAsync sends an email asynchronously.
// It enqueues the message for bounded asynchronous sending and does not wait for the response.
// Any errors are logged but not returned.
func SendAsync(config *Config, message *Message) {
	select {
	case asyncEmailQueue <- asyncEmailRequest{config: config, message: message}:
	default:
		slog.Warn("Dropped email because the async queue is full")
	}
}

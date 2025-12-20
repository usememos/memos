package email

import (
	"log/slog"

	"github.com/pkg/errors"
)

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
// It spawns a new goroutine to handle the sending and does not wait for the response.
// Any errors are logged but not returned.
func SendAsync(config *Config, message *Message) {
	go func() {
		if err := Send(config, message); err != nil {
			// Since we're in a goroutine, we can only log the error
			recipients := ""
			if message != nil && len(message.To) > 0 {
				recipients = message.To[0]
				if len(message.To) > 1 {
					recipients += " and others"
				}
			}

			slog.Warn("Failed to send email asynchronously",
				slog.String("recipients", recipients),
				slog.Any("error", err))
		}
	}()
}

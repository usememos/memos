package email

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewClient(t *testing.T) {
	config := &Config{
		SMTPHost:     "smtp.example.com",
		SMTPPort:     587,
		SMTPUsername: "user@example.com",
		SMTPPassword: "password",
		FromEmail:    "noreply@example.com",
		FromName:     "Test App",
		UseTLS:       true,
	}

	client := NewClient(config)

	assert.NotNil(t, client)
	assert.Equal(t, config, client.config)
}

func TestClientValidateConfig(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: &Config{
				SMTPHost:  "smtp.example.com",
				SMTPPort:  587,
				FromEmail: "test@example.com",
			},
			wantErr: false,
		},
		{
			name:    "nil config",
			config:  nil,
			wantErr: true,
		},
		{
			name: "invalid config",
			config: &Config{
				SMTPHost: "",
				SMTPPort: 587,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient(tt.config)
			err := client.validateConfig()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestClientSendValidation(t *testing.T) {
	config := &Config{
		SMTPHost:  "smtp.example.com",
		SMTPPort:  587,
		FromEmail: "test@example.com",
	}
	client := NewClient(config)

	tests := []struct {
		name    string
		message *Message
		wantErr bool
	}{
		{
			name: "valid message",
			message: &Message{
				To:      []string{"recipient@example.com"},
				Subject: "Test",
				Body:    "Test body",
			},
			wantErr: false, // Will fail on actual send, but passes validation
		},
		{
			name:    "nil message",
			message: nil,
			wantErr: true,
		},
		{
			name: "invalid message",
			message: &Message{
				To:      []string{},
				Subject: "Test",
				Body:    "Test",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.Send(tt.message)
			// We expect validation errors for invalid messages
			// For valid messages, we'll get connection errors (which is expected in tests)
			if tt.wantErr {
				assert.Error(t, err)
				// Should fail validation before attempting connection
				assert.NotContains(t, err.Error(), "dial")
			}
			// Note: We don't assert NoError for valid messages because
			// we don't have a real SMTP server in tests
		})
	}
}

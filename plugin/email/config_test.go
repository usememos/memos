package email

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: &Config{
				SMTPHost:     "smtp.gmail.com",
				SMTPPort:     587,
				SMTPUsername: "user@example.com",
				SMTPPassword: "password",
				FromEmail:    "noreply@example.com",
				FromName:     "Memos",
			},
			wantErr: false,
		},
		{
			name: "missing host",
			config: &Config{
				SMTPPort:     587,
				SMTPUsername: "user@example.com",
				SMTPPassword: "password",
				FromEmail:    "noreply@example.com",
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			config: &Config{
				SMTPHost:     "smtp.gmail.com",
				SMTPPort:     0,
				SMTPUsername: "user@example.com",
				SMTPPassword: "password",
				FromEmail:    "noreply@example.com",
			},
			wantErr: true,
		},
		{
			name: "missing from email",
			config: &Config{
				SMTPHost:     "smtp.gmail.com",
				SMTPPort:     587,
				SMTPUsername: "user@example.com",
				SMTPPassword: "password",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConfigGetServerAddress(t *testing.T) {
	config := &Config{
		SMTPHost: "smtp.gmail.com",
		SMTPPort: 587,
	}

	expected := "smtp.gmail.com:587"
	assert.Equal(t, expected, config.GetServerAddress())
}

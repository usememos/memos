package email

import (
	"fmt"

	"github.com/pkg/errors"
)

// Config represents the SMTP configuration for email sending.
// These settings should be provided by the self-hosted instance administrator.
type Config struct {
	// SMTPHost is the SMTP server hostname (e.g., "smtp.gmail.com")
	SMTPHost string
	// SMTPPort is the SMTP server port (common: 587 for TLS, 465 for SSL, 25 for unencrypted)
	SMTPPort int
	// SMTPUsername is the SMTP authentication username (usually the email address)
	SMTPUsername string
	// SMTPPassword is the SMTP authentication password or app-specific password
	SMTPPassword string
	// FromEmail is the email address that will appear in the "From" field
	FromEmail string
	// FromName is the display name that will appear in the "From" field
	FromName string
	// UseTLS enables STARTTLS encryption (recommended for port 587)
	UseTLS bool
	// UseSSL enables SSL/TLS encryption (for port 465)
	UseSSL bool
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.SMTPHost == "" {
		return errors.New("SMTP host is required")
	}
	if c.SMTPPort <= 0 || c.SMTPPort > 65535 {
		return errors.New("SMTP port must be between 1 and 65535")
	}
	if c.FromEmail == "" {
		return errors.New("from email is required")
	}
	return nil
}

// GetServerAddress returns the SMTP server address in the format "host:port".
func (c *Config) GetServerAddress() string {
	return fmt.Sprintf("%s:%d", c.SMTPHost, c.SMTPPort)
}

package email

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// Message represents an email message to be sent.
type Message struct {
	To      []string // Required: recipient email addresses
	Cc      []string // Optional: carbon copy recipients
	Bcc     []string // Optional: blind carbon copy recipients
	Subject string   // Required: email subject
	Body    string   // Required: email body content
	IsHTML  bool     // Whether the body is HTML (default: false for plain text)
	ReplyTo string   // Optional: reply-to address
}

// Validate checks that the message has all required fields.
func (m *Message) Validate() error {
	if len(m.To) == 0 {
		return errors.New("at least one recipient is required")
	}
	if m.Subject == "" {
		return errors.New("subject is required")
	}
	if m.Body == "" {
		return errors.New("body is required")
	}
	return nil
}

// Format creates an RFC 5322 formatted email message.
func (m *Message) Format(fromEmail, fromName string) string {
	var sb strings.Builder

	// From header
	if fromName != "" {
		fmt.Fprintf(&sb, "From: %s <%s>\r\n", fromName, fromEmail)
	} else {
		fmt.Fprintf(&sb, "From: %s\r\n", fromEmail)
	}

	// To header
	fmt.Fprintf(&sb, "To: %s\r\n", strings.Join(m.To, ", "))

	// Cc header (optional)
	if len(m.Cc) > 0 {
		fmt.Fprintf(&sb, "Cc: %s\r\n", strings.Join(m.Cc, ", "))
	}

	// Reply-To header (optional)
	if m.ReplyTo != "" {
		fmt.Fprintf(&sb, "Reply-To: %s\r\n", m.ReplyTo)
	}

	// Subject header
	fmt.Fprintf(&sb, "Subject: %s\r\n", m.Subject)

	// Date header (RFC 5322 format)
	fmt.Fprintf(&sb, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))

	// MIME headers
	sb.WriteString("MIME-Version: 1.0\r\n")

	// Content-Type header
	if m.IsHTML {
		sb.WriteString("Content-Type: text/html; charset=utf-8\r\n")
	} else {
		sb.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	}

	// Empty line separating headers from body
	sb.WriteString("\r\n")

	// Body
	sb.WriteString(m.Body)

	return sb.String()
}

// GetAllRecipients returns all recipients (To, Cc, Bcc) as a single slice.
func (m *Message) GetAllRecipients() []string {
	var recipients []string
	recipients = append(recipients, m.To...)
	recipients = append(recipients, m.Cc...)
	recipients = append(recipients, m.Bcc...)
	return recipients
}

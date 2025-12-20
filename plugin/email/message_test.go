package email

import (
	"strings"
	"testing"
)

func TestMessageValidation(t *testing.T) {
	tests := []struct {
		name    string
		msg     Message
		wantErr bool
	}{
		{
			name: "valid message",
			msg: Message{
				To:      []string{"user@example.com"},
				Subject: "Test Subject",
				Body:    "Test Body",
			},
			wantErr: false,
		},
		{
			name: "no recipients",
			msg: Message{
				To:      []string{},
				Subject: "Test Subject",
				Body:    "Test Body",
			},
			wantErr: true,
		},
		{
			name: "no subject",
			msg: Message{
				To:      []string{"user@example.com"},
				Subject: "",
				Body:    "Test Body",
			},
			wantErr: true,
		},
		{
			name: "no body",
			msg: Message{
				To:      []string{"user@example.com"},
				Subject: "Test Subject",
				Body:    "",
			},
			wantErr: true,
		},
		{
			name: "multiple recipients",
			msg: Message{
				To:      []string{"user1@example.com", "user2@example.com"},
				Cc:      []string{"cc@example.com"},
				Subject: "Test Subject",
				Body:    "Test Body",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.msg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageFormatPlainText(t *testing.T) {
	msg := Message{
		To:      []string{"user@example.com"},
		Subject: "Test Subject",
		Body:    "Test Body",
		IsHTML:  false,
	}

	formatted := msg.Format("sender@example.com", "Sender Name")

	// Check required headers
	if !strings.Contains(formatted, "From: Sender Name <sender@example.com>") {
		t.Error("Missing or incorrect From header")
	}
	if !strings.Contains(formatted, "To: user@example.com") {
		t.Error("Missing or incorrect To header")
	}
	if !strings.Contains(formatted, "Subject: Test Subject") {
		t.Error("Missing or incorrect Subject header")
	}
	if !strings.Contains(formatted, "Content-Type: text/plain; charset=utf-8") {
		t.Error("Missing or incorrect Content-Type header for plain text")
	}
	if !strings.Contains(formatted, "Test Body") {
		t.Error("Missing message body")
	}
}

func TestMessageFormatHTML(t *testing.T) {
	msg := Message{
		To:      []string{"user@example.com"},
		Subject: "Test Subject",
		Body:    "<html><body>Test Body</body></html>",
		IsHTML:  true,
	}

	formatted := msg.Format("sender@example.com", "Sender Name")

	// Check HTML content-type
	if !strings.Contains(formatted, "Content-Type: text/html; charset=utf-8") {
		t.Error("Missing or incorrect Content-Type header for HTML")
	}
	if !strings.Contains(formatted, "<html><body>Test Body</body></html>") {
		t.Error("Missing HTML body")
	}
}

func TestMessageFormatMultipleRecipients(t *testing.T) {
	msg := Message{
		To:      []string{"user1@example.com", "user2@example.com"},
		Cc:      []string{"cc1@example.com", "cc2@example.com"},
		Bcc:     []string{"bcc@example.com"},
		Subject: "Test Subject",
		Body:    "Test Body",
		ReplyTo: "reply@example.com",
	}

	formatted := msg.Format("sender@example.com", "Sender Name")

	// Check To header formatting
	if !strings.Contains(formatted, "To: user1@example.com, user2@example.com") {
		t.Error("Missing or incorrect To header with multiple recipients")
	}
	// Check Cc header formatting
	if !strings.Contains(formatted, "Cc: cc1@example.com, cc2@example.com") {
		t.Error("Missing or incorrect Cc header")
	}
	// Bcc should NOT appear in the formatted message
	if strings.Contains(formatted, "Bcc:") {
		t.Error("Bcc header should not appear in formatted message")
	}
	// Check Reply-To header
	if !strings.Contains(formatted, "Reply-To: reply@example.com") {
		t.Error("Missing or incorrect Reply-To header")
	}
}

func TestGetAllRecipients(t *testing.T) {
	msg := Message{
		To:  []string{"user1@example.com", "user2@example.com"},
		Cc:  []string{"cc@example.com"},
		Bcc: []string{"bcc@example.com"},
	}

	recipients := msg.GetAllRecipients()

	// Should have all 4 recipients
	if len(recipients) != 4 {
		t.Errorf("GetAllRecipients() returned %d recipients, want 4", len(recipients))
	}

	// Check all recipients are present
	expectedRecipients := map[string]bool{
		"user1@example.com": true,
		"user2@example.com": true,
		"cc@example.com":    true,
		"bcc@example.com":   true,
	}

	for _, recipient := range recipients {
		if !expectedRecipients[recipient] {
			t.Errorf("Unexpected recipient: %s", recipient)
		}
		delete(expectedRecipients, recipient)
	}

	if len(expectedRecipients) > 0 {
		t.Error("Not all expected recipients were returned")
	}
}

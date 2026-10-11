package email

import (
	"mime"
	"net/mail"
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
	if !strings.Contains(formatted, `From: "Sender Name" <sender@example.com>`) {
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

func TestMessageFormatSanitizesHeaderValues(t *testing.T) {
	msg := Message{
		To:      []string{"user@example.com\r\nX-Injected-To: bad"},
		Cc:      []string{"cc@example.com\r\nX-Injected-Cc: bad"},
		Subject: "Test\r\nX-Injected-Subject: bad",
		Body:    "Test Body",
		ReplyTo: "reply@example.com\r\nX-Injected-Reply-To: bad",
	}

	formatted := msg.Format("sender@example.com\r\nX-Injected-From: bad", "Sender\r\nX-Injected-Name: bad")
	headers, _, _ := strings.Cut(formatted, "\r\n\r\n")

	if strings.Contains(headers, "\r\nX-Injected") {
		t.Fatalf("header value injection was not sanitized:\n%s", headers)
	}
	if !strings.Contains(headers, "Subject: Test X-Injected-Subject: bad") {
		t.Error("subject header was not normalized")
	}
	if !strings.Contains(headers, `From: "Sender X-Injected-Name: bad" <sender@example.com X-Injected-From: bad>`) {
		t.Error("from header was not normalized")
	}
}

func TestMessageFormatEncodesNonASCIIHeaders(t *testing.T) {
	msg := Message{
		To:      []string{"user@example.com"},
		Subject: "Zoë commented in 李雷的空间",
		Body:    "Test Body",
	}

	formatted := msg.Format("sender@example.com", "Zoë")
	headers, _, _ := strings.Cut(formatted, "\r\n\r\n")
	for _, r := range headers {
		if r > 127 {
			t.Fatalf("headers contain raw non-ASCII text:\n%s", headers)
		}
	}

	parsed, err := mail.ReadMessage(strings.NewReader(formatted))
	if err != nil {
		t.Fatalf("formatted message does not parse: %v", err)
	}
	decoded, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
	if err != nil || decoded != msg.Subject {
		t.Errorf("subject decodes to %q, err %v", decoded, err)
	}
	if !strings.Contains(headers, "From: =?utf-8?q?Zo=C3=AB?= <sender@example.com>") {
		t.Errorf("from name was not encoded:\n%s", headers)
	}
}

func TestMessageFormatFoldsLongHeaders(t *testing.T) {
	msg := Message{
		To:      []string{"user@example.com"},
		Subject: strings.Repeat("李雷的空间 ", 30) + "has a very long title",
		Body:    "Test Body",
	}

	formatted := msg.Format("sender@example.com", strings.Repeat("Zoë ", 20)+"Memos")
	headers, _, _ := strings.Cut(formatted, "\r\n\r\n")
	for line := range strings.SplitSeq(headers, "\r\n") {
		if len(line) <= maxHeaderLineLength {
			continue
		}
		// A lone encoded word after the header name may exceed the
		// recommended length; a line that still has a fold point may not.
		_, value, _ := strings.Cut(line, ": ")
		if strings.Contains(strings.TrimSpace(value), " ") || len(line) > 998 {
			t.Errorf("header line of %d characters was not folded:\n%s", len(line), line)
		}
	}

	parsed, err := mail.ReadMessage(strings.NewReader(formatted))
	if err != nil {
		t.Fatalf("folded message does not parse: %v", err)
	}
	decoded, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
	if err != nil || decoded != msg.Subject {
		t.Errorf("folded subject decodes to %q, err %v", decoded, err)
	}
	from, err := mail.ParseAddress(parsed.Header.Get("From"))
	if err != nil || from.Name != strings.Repeat("Zoë ", 20)+"Memos" {
		t.Errorf("folded From decodes to %v, err %v", from, err)
	}
}

func TestMessageFormatEncodesNonASCIIFromNameWithSpecials(t *testing.T) {
	msg := Message{To: []string{"user@example.com"}, Subject: "Test", Body: "Test"}
	for _, name := range []string{"Zoë <ops>", "Zoë, Team", "Zoë (Memos)"} {
		formatted := msg.Format("sender@example.com", name)
		parsed, err := mail.ReadMessage(strings.NewReader(formatted))
		if err != nil {
			t.Fatalf("formatted message for name %q does not parse: %v", name, err)
		}
		from := parsed.Header.Get("From")
		address, err := mail.ParseAddress(from)
		if err != nil {
			t.Errorf("From header %q for name %q does not parse: %v", from, name, err)
			continue
		}
		if address.Name != name || address.Address != "sender@example.com" {
			t.Errorf("From header %q decodes to %q <%s>, want %q", from, address.Name, address.Address, name)
		}
	}
}

func TestMessageFormatQuotesSpecialsInFromName(t *testing.T) {
	msg := Message{To: []string{"user@example.com"}, Subject: "Test", Body: "Test"}
	formatted := msg.Format("sender@example.com", `Memos, "Team"`)
	if !strings.Contains(formatted, `From: "Memos, \"Team\"" <sender@example.com>`) {
		t.Errorf("from name with specials was not quoted:\n%s", formatted)
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

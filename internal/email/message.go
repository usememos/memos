package email

import (
	"errors"
	"fmt"
	"mime"
	"net/mail"
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
	fromEmail = sanitizeEmailHeaderValue(fromEmail)
	fromName = sanitizeEmailHeaderValue(fromName)
	to := sanitizeEmailHeaderValues(m.To)
	cc := sanitizeEmailHeaderValues(m.Cc)
	replyTo := sanitizeEmailHeaderValue(m.ReplyTo)
	subject := encodeSubject(sanitizeEmailHeaderValue(m.Subject))

	// From header. net/mail quotes an ASCII display name that contains RFC
	// 5322 specials and RFC 2047 encodes a non-ASCII one, choosing an
	// encoding whose words stay valid inside a phrase.
	writeHeader(&sb, "From", (&mail.Address{Name: fromName, Address: fromEmail}).String())

	// To header
	writeHeader(&sb, "To", strings.Join(to, ", "))

	// Cc header (optional)
	if len(cc) > 0 {
		writeHeader(&sb, "Cc", strings.Join(cc, ", "))
	}

	// Reply-To header (optional)
	if replyTo != "" {
		writeHeader(&sb, "Reply-To", replyTo)
	}

	// Subject header
	writeHeader(&sb, "Subject", subject)

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

// maxHeaderLineLength is the line length RFC 5322 recommends; the hard limit
// is 998 characters, which a long RFC 2047 encoded subject would otherwise
// exceed.
const maxHeaderLineLength = 78

// maxHeaderLineHardLimit is the longest header line RFC 5322 allows, not
// counting the CRLF.
const maxHeaderLineHardLimit = 998

// encodeSubject prepares a Subject value. Header values must be ASCII, so RFC
// 2047 encodes UTF-8 text such as nicknames and Space titles. ASCII text is
// left unchanged unless it has a word too long for one header line, which
// writeHeader can't fold; that text is split into encoded words instead.
func encodeSubject(subject string) string {
	encoded := mime.QEncoding.Encode("utf-8", subject)
	if encoded != subject {
		return encoded
	}
	for word := range strings.SplitSeq(subject, " ") {
		if len("Subject: ")+len(word) > maxHeaderLineHardLimit {
			return qEncodeWords(subject)
		}
	}
	return subject
}

// maxEncodedWordLength is the longest RFC 2047 encoded word.
const maxEncodedWordLength = 75

// qEncodeWords Q-encodes ASCII text as encoded words separated by spaces.
// Receivers drop the space between adjacent encoded words, so the text
// decodes back unchanged.
func qEncodeWords(text string) string {
	const prefix, suffix = "=?utf-8?q?", "?="
	var sb strings.Builder
	sb.WriteString(prefix)
	wordLength := len(prefix)
	for i := 0; i < len(text); i++ {
		c := text[i]
		var encoded string
		switch {
		case c == ' ':
			encoded = "_"
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', strings.IndexByte("!*+-/", c) >= 0:
			encoded = string(c)
		default:
			encoded = fmt.Sprintf("=%02X", c)
		}
		if wordLength+len(encoded)+len(suffix) > maxEncodedWordLength {
			sb.WriteString(suffix + " " + prefix)
			wordLength = len(prefix)
		}
		sb.WriteString(encoded)
		wordLength += len(encoded)
	}
	sb.WriteString(suffix)
	return sb.String()
}

// writeHeader writes one header, folding the value at spaces so no line is
// longer than maxHeaderLineLength unless a single word already is. Receivers
// unfold CRLF followed by white space back to the single space, so the value
// is unchanged.
func writeHeader(sb *strings.Builder, name, value string) {
	sb.WriteString(name)
	sb.WriteString(": ")
	lineLength := len(name) + 2
	for i, word := range strings.Split(value, " ") {
		if i > 0 {
			if lineLength+1+len(word) > maxHeaderLineLength {
				sb.WriteString("\r\n ")
				lineLength = 1
			} else {
				sb.WriteByte(' ')
				lineLength++
			}
		}
		sb.WriteString(word)
		lineLength += len(word)
	}
	sb.WriteString("\r\n")
}

func sanitizeEmailHeaderValue(value string) string {
	value = strings.NewReplacer("\r", " ", "\n", " ").Replace(value)
	return strings.Join(strings.Fields(value), " ")
}

func sanitizeEmailHeaderValues(values []string) []string {
	sanitized := make([]string, 0, len(values))
	for _, value := range values {
		sanitized = append(sanitized, sanitizeEmailHeaderValue(value))
	}
	return sanitized
}

// GetAllRecipients returns all recipients (To, Cc, Bcc) as a single slice.
func (m *Message) GetAllRecipients() []string {
	var recipients []string
	recipients = append(recipients, m.To...)
	recipients = append(recipients, m.Cc...)
	recipients = append(recipients, m.Bcc...)
	return recipients
}

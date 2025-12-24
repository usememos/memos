# Email Plugin

SMTP email sending functionality for self-hosted Memos instances.

## Overview

This plugin provides a simple, reliable email sending interface following industry-standard SMTP protocols. It's designed for self-hosted environments where instance administrators configure their own email service, similar to platforms like GitHub, GitLab, and Discourse.

## Features

- Standard SMTP protocol support
- TLS/STARTTLS and SSL/TLS encryption
- HTML and plain text emails
- Multiple recipients (To, Cc, Bcc)
- Synchronous and asynchronous sending
- Detailed error reporting with context
- Works with all major email providers
- Reply-To header support
- RFC 5322 compliant message formatting

## Quick Start

### 1. Configure SMTP Settings

```go
import "github.com/usememos/memos/plugin/email"

config := &email.Config{
    SMTPHost:     "smtp.gmail.com",
    SMTPPort:     587,
    SMTPUsername: "your-email@gmail.com",
    SMTPPassword: "your-app-password",
    FromEmail:    "noreply@yourdomain.com",
    FromName:     "Memos",
    UseTLS:       true,
}
```

### 2. Create and Send Email

```go
message := &email.Message{
    To:      []string{"user@example.com"},
    Subject: "Welcome to Memos!",
    Body:    "Thanks for signing up.",
    IsHTML:  false,
}

// Synchronous send (waits for result)
err := email.Send(config, message)
if err != nil {
    log.Printf("Failed to send email: %v", err)
}

// Asynchronous send (returns immediately)
email.SendAsync(config, message)
```

## Provider Configuration

### Gmail

Requires an [App Password](https://support.google.com/accounts/answer/185833) (2FA must be enabled):

```go
config := &email.Config{
    SMTPHost:     "smtp.gmail.com",
    SMTPPort:     587,
    SMTPUsername: "your-email@gmail.com",
    SMTPPassword: "your-16-char-app-password",
    FromEmail:    "your-email@gmail.com",
    FromName:     "Memos",
    UseTLS:       true,
}
```

**Alternative (SSL):**
```go
config := &email.Config{
    SMTPHost:     "smtp.gmail.com",
    SMTPPort:     465,
    SMTPUsername: "your-email@gmail.com",
    SMTPPassword: "your-16-char-app-password",
    FromEmail:    "your-email@gmail.com",
    FromName:     "Memos",
    UseSSL:       true,
}
```

### SendGrid

```go
config := &email.Config{
    SMTPHost:     "smtp.sendgrid.net",
    SMTPPort:     587,
    SMTPUsername: "apikey",
    SMTPPassword: "your-sendgrid-api-key",
    FromEmail:    "noreply@yourdomain.com",
    FromName:     "Memos",
    UseTLS:       true,
}
```

### AWS SES

```go
config := &email.Config{
    SMTPHost:     "email-smtp.us-east-1.amazonaws.com",
    SMTPPort:     587,
    SMTPUsername: "your-smtp-username",
    SMTPPassword: "your-smtp-password",
    FromEmail:    "verified@yourdomain.com",
    FromName:     "Memos",
    UseTLS:       true,
}
```

**Note:** Replace `us-east-1` with your AWS region. Email must be verified in SES.

### Mailgun

```go
config := &email.Config{
    SMTPHost:     "smtp.mailgun.org",
    SMTPPort:     587,
    SMTPUsername: "postmaster@yourdomain.com",
    SMTPPassword: "your-mailgun-smtp-password",
    FromEmail:    "noreply@yourdomain.com",
    FromName:     "Memos",
    UseTLS:       true,
}
```

### Self-Hosted SMTP (Postfix, Exim, etc.)

```go
config := &email.Config{
    SMTPHost:     "mail.yourdomain.com",
    SMTPPort:     587,
    SMTPUsername: "username",
    SMTPPassword: "password",
    FromEmail:    "noreply@yourdomain.com",
    FromName:     "Memos",
    UseTLS:       true,
}
```

## HTML Emails

```go
message := &email.Message{
    To:      []string{"user@example.com"},
    Subject: "Welcome to Memos!",
    Body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif;">
    <h1 style="color: #333;">Welcome to Memos!</h1>
    <p>We're excited to have you on board.</p>
    <a href="https://yourdomain.com" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a>
</body>
</html>
    `,
    IsHTML: true,
}

email.Send(config, message)
```

## Multiple Recipients

```go
message := &email.Message{
    To:      []string{"user1@example.com", "user2@example.com"},
    Cc:      []string{"manager@example.com"},
    Bcc:     []string{"admin@example.com"},
    Subject: "Team Update",
    Body:    "Important team announcement...",
    ReplyTo: "support@yourdomain.com",
}

email.Send(config, message)
```

## Testing

### Run Tests

```bash
# All tests
go test ./plugin/email/... -v

# With coverage
go test ./plugin/email/... -v -cover

# With race detector
go test ./plugin/email/... -race
```

### Manual Testing

Create a simple test program:

```go
package main

import (
    "log"
    "github.com/usememos/memos/plugin/email"
)

func main() {
    config := &email.Config{
        SMTPHost:     "smtp.gmail.com",
        SMTPPort:     587,
        SMTPUsername: "your-email@gmail.com",
        SMTPPassword: "your-app-password",
        FromEmail:    "your-email@gmail.com",
        FromName:     "Test",
        UseTLS:       true,
    }

    message := &email.Message{
        To:      []string{"recipient@example.com"},
        Subject: "Test Email",
        Body:    "This is a test email from Memos email plugin.",
    }

    if err := email.Send(config, message); err != nil {
        log.Fatalf("Failed to send email: %v", err)
    }

    log.Println("Email sent successfully!")
}
```

## Security Best Practices

### 1. Use TLS/SSL Encryption

Always enable encryption in production:

```go
// STARTTLS (port 587) - Recommended
config.UseTLS = true

// SSL/TLS (port 465)
config.UseSSL = true
```

### 2. Secure Credential Storage

Never hardcode credentials. Use environment variables:

```go
import "os"

config := &email.Config{
    SMTPHost:     os.Getenv("SMTP_HOST"),
    SMTPPort:     587,
    SMTPUsername: os.Getenv("SMTP_USERNAME"),
    SMTPPassword: os.Getenv("SMTP_PASSWORD"),
    FromEmail:    os.Getenv("SMTP_FROM_EMAIL"),
    UseTLS:       true,
}
```

### 3. Use App-Specific Passwords

For Gmail and similar services, use app passwords instead of your main account password.

### 4. Validate and Sanitize Input

Always validate email addresses and sanitize content:

```go
// Validate before sending
if err := message.Validate(); err != nil {
    return err
}
```

### 5. Implement Rate Limiting

Prevent abuse by limiting email sending:

```go
// Example using golang.org/x/time/rate
limiter := rate.NewLimiter(rate.Every(time.Second), 10) // 10 emails per second

if !limiter.Allow() {
    return errors.New("rate limit exceeded")
}
```

### 6. Monitor and Log

Log email sending activity for security monitoring:

```go
if err := email.Send(config, message); err != nil {
    slog.Error("Email send failed",
        slog.String("recipient", message.To[0]),
        slog.Any("error", err))
}
```

## Common Ports

| Port | Protocol | Security | Use Case |
|------|----------|----------|----------|
| **587** | SMTP + STARTTLS | Encrypted | **Recommended** for most providers |
| **465** | SMTP over SSL/TLS | Encrypted | Alternative secure option |
| **25** | SMTP | Unencrypted | Legacy, often blocked by ISPs |
| **2525** | SMTP + STARTTLS | Encrypted | Alternative when 587 is blocked |

**Port 587 (STARTTLS)** is the recommended standard for modern SMTP:
```go
config := &email.Config{
    SMTPPort: 587,
    UseTLS:   true,
}
```

**Port 465 (SSL/TLS)** is the alternative:
```go
config := &email.Config{
    SMTPPort: 465,
    UseSSL:   true,
}
```

## Error Handling

The package provides detailed, contextual errors:

```go
err := email.Send(config, message)
if err != nil {
    // Error messages include context:
    switch {
    case strings.Contains(err.Error(), "invalid email configuration"):
        // Configuration error (missing host, invalid port, etc.)
        log.Printf("Configuration error: %v", err)

    case strings.Contains(err.Error(), "invalid email message"):
        // Message validation error (missing recipients, subject, body)
        log.Printf("Message error: %v", err)

    case strings.Contains(err.Error(), "authentication failed"):
        // SMTP authentication failed (wrong credentials)
        log.Printf("Auth error: %v", err)

    case strings.Contains(err.Error(), "failed to connect"):
        // Network/connection error
        log.Printf("Connection error: %v", err)

    case strings.Contains(err.Error(), "recipient rejected"):
        // SMTP server rejected recipient
        log.Printf("Recipient error: %v", err)

    default:
        log.Printf("Unknown error: %v", err)
    }
}
```

### Common Error Messages

```
❌ "invalid email configuration: SMTP host is required"
   → Fix: Set config.SMTPHost

❌ "invalid email configuration: SMTP port must be between 1 and 65535"
   → Fix: Set valid config.SMTPPort (usually 587 or 465)

❌ "invalid email configuration: from email is required"
   → Fix: Set config.FromEmail

❌ "invalid email message: at least one recipient is required"
   → Fix: Set message.To with at least one email address

❌ "invalid email message: subject is required"
   → Fix: Set message.Subject

❌ "invalid email message: body is required"
   → Fix: Set message.Body

❌ "SMTP authentication failed"
   → Fix: Check credentials (username/password)

❌ "failed to connect to SMTP server"
   → Fix: Verify host/port, check firewall, ensure TLS/SSL settings match server
```

### Async Error Handling

For async sending, errors are logged automatically:

```go
email.SendAsync(config, message)
// Errors logged as:
// [WARN] Failed to send email asynchronously recipients=user@example.com error=...
```

## Dependencies

### Required

- **Go 1.25+**
- Standard library: `net/smtp`, `crypto/tls`
- `github.com/pkg/errors` - Error wrapping with context

### No External SMTP Libraries

This plugin uses Go's standard `net/smtp` library for maximum compatibility and minimal dependencies.

## API Reference

### Types

#### `Config`
```go
type Config struct {
    SMTPHost     string // SMTP server hostname
    SMTPPort     int    // SMTP server port
    SMTPUsername string // SMTP auth username
    SMTPPassword string // SMTP auth password
    FromEmail    string // From email address
    FromName     string // From display name (optional)
    UseTLS       bool   // Enable STARTTLS (port 587)
    UseSSL       bool   // Enable SSL/TLS (port 465)
}
```

#### `Message`
```go
type Message struct {
    To      []string // Recipients
    Cc      []string // CC recipients (optional)
    Bcc     []string // BCC recipients (optional)
    Subject string   // Email subject
    Body    string   // Email body (plain text or HTML)
    IsHTML  bool     // true for HTML, false for plain text
    ReplyTo string   // Reply-To address (optional)
}
```

### Functions

#### `Send(config *Config, message *Message) error`
Sends an email synchronously. Blocks until email is sent or error occurs.

#### `SendAsync(config *Config, message *Message)`
Sends an email asynchronously in a goroutine. Returns immediately. Errors are logged.

#### `NewClient(config *Config) *Client`
Creates a new SMTP client for advanced usage.

#### `Client.Send(message *Message) error`
Sends email using the client's configuration.

## Architecture

```
plugin/email/
├── config.go       # SMTP configuration types
├── message.go      # Email message types and formatting
├── client.go       # SMTP client implementation
├── email.go        # High-level Send/SendAsync API
├── doc.go          # Package documentation
└── *_test.go       # Unit tests
```

## License

Part of the Memos project. See main repository for license details.

## Contributing

This plugin follows the Memos contribution guidelines. Please ensure:

1. All code is tested (TDD approach)
2. Tests pass: `go test ./plugin/email/... -v`
3. Code is formatted: `go fmt ./plugin/email/...`
4. No linting errors: `golangci-lint run ./plugin/email/...`

## Support

For issues and questions:

- Memos GitHub Issues: https://github.com/usememos/memos/issues
- Memos Documentation: https://usememos.com/docs

## Roadmap

Future enhancements may include:

- Email template system
- Attachment support
- Inline image embedding
- Email queuing system
- Delivery status tracking
- Bounce handling

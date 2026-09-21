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

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

## Provider Configuration

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

## HTML Emails

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

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

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

## Testing

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

## Security Best Practices

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

### 5. Implement Rate Limiting

Prevent abuse by limiting email sending:

```go
// Example using golang.org/x/time/rate
limiter := rate.NewLimiter(rate.Every(time.Second), 10) // 10 emails per second

if !limiter.Allow() {
    return errors.New("rate limit exceeded")
}
```

## Common Ports

> Moved to [`.archcore/email/sending-email.guide.md`](../../.archcore/email/sending-email.guide.md).

## Error Handling

> Moved to [`.archcore/email/email-contract.spec.md`](../../.archcore/email/email-contract.spec.md).

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

## Dependencies

### Required

- **Go 1.27+**
- Standard library: `net/smtp`, `crypto/tls`
- `github.com/pkg/errors` - Error wrapping with context

### No External SMTP Libraries

This plugin uses Go's standard `net/smtp` library for maximum compatibility and minimal dependencies.

## API Reference

> Moved to [`.archcore/email/email-contract.spec.md`](../../.archcore/email/email-contract.spec.md).

### Functions

#### `SendAsync(config *Config, message *Message)`
Sends an email asynchronously in a goroutine. Returns immediately. Errors are logged.

## Architecture

> Moved to [`.archcore/email/email-contract.spec.md`](../../.archcore/email/email-contract.spec.md).

## License

Part of the Memos project. See main repository for license details.

## Contributing

This package follows the Memos contribution guidelines. Please ensure:

1. All code is tested (TDD approach)
2. Tests pass: `go test ./internal/email/... -v`
3. Code is formatted: `go fmt ./internal/email/...`
4. No linting errors: `golangci-lint run ./internal/email/...`

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

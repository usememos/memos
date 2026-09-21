---
title: "Sending and testing email"
status: draft
tags:
  - "email"
---

Reader: a Memos Go contributor who sends email from server code or tests it. Task: configure SMTP, send plain-text, HTML, or multi-recipient email through `internal/email`, and test the package. Actor: the contributor.

## Prerequisites
- A checkout of the `github.com/usememos/memos` module and the Go version declared in @go.mod. Go allows importing `internal/email` only from packages inside this module.
- An SMTP account and its host, port, username, and password.
- For Gmail: two-factor authentication enabled and an [App Password](https://support.google.com/accounts/answer/185833).
- For AWS SES: a sender address verified in SES.

## Steps
### Configure SMTP
1. Import `github.com/usememos/memos/internal/email`.
2. Build an `email.Config` with `SMTPHost`, `SMTPPort`, `SMTPUsername`, `SMTPPassword`, `FromEmail`, and `FromName`.
3. For port 587, set `UseTLS: true` (STARTTLS).
4. For port 465, set `UseSSL: true` instead.
5. Take host, port, and username from the provider table below.

| Provider | `SMTPHost` | Port and security | `SMTPUsername` / `SMTPPassword` |
|---|---|---|---|
| Gmail | `smtp.gmail.com` | 587 `UseTLS`, or 465 `UseSSL` | account address / 16-character App Password; `FromEmail` is the same address |
| SendGrid | `smtp.sendgrid.net` | 587 `UseTLS` | `apikey` / SendGrid API key |
| AWS SES | `email-smtp.<region>.amazonaws.com` | 587 `UseTLS` | SES SMTP username / SES SMTP password |
| Mailgun | `smtp.mailgun.org` | 587 `UseTLS` | `postmaster@yourdomain.com` / Mailgun SMTP password |
| Self-hosted (Postfix, Exim) | `mail.yourdomain.com` | 587 `UseTLS` | local account |

Port 25 is unencrypted SMTP and often blocked by ISPs; port 2525 with STARTTLS is an alternative when 587 is blocked.

### Build and send a message
6. Build an `email.Message` with `To`, `Subject`, and `Body`.
7. For HTML, set `IsHTML: true` and put a complete HTML document in `Body`.
8. For several recipients, list them in `To`; add `Cc`, `Bcc`, and `ReplyTo` when the message uses them.
9. Call `message.Validate()` and return its error before sending.
10. To wait for the result, call `email.Send(config, message)` and handle the returned error.
11. To return immediately, call `email.SendAsync(config, message)`; failures appear only in the log.

```go
message := &email.Message{
    To:      []string{"user1@example.com", "user2@example.com"},
    Cc:      []string{"manager@example.com"},
    Bcc:     []string{"admin@example.com"},
    Subject: "Team Update",
    Body:    "Important team announcement...",
    ReplyTo: "support@yourdomain.com",
}
if err := email.Send(config, message); err != nil {
    slog.Error("Email send failed", slog.String("recipient", message.To[0]), slog.Any("error", err))
}
```

### Apply the security practices
12. Enable `UseTLS` or `UseSSL` in production; prefer STARTTLS on port 587.
13. Read credentials from environment variables or secret storage; never hardcode them.
14. For Gmail and similar services, use an app-specific password, not the main account password.
15. Validate email addresses and sanitize content before sending.
16. Rate-limit sending, for example with `rate.NewLimiter(rate.Every(time.Second), 10)` from `golang.org/x/time/rate`.
17. Log send failures with `slog`, including the recipient and the error.

In the running server, SMTP settings come from the `NOTIFICATION` instance setting (@core/notification/email.go), not from environment variables. Variable names such as `SMTP_HOST` are the caller's own choice.

### Test the package
18. Run `go test ./internal/email/... -v`.
19. For coverage, run `go test ./internal/email/... -v -cover`.
20. For the race detector, run `go test ./internal/email/... -race`.
21. For a manual check, write a `main` package inside the module that calls `email.Send` with real settings.
22. Run the program and send a message to a mailbox you can read.

## Verification
- Each `go test` command ends with `ok  github.com/usememos/memos/internal/email`.
- The manual program exits without `log.Fatalf` output and the recipient mailbox receives the test message.
- After `SendAsync`, the log shows no `Failed to send email asynchronously` warning.

## Common Issues
- **`invalid email configuration: SMTP host is required`**: set `config.SMTPHost`.
- **`invalid email configuration: SMTP port must be between 1 and 65535`**: set a valid `config.SMTPPort`, usually 587 or 465.
- **`invalid email configuration: from email is required`**: set `config.FromEmail`.
- **`invalid email message: at least one recipient is required`**: add at least one address to `message.To`.
- **`invalid email message: subject is required`** or **`body is required`**: set `message.Subject` or `message.Body`.
- **`SMTP authentication failed`**: check the username and password; Gmail needs an App Password.
- **`failed to connect to SMTP server`**: verify host and port, check the firewall, and make `UseTLS`/`UseSSL` match the server.
- **`SMTP server does not support STARTTLS`**: `UseTLS` is set but the server offers no STARTTLS on this port (@internal/email/client.go). [assumption] Use the provider's STARTTLS port, or its implicit-TLS port with `UseSSL`.
- **`use of internal package ... not allowed`**: the manual program is outside the Memos module; move it inside the module tree.

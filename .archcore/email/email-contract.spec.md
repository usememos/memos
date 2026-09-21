---
title: "Email delivery API"
status: draft
tags:
  - "email"
---

## Purpose & Scope
This spec defines the SMTP delivery contract of the `internal/email` package: configuration and message inputs, synchronous and asynchronous sending, transport security, message formatting, and error reporting. Instance administrators supply the SMTP settings. Normative for @internal/email/. Dependents: the inbox email dispatcher in @core/notification/email.go, which sends through `SendAsync` by default, and callers that classify errors by message text.
Out of scope: where settings are stored (the `NOTIFICATION` instance setting), email templates, attachments, inline images, persistent queuing, delivery-status tracking, and bounce handling.

## Surface
- `Config` (@internal/email/config.go): `SMTPHost`, `SMTPPort`, `SMTPUsername`, `SMTPPassword`, `FromEmail`, optional `FromName`, `UseTLS` (STARTTLS, usually port 587), `UseSSL` (implicit SSL/TLS, usually port 465); `Validate()`, `GetServerAddress()`.
- `Message` (@internal/email/message.go): required `To`, `Subject`, `Body`; optional `Cc`, `Bcc`, `ReplyTo`; `IsHTML` (false means plain text); `Validate()`, `Format()`, `GetAllRecipients()`.
- `Send(config *Config, message *Message) error` and `SendAsync(config *Config, message *Message)` (@internal/email/email.go).
- `NewClient(config *Config) *Client` and `Client.Send(message *Message) error` for advanced use (@internal/email/client.go).
- Package layout: `config.go` (configuration types), `message.go` (message types and formatting), `client.go` (SMTP client), `email.go` (high-level `Send`/`SendAsync`), `doc.go` (package documentation), `*_test.go` (unit tests).

## Normative Behavior
1. WHEN `Send` is called, the package MUST block until the message is sent or an error occurs.
2. WHEN `Client.Send` runs, the client MUST validate the configuration before the message.
3. WHEN `UseSSL` is true, the client MUST open an implicit TLS connection, whatever `UseTLS` says.
4. WHEN `UseTLS` is true and `UseSSL` is false, the client MUST issue STARTTLS before authentication.
5. WHEN neither `UseTLS` nor `UseSSL` is true, the client MUST send over unencrypted SMTP.
6. The client MUST deliver to every `To`, `Cc`, and `Bcc` recipient.
7. The formatter MUST NOT write `Bcc` recipients into message headers.
8. The formatter MUST produce an RFC 5322 message with `From`, `To`, `Subject`, `Date`, `MIME-Version: 1.0`, and `Content-Type` headers.
9. WHEN `FromName` is set, the formatter MUST write `From: Name <address>`; otherwise only the address.
10. WHEN `Cc` or `ReplyTo` is set, the formatter MUST write the `Cc` or `Reply-To` header.
11. WHEN `IsHTML` is true, the formatter MUST set `text/html; charset=utf-8`; otherwise `text/plain; charset=utf-8`.
12. WHEN `SendAsync` is called, the package MUST return immediately without waiting for delivery.
13. The package MUST NOT return delivery errors from `SendAsync`.
14. WHEN an asynchronous send fails, the package MUST log warning `Failed to send email asynchronously` with `recipients` and `error`.

## Constraints & Invariants
- `SMTPPort` MUST be between 1 and 65535.
- Every returned error MUST be wrapped with context via `github.com/pkg/errors`.
- The error-text prefixes in Failure Behavior are part of the contract, because callers classify errors with `strings.Contains` on `err.Error()`.

## Failure Behavior
1. IF `Send` receives a nil config, THEN it MUST return `email configuration is required`.
2. IF `Send` receives a nil message, THEN it MUST return `email message is required`.
3. IF configuration validation fails, THEN the client MUST return `invalid email configuration: <reason>`.
4. Configuration reasons MUST be `SMTP host is required`, `SMTP port must be between 1 and 65535`, or `from email is required`.
5. IF message validation fails, THEN the client MUST return `invalid email message: <reason>`.
6. Message reasons MUST be `at least one recipient is required`, `subject is required`, or `body is required`.
7. IF the TCP or TLS connection fails, THEN the client MUST return an error starting `failed to connect to SMTP server`.
8. IF `UseTLS` is set and the server lacks STARTTLS, THEN the client MUST return `SMTP server does not support STARTTLS`.
9. IF authentication fails, THEN the client MUST return an error starting `SMTP authentication failed`.
10. IF the server rejects a recipient, THEN the client MUST return an error naming that recipient and stop delivery.

## Conformance
An implementation is conformant when it satisfies behaviors 1–14, the constraints above, and the failure rules. Tests: the package's `*_test.go` files in @internal/email/.

Given a `Config` without `SMTPHost`
When `Send` is called
Then it returns `invalid email configuration: SMTP host is required` without connecting

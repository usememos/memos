// Package email provides SMTP email sending functionality for self-hosted Memos instances.
//
// This package is designed for self-hosted environments where instance administrators
// configure their own SMTP servers. It follows industry-standard patterns used by
// platforms like GitHub, GitLab, and Discourse.
//
// # Configuration
//
// The package requires SMTP server configuration provided by the instance administrator:
//
//	config := &email.Config{
//	    SMTPHost:     "smtp.gmail.com",
//	    SMTPPort:     587,
//	    SMTPUsername: "your-email@gmail.com",
//	    SMTPPassword: "your-app-password",
//	    FromEmail:    "noreply@yourdomain.com",
//	    FromName:     "Memos Notifications",
//	    UseTLS:       true,
//	}
//
// # Common SMTP Settings
//
// Gmail (requires App Password):
//   - Host: smtp.gmail.com
//   - Port: 587 (TLS) or 465 (SSL)
//   - Username: your-email@gmail.com
//   - UseTLS: true (for port 587) or UseSSL: true (for port 465)
//
// SendGrid:
//   - Host: smtp.sendgrid.net
//   - Port: 587
//   - Username: apikey
//   - Password: your-sendgrid-api-key
//   - UseTLS: true
//
// AWS SES:
//   - Host: email-smtp.[region].amazonaws.com
//   - Port: 587
//   - Username: your-smtp-username
//   - Password: your-smtp-password
//   - UseTLS: true
//
// Mailgun:
//   - Host: smtp.mailgun.org
//   - Port: 587
//   - Username: your-mailgun-smtp-username
//   - Password: your-mailgun-smtp-password
//   - UseTLS: true
//
// # Sending Email
//
// Synchronous (waits for completion):
//
//	message := &email.Message{
//	    To:      []string{"user@example.com"},
//	    Subject: "Welcome to Memos",
//	    Body:    "Thank you for joining!",
//	    IsHTML:  false,
//	}
//
//	err := email.Send(config, message)
//	if err != nil {
//	    // Handle error
//	}
//
// Asynchronous (returns immediately):
//
//	email.SendAsync(config, message)
//	// Errors are logged but not returned
//
// # HTML Email
//
//	message := &email.Message{
//	    To:      []string{"user@example.com"},
//	    Subject: "Welcome!",
//	    Body:    "<html><body><h1>Welcome to Memos!</h1></body></html>",
//	    IsHTML:  true,
//	}
//
// # Security Considerations
//
//   - Always use TLS (port 587) or SSL (port 465) for production
//   - Store SMTP credentials securely (environment variables or secrets management)
//   - Use app-specific passwords for services like Gmail
//   - Validate and sanitize email content to prevent injection attacks
//   - Rate limit email sending to prevent abuse
//
// # Error Handling
//
// The package returns descriptive errors for common issues:
//   - Configuration validation errors (missing host, invalid port, etc.)
//   - Message validation errors (missing recipients, subject, or body)
//   - Connection errors (cannot reach SMTP server)
//   - Authentication errors (invalid credentials)
//   - SMTP protocol errors (recipient rejected, etc.)
//
// All errors are wrapped with context using github.com/pkg/errors for better debugging.
package email

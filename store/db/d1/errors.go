package d1

import (
	"errors"
	"net/http"
	"strings"
)

// isUniqueViolation reports whether err is a UNIQUE or PRIMARY KEY constraint
// failure. D1 surfaces SQLite errors as text, so the message is inspected.
func isUniqueViolation(err error) bool {
	var d1Err *Error
	if !errors.As(err, &d1Err) {
		return false
	}
	message := d1Err.Message
	return strings.Contains(message, "UNIQUE constraint failed") ||
		strings.Contains(message, "SQLITE_CONSTRAINT_UNIQUE") ||
		strings.Contains(message, "SQLITE_CONSTRAINT_PRIMARYKEY")
}

// isRetryable reports whether err is a transient D1 failure worth retrying
// right away: a busy or overloaded database, or a server-side error. A 429
// is deliberately not retried; the Cloudflare API rate limit that produces it
// blocks the caller for minutes, so an immediate retry only deepens the block.
func isRetryable(err error) bool {
	var d1Err *Error
	if !errors.As(err, &d1Err) {
		return false
	}
	if d1Err.Status >= http.StatusInternalServerError {
		return true
	}
	message := d1Err.Message
	return strings.Contains(message, "overloaded") ||
		strings.Contains(message, "SQLITE_BUSY") ||
		strings.Contains(message, "database is locked")
}

package chat

import "fmt"

// APIError is a non-2xx response from an AI provider. It carries the HTTP
// status so callers can map provider failures onto meaningful gRPC codes
// instead of collapsing every failure into Internal.
type APIError struct {
	StatusCode int
	// Message is the provider's error text, already truncated for display.
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("provider returned HTTP %d: %s", e.StatusCode, e.Message)
}

// TruncatedErrorBodyLimit bounds how much of a provider error body is kept.
// Provider error pages can be large HTML documents; only the head is useful.
const TruncatedErrorBodyLimit = 2048

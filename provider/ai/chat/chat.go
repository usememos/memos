// Package chat defines the text-generation capability for AI providers.
// Implementations send a system instruction plus a single user payload and
// return the model's text response. It is deliberately single-turn: Memos uses
// it for one-shot generation such as automatic memo review, not conversation.
package chat

import "context"

// Completer generates text from a system instruction and a user payload.
type Completer interface {
	Complete(ctx context.Context, req Request) (*Response, error)
}

// Request is the input to a completion call.
type Request struct {
	// Model is the provider-specific model id (e.g. "gpt-4o-mini", "deepseek-chat").
	Model string
	// Instructions is the system prompt describing the assistant's behavior.
	Instructions string
	// Input is the user payload to act on.
	Input string
	// MaxTokens caps the response length. Zero lets the provider decide.
	MaxTokens int
	// Temperature controls randomness. Nil uses the provider default.
	Temperature *float64
}

// FinishReason reports why generation stopped.
type FinishReason string

const (
	// FinishStop means the model completed normally.
	FinishStop FinishReason = "stop"
	// FinishLength means the response hit the token limit.
	FinishLength FinishReason = "length"
	// FinishOther covers provider-specific reasons such as content filtering.
	FinishOther FinishReason = "other"
)

// Response is the output of a completion call.
type Response struct {
	Text         string
	FinishReason FinishReason
}

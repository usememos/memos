package llm

import (
	"context"
)

// Message represents a chat message for LLM.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompletionRequest represents a chat completion request.
type CompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
}

// CompletionResponse represents a chat completion response.
type CompletionResponse struct {
	Content      string `json:"content"`
	TokenCount   int    `json:"token_count"`
	FinishReason string `json:"finish_reason"`
}

// StreamChunk represents a streaming response chunk.
type StreamChunk struct {
	Content      string `json:"content"`
	Done         bool   `json:"done"`
	FinishReason string `json:"finish_reason,omitempty"`
}

// Provider defines the interface for LLM providers.
type Provider interface {
	// Name returns the provider name.
	Name() string

	// DisplayName returns the human-readable provider name.
	DisplayName() string

	// Models returns available models for this provider.
	Models() []string

	// Complete sends a completion request and returns the response.
	Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error)

	// Stream sends a completion request and streams the response.
	Stream(ctx context.Context, req *CompletionRequest) (<-chan StreamChunk, error)
}

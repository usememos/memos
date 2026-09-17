// Package chat defines the conversational text capability for AI providers.
// Implementations call an OpenAI-compatible /chat/completions endpoint; that
// covers OpenAI, OpenRouter, and DeepInfra without provider-specific code.
package chat

import (
	"context"

	"github.com/pkg/errors"
)

// Chatter runs a single chat completion turn.
type Chatter interface {
	Chat(ctx context.Context, req Request) (*Response, error)
}

// ModelLister lists the model identifiers a provider offers. Providers that do
// not expose a model catalog return ErrModelListUnsupported.
type ModelLister interface {
	ListModels(ctx context.Context) ([]Model, error)
}

// Role identifies who produced a message.
type Role string

const (
	// RoleSystem carries instructions and injected note context.
	RoleSystem Role = "system"
	// RoleUser is a message from the person using the Hub.
	RoleUser Role = "user"
	// RoleAssistant is a previous reply from the model.
	RoleAssistant Role = "assistant"
)

// Message is one turn of conversation sent to the provider.
type Message struct {
	Role    Role
	Content string
}

// Request is the input to a chat completion call.
type Request struct {
	Model string // provider-specific model id, e.g. "anthropic/claude-sonnet-4"
	// Messages is the full conversation in order, starting with the system
	// message when one is present. The Hub is stateless per turn, so callers
	// resend prior turns rather than relying on server-side conversation state.
	Messages []Message
	// MaxCompletionTokens bounds the reply length. Zero leaves it to the provider.
	MaxCompletionTokens int64
}

// Response is the output of a chat completion call.
type Response struct {
	Text         string
	FinishReason FinishReason
	Usage        Usage
	// Model is the model the provider reports having used. It can differ from
	// the requested model when a router such as OpenRouter picks a backend.
	Model string
}

// FinishReason explains why generation stopped.
type FinishReason string

const (
	// FinishStop means the model finished its reply normally.
	FinishStop FinishReason = "stop"
	// FinishLength means the reply hit the token limit and is truncated.
	FinishLength FinishReason = "length"
	// FinishContentFilter means the provider blocked the reply.
	FinishContentFilter FinishReason = "content_filter"
	// FinishToolCalls means the model asked for a tool call. The Hub does not
	// offer tools, so this indicates a provider-side surprise.
	FinishToolCalls FinishReason = "tool_calls"
	// FinishOther is any reason this package does not model explicitly.
	FinishOther FinishReason = "other"
)

// Usage reports token counts for one turn.
type Usage struct {
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
}

// Model describes one selectable model.
type Model struct {
	ID string
	// ContextLength is the model's total context window in tokens, or 0 when the
	// provider does not report it. The Hub uses it only to seed the context
	// budget default.
	ContextLength int64
}

// ErrModelListUnsupported indicates that a provider exposes no model catalog.
var ErrModelListUnsupported = errors.New("provider does not expose a model list")

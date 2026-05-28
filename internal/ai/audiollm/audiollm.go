// Package audiollm defines the multimodal-audio capability for AI providers.
// Implementations call chat-completions or generate-content style APIs that
// accept audio as input. For deterministic transcription, prefer internal/ai/stt
// where a dedicated STT endpoint exists.
package audiollm

import (
	"context"
	"io"
)

// Model invokes a multimodal LLM with audio input.
type Model interface {
	GenerateFromAudio(ctx context.Context, req Request) (*Response, error)
}

// Request is the input to a multimodal-audio call.
type Request struct {
	Audio        io.Reader
	Size         int64
	ContentType  string
	Model        string
	Instructions string   // literal instruction the model is expected to follow
	Temperature  *float32 // optional; nil leaves the provider default in place
}

// Response is the output of a multimodal-audio call.
type Response struct {
	Text         string
	FinishReason FinishReason
}

// FinishReason describes why the model stopped generating.
type FinishReason string

const (
	FinishStop   FinishReason = "stop"   // model finished normally
	FinishLength FinishReason = "length" // truncated by max-tokens
	FinishSafety FinishReason = "safety" // safety filter blocked output
	FinishOther  FinishReason = "other"  // anything else, including unknown
)

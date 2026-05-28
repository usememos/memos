// Package stt defines the speech-to-text capability for AI providers.
// Implementations call dedicated STT endpoints (e.g. OpenAI /audio/transcriptions)
// and return deterministic transcription output. For multimodal LLMs that
// happen to accept audio input, see internal/ai/audiollm.
package stt

import (
	"context"
	"io"
)

// Transcriber transcribes audio to text using a provider's dedicated STT endpoint.
type Transcriber interface {
	Transcribe(ctx context.Context, req Request) (*Response, error)
}

// Request is the input to a transcription call.
type Request struct {
	Audio       io.Reader
	Size        int64
	Filename    string
	ContentType string // IANA media type, e.g. "audio/wav"
	Model       string // provider-specific model id (e.g. "whisper-1", "gpt-4o-transcribe")
	Prompt      string // soft spelling/vocabulary hint (Whisper "prompt" parameter)
	Language    string // ISO 639-1, optional
}

// Response is the output of a transcription call.
type Response struct {
	Text     string
	Language string    // empty if provider did not return it
	Segments []Segment // empty unless provider returned timestamps
}

// Segment is a timestamped portion of the transcript.
type Segment struct {
	Text    string
	Start   float64
	End     float64
	Speaker string // empty unless using a diarization-capable model
}

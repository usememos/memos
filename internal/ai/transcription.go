package ai

import (
	"context"
	"io"
)

// Transcriber transcribes audio into text.
type Transcriber interface {
	Transcribe(ctx context.Context, request TranscribeRequest) (*TranscribeResponse, error)
}

// TranscribeRequest contains an audio transcription request.
type TranscribeRequest struct {
	Model       string
	Filename    string
	ContentType string
	Audio       io.Reader
	Size        int64
	Prompt      string
	Language    string
}

// TranscribeResponse contains an audio transcription response.
type TranscribeResponse struct {
	Text     string
	Language string
	Duration float64
}

package openai

import (
	"context"
	"mime"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

// Transcribe transcribes audio with the /audio/transcriptions endpoint.
func (t *Transcriber) Transcribe(ctx context.Context, request ai.TranscribeRequest) (*ai.TranscribeResponse, error) {
	if strings.TrimSpace(request.Model) == "" {
		return nil, errors.New("model is required")
	}
	if request.Audio == nil {
		return nil, errors.New("audio is required")
	}

	filename, contentType, err := normalizeAudioFileMetadata(request)
	if err != nil {
		return nil, err
	}

	params := openaisdk.AudioTranscriptionNewParams{
		File:           openaisdk.File(request.Audio, filename, contentType),
		Model:          openaisdk.AudioModel(request.Model),
		ResponseFormat: openaisdk.AudioResponseFormatJSON,
	}
	if request.Prompt != "" {
		params.Prompt = openaisdk.String(request.Prompt)
	}
	if request.Language != "" {
		params.Language = openaisdk.String(request.Language)
	}

	response, err := t.client.Audio.Transcriptions.New(ctx, params)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send transcription request")
	}
	return &ai.TranscribeResponse{
		Text:     response.Text,
		Language: response.Language,
		Duration: response.Duration,
	}, nil
}

func normalizeAudioFileMetadata(request ai.TranscribeRequest) (string, string, error) {
	filename := strings.TrimSpace(request.Filename)
	if filename == "" {
		filename = "audio"
	}
	contentType := strings.TrimSpace(request.ContentType)
	if contentType == "" {
		contentType = "application/octet-stream"
	} else {
		mediaType, _, err := mime.ParseMediaType(contentType)
		if err != nil {
			return "", "", errors.Wrap(err, "invalid audio content type")
		}
		contentType = mediaType
	}
	return sanitizeFilename(filename), contentType, nil
}

func sanitizeFilename(filename string) string {
	filename = strings.NewReplacer("\r", "_", "\n", "_").Replace(filename)
	if strings.TrimSpace(filename) == "" {
		return "audio"
	}
	return filename
}

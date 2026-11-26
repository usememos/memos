// Package openai implements stt.Transcriber against the OpenAI
// /audio/transcriptions endpoint (and any compatible third-party endpoint
// such as Groq Whisper, faster-whisper self-hosted, or Azure Whisper).
package openai

import (
	"context"
	"mime"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	"github.com/pkg/errors"

	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/stt"
)

// Transcriber implements stt.Transcriber for OpenAI-compatible STT endpoints.
type Transcriber struct {
	client openaisdk.Client
}

// New constructs a Transcriber from a provider config.
func New(cfg ai.ProviderConfig, options stt.Options) (*Transcriber, error) {
	client, err := ai.NewOpenAIClient(cfg, options.HTTPClient)
	if err != nil {
		return nil, err
	}
	return &Transcriber{client: client}, nil
}

// Transcribe sends the audio to /audio/transcriptions.
func (t *Transcriber) Transcribe(ctx context.Context, req stt.Request) (*stt.Response, error) {
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if req.Audio == nil {
		return nil, errors.New("audio is required")
	}

	filename, contentType, err := normalizeAudioMetadata(req)
	if err != nil {
		return nil, err
	}

	params := openaisdk.AudioTranscriptionNewParams{
		File:  openaisdk.File(req.Audio, filename, contentType),
		Model: openaisdk.AudioModel(req.Model),
	}
	if req.Prompt != "" {
		params.Prompt = openaisdk.String(req.Prompt)
	}
	if params.Model == openaisdk.AudioModelGPTTranscribe {
		if req.Language != "" {
			params.Languages = []string{req.Language}
		}
	} else {
		params.ResponseFormat = openaisdk.AudioResponseFormatJSON
		if req.Language != "" {
			params.Language = openaisdk.String(req.Language)
		}
	}

	resp, err := t.client.Audio.Transcriptions.New(ctx, params, ai.RequestOptions(ctx)...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send OpenAI transcription request")
	}
	language := resp.Language
	if len(resp.Languages) == 1 {
		language = resp.Languages[0].Code
	}
	return &stt.Response{
		Text:     resp.Text,
		Language: language,
	}, nil
}

func normalizeAudioMetadata(req stt.Request) (string, string, error) {
	filename := strings.TrimSpace(req.Filename)
	if filename == "" {
		filename = "audio"
	}
	contentType := strings.TrimSpace(req.ContentType)
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

// Package openai implements stt.Transcriber against the OpenAI
// /audio/transcriptions endpoint (and any compatible third-party endpoint
// such as Groq Whisper, faster-whisper self-hosted, or Azure Whisper).
package openai

import (
	"context"
	"mime"
	"net/url"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	openaioption "github.com/openai/openai-go/v3/option"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/stt"
)

const defaultEndpoint = "https://api.openai.com/v1"

// Transcriber implements stt.Transcriber for OpenAI-compatible STT endpoints.
type Transcriber struct {
	client openaisdk.Client
}

// New constructs a Transcriber from a provider config.
func New(cfg ai.ProviderConfig, options stt.Options) (*Transcriber, error) {
	endpoint, err := normalizeEndpoint(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	if cfg.APIKey == "" {
		return nil, errors.New("OpenAI API key is required")
	}
	return &Transcriber{
		client: openaisdk.NewClient(
			openaioption.WithAPIKey(cfg.APIKey),
			openaioption.WithBaseURL(endpoint),
			openaioption.WithHTTPClient(options.HTTPClient),
		),
	}, nil
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
		File:           openaisdk.File(req.Audio, filename, contentType),
		Model:          openaisdk.AudioModel(req.Model),
		ResponseFormat: openaisdk.AudioResponseFormatJSON,
	}
	if req.Prompt != "" {
		params.Prompt = openaisdk.String(req.Prompt)
	}
	if req.Language != "" {
		params.Language = openaisdk.String(req.Language)
	}

	resp, err := t.client.Audio.Transcriptions.New(ctx, params)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send OpenAI transcription request")
	}
	return &stt.Response{
		Text:     resp.Text,
		Language: resp.Language,
	}, nil
}

func normalizeEndpoint(endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", errors.Wrap(err, "invalid OpenAI endpoint")
	}
	return strings.TrimRight(endpoint, "/"), nil
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

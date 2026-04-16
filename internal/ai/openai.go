package ai

import (
	"context"
	"mime"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	openaioption "github.com/openai/openai-go/v3/option"
	"github.com/pkg/errors"
)

const defaultOpenAIEndpoint = "https://api.openai.com/v1"

type openAITranscriber struct {
	client openaisdk.Client
}

func newOpenAITranscriber(config ProviderConfig, options transcriberOptions) (*openAITranscriber, error) {
	endpoint, err := normalizeEndpoint(config.Endpoint, defaultOpenAIEndpoint, "OpenAI")
	if err != nil {
		return nil, err
	}
	if err := requireAPIKey(config.APIKey, "OpenAI"); err != nil {
		return nil, err
	}

	return &openAITranscriber{
		client: openaisdk.NewClient(
			openaioption.WithAPIKey(config.APIKey),
			openaioption.WithBaseURL(endpoint),
			openaioption.WithHTTPClient(options.httpClient),
		),
	}, nil
}

// Transcribe transcribes audio with the OpenAI /audio/transcriptions endpoint.
func (t *openAITranscriber) Transcribe(ctx context.Context, request TranscribeRequest) (*TranscribeResponse, error) {
	if strings.TrimSpace(request.Model) == "" {
		return nil, errors.New("model is required")
	}
	if request.Audio == nil {
		return nil, errors.New("audio is required")
	}

	filename, contentType, err := normalizeOpenAIAudioFileMetadata(request)
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
		return nil, errors.Wrap(err, "failed to send OpenAI transcription request")
	}
	return &TranscribeResponse{
		Text:     response.Text,
		Language: response.Language,
		Duration: response.Duration,
	}, nil
}

func normalizeOpenAIAudioFileMetadata(request TranscribeRequest) (string, string, error) {
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

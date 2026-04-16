package ai

import (
	"context"
	"io"
	"mime"
	"net/url"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/genai"
)

const (
	defaultGeminiEndpoint     = "https://generativelanguage.googleapis.com/v1beta"
	geminiTranscriptionPrompt = `Transcribe the audio accurately. Return only the transcript text. Do not summarize, explain, or add content that is not spoken.`
	maxGeminiInlineAudioSize  = 14 * 1024 * 1024
	defaultGeminiAPIVersion   = "v1beta"
	geminiProviderDisplayName = "Gemini"
	geminiDefaultTemperature  = float32(0)
)

var geminiSupportedContentTypes = map[string]string{
	"audio/wav":    "audio/wav",
	"audio/x-wav":  "audio/wav",
	"audio/mp3":    "audio/mp3",
	"audio/mpeg":   "audio/mp3",
	"audio/aiff":   "audio/aiff",
	"audio/aac":    "audio/aac",
	"audio/ogg":    "audio/ogg",
	"audio/flac":   "audio/flac",
	"audio/x-flac": "audio/flac",
}

type geminiTranscriber struct {
	client *genai.Client
}

func newGeminiTranscriber(config ProviderConfig, options transcriberOptions) (*geminiTranscriber, error) {
	endpoint, err := normalizeEndpoint(config.Endpoint, defaultGeminiEndpoint, geminiProviderDisplayName)
	if err != nil {
		return nil, err
	}
	if err := requireAPIKey(config.APIKey, geminiProviderDisplayName); err != nil {
		return nil, err
	}
	baseURL, apiVersion, err := normalizeGeminiEndpoint(endpoint)
	if err != nil {
		return nil, err
	}
	httpOptions := genai.HTTPOptions{
		BaseURL:    baseURL,
		APIVersion: apiVersion,
	}
	if options.httpClient.Timeout > 0 {
		timeout := options.httpClient.Timeout
		httpOptions.Timeout = &timeout
	}

	client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey:      config.APIKey,
		Backend:     genai.BackendGeminiAPI,
		HTTPClient:  options.httpClient,
		HTTPOptions: httpOptions,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Gemini client")
	}
	return &geminiTranscriber{client: client}, nil
}

// Transcribe transcribes audio with Gemini generateContent.
func (t *geminiTranscriber) Transcribe(ctx context.Context, request TranscribeRequest) (*TranscribeResponse, error) {
	if strings.TrimSpace(request.Model) == "" {
		return nil, errors.New("model is required")
	}
	if request.Audio == nil {
		return nil, errors.New("audio is required")
	}
	audio, err := io.ReadAll(request.Audio)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read audio")
	}
	if len(audio) == 0 {
		return nil, errors.New("audio is required")
	}
	if len(audio) > maxGeminiInlineAudioSize {
		return nil, errors.Errorf("audio is too large for Gemini inline transcription; maximum size is %d bytes", maxGeminiInlineAudioSize)
	}

	contentType, err := normalizeGeminiContentType(request.ContentType)
	if err != nil {
		return nil, err
	}
	prompt := buildGeminiTranscriptionPrompt(request.Prompt, request.Language)
	temperature := geminiDefaultTemperature
	response, err := t.client.Models.GenerateContent(ctx, normalizeGeminiModelName(request.Model), []*genai.Content{
		genai.NewContentFromParts([]*genai.Part{
			genai.NewPartFromBytes(audio, contentType),
			genai.NewPartFromText(prompt),
		}, genai.RoleUser),
	}, &genai.GenerateContentConfig{
		Temperature: &temperature,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to send Gemini transcription request")
	}
	text := strings.TrimSpace(response.Text())
	if text == "" {
		return nil, errors.New("Gemini transcription response did not include text")
	}
	return &TranscribeResponse{
		Text: text,
	}, nil
}

func normalizeGeminiEndpoint(endpoint string) (string, string, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", "", errors.Wrap(err, "invalid Gemini endpoint")
	}
	path := strings.TrimRight(parsed.Path, "/")
	apiVersion := defaultGeminiAPIVersion
	for _, supportedVersion := range []string{"v1alpha", "v1beta", "v1"} {
		if path == "/"+supportedVersion || strings.HasSuffix(path, "/"+supportedVersion) {
			apiVersion = supportedVersion
			parsed.Path = strings.TrimSuffix(path, "/"+supportedVersion)
			break
		}
	}
	return strings.TrimRight(parsed.String(), "/"), apiVersion, nil
}

func normalizeGeminiContentType(contentType string) (string, error) {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(contentType))
	if err != nil {
		return "", errors.Wrap(err, "invalid audio content type")
	}
	mediaType = strings.ToLower(mediaType)
	normalized, ok := geminiSupportedContentTypes[mediaType]
	if !ok {
		return "", errors.Errorf("audio content type %q is not supported by Gemini", mediaType)
	}
	return normalized, nil
}

func buildGeminiTranscriptionPrompt(prompt string, language string) string {
	parts := []string{geminiTranscriptionPrompt}
	language = strings.TrimSpace(language)
	if language != "" {
		parts = append(parts, "The input language is "+language+".")
	}
	prompt = strings.TrimSpace(prompt)
	if prompt != "" {
		parts = append(parts, "Context and spelling hints:\n"+prompt)
	}
	return strings.Join(parts, "\n\n")
}

func normalizeGeminiModelName(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}

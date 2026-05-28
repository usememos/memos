// Package gemini implements audiollm.Model against the Gemini generateContent
// endpoint. Used by Memos transcription when the user picks a Gemini provider:
// the handler issues a transcription instruction via audiollm.Request.Instructions.
package gemini

import (
	"context"
	"io"
	"mime"
	"net/url"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/genai"

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/audio"
	"github.com/usememos/memos/internal/ai/audiollm"
)

const (
	defaultEndpoint   = "https://generativelanguage.googleapis.com/v1beta"
	defaultAPIVersion = "v1beta"
	maxInlineSize     = 14 * 1024 * 1024
	providerName      = "Gemini"
)

var supportedContentTypes = map[string]string{
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

// Model implements audiollm.Model for Gemini generateContent.
type Model struct {
	client *genai.Client
}

// New constructs a Model from a provider config.
func New(cfg ai.ProviderConfig, options audiollm.Options) (*Model, error) {
	endpoint, err := normalizeEndpoint(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	if cfg.APIKey == "" {
		return nil, errors.Errorf("%s API key is required", providerName)
	}
	baseURL, apiVersion, err := splitEndpoint(endpoint)
	if err != nil {
		return nil, err
	}
	httpOptions := genai.HTTPOptions{BaseURL: baseURL, APIVersion: apiVersion}
	if options.HTTPClient != nil && options.HTTPClient.Timeout > 0 {
		timeout := options.HTTPClient.Timeout
		httpOptions.Timeout = &timeout
	}
	client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey:      cfg.APIKey,
		Backend:     genai.BackendGeminiAPI,
		HTTPClient:  options.HTTPClient,
		HTTPOptions: httpOptions,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Gemini client")
	}
	return &Model{client: client}, nil
}

// GenerateFromAudio calls Gemini generateContent with the audio attached.
func (m *Model) GenerateFromAudio(ctx context.Context, req audiollm.Request) (*audiollm.Response, error) {
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if req.Audio == nil {
		return nil, errors.New("audio is required")
	}
	if strings.TrimSpace(req.Instructions) == "" {
		return nil, errors.New("instructions are required")
	}

	audioBytes, err := io.ReadAll(req.Audio)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read audio")
	}
	if len(audioBytes) == 0 {
		return nil, errors.New("audio is required")
	}

	contentType := req.ContentType
	if audio.IsWebMContentType(contentType) {
		wav, err := audio.WebMOpusToWAV(audioBytes)
		if err != nil {
			return nil, errors.Wrap(err, "failed to transcode webm audio for Gemini")
		}
		audioBytes = wav
		contentType = "audio/wav"
	}

	if len(audioBytes) > maxInlineSize {
		return nil, errors.Errorf("audio is too large for Gemini inline request; maximum size is %d bytes", maxInlineSize)
	}

	contentType, err = normalizeContentType(contentType)
	if err != nil {
		return nil, err
	}

	cfg := &genai.GenerateContentConfig{}
	if req.Temperature != nil {
		t := *req.Temperature
		cfg.Temperature = &t
	}

	resp, err := m.client.Models.GenerateContent(ctx, normalizeModelName(req.Model), []*genai.Content{
		genai.NewContentFromParts([]*genai.Part{
			genai.NewPartFromBytes(audioBytes, contentType),
			genai.NewPartFromText(req.Instructions),
		}, genai.RoleUser),
	}, cfg)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send Gemini request")
	}

	return &audiollm.Response{
		Text:         strings.TrimSpace(resp.Text()),
		FinishReason: mapFinishReason(resp),
	}, nil
}

func mapFinishReason(resp *genai.GenerateContentResponse) audiollm.FinishReason {
	if resp == nil || len(resp.Candidates) == 0 {
		return audiollm.FinishOther
	}
	switch resp.Candidates[0].FinishReason {
	case genai.FinishReasonStop:
		return audiollm.FinishStop
	case genai.FinishReasonMaxTokens:
		return audiollm.FinishLength
	case genai.FinishReasonSafety,
		genai.FinishReasonRecitation,
		genai.FinishReasonProhibitedContent,
		genai.FinishReasonSPII,
		genai.FinishReasonBlocklist,
		genai.FinishReasonImageSafety,
		genai.FinishReasonImageProhibitedContent,
		genai.FinishReasonImageRecitation:
		return audiollm.FinishSafety
	default:
		return audiollm.FinishOther
	}
}

func normalizeEndpoint(endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", errors.Wrapf(err, "invalid %s endpoint", providerName)
	}
	return strings.TrimRight(endpoint, "/"), nil
}

func splitEndpoint(endpoint string) (string, string, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", "", errors.Wrap(err, "invalid Gemini endpoint")
	}
	path := strings.TrimRight(parsed.Path, "/")
	apiVersion := defaultAPIVersion
	for _, supported := range []string{"v1alpha", "v1beta", "v1"} {
		if path == "/"+supported || strings.HasSuffix(path, "/"+supported) {
			apiVersion = supported
			parsed.Path = strings.TrimSuffix(path, "/"+supported)
			break
		}
	}
	return strings.TrimRight(parsed.String(), "/"), apiVersion, nil
}

func normalizeContentType(contentType string) (string, error) {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(contentType))
	if err != nil {
		return "", errors.Wrap(err, "invalid audio content type")
	}
	mediaType = strings.ToLower(mediaType)
	normalized, ok := supportedContentTypes[mediaType]
	if !ok {
		return "", errors.Errorf("audio content type %q is not supported by Gemini", mediaType)
	}
	return normalized, nil
}

func normalizeModelName(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}

package openai

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	openaisdk "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

const defaultEndpoint = "https://api.openai.com/v1"

// Transcriber transcribes audio with OpenAI-compatible transcription APIs.
type Transcriber struct {
	client     openaisdk.Client
	httpClient *http.Client
}

// NewTranscriber creates a new OpenAI-compatible transcriber.
func NewTranscriber(config ai.ProviderConfig, options ...Option) (*Transcriber, error) {
	endpoint := strings.TrimSpace(config.Endpoint)
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return nil, errors.Wrap(err, "invalid OpenAI endpoint")
	}
	if config.APIKey == "" {
		return nil, errors.New("OpenAI API key is required")
	}

	transcriber := &Transcriber{
		httpClient: &http.Client{
			Timeout: 2 * time.Minute,
		},
	}
	for _, applyOption := range options {
		applyOption(transcriber)
	}
	transcriber.client = openaisdk.NewClient(
		option.WithAPIKey(config.APIKey),
		option.WithBaseURL(strings.TrimRight(endpoint, "/")),
		option.WithHTTPClient(transcriber.httpClient),
	)
	return transcriber, nil
}

// Option configures a Transcriber.
type Option func(*Transcriber)

// WithHTTPClient sets the HTTP client used by the transcriber.
func WithHTTPClient(client *http.Client) Option {
	return func(t *Transcriber) {
		if client != nil {
			t.httpClient = client
		}
	}
}

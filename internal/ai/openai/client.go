package openai

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

const defaultEndpoint = "https://api.openai.com/v1"

// Transcriber transcribes audio with OpenAI-compatible transcription APIs.
type Transcriber struct {
	endpoint   string
	apiKey     string
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
		endpoint: endpoint,
		apiKey:   config.APIKey,
		httpClient: &http.Client{
			Timeout: 2 * time.Minute,
		},
	}
	for _, option := range options {
		option(transcriber)
	}
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

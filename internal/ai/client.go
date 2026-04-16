package ai

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pkg/errors"
)

const defaultHTTPTimeout = 2 * time.Minute

type transcriberOptions struct {
	httpClient *http.Client
}

// TranscriberOption configures a transcriber.
type TranscriberOption func(*transcriberOptions)

// WithHTTPClient sets the HTTP client used by a transcriber.
func WithHTTPClient(client *http.Client) TranscriberOption {
	return func(options *transcriberOptions) {
		if client != nil {
			options.httpClient = client
		}
	}
}

// NewTranscriber creates a transcriber for a provider.
func NewTranscriber(config ProviderConfig, options ...TranscriberOption) (Transcriber, error) {
	transcriberOptions := transcriberOptions{
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
	}
	for _, applyOption := range options {
		applyOption(&transcriberOptions)
	}

	switch config.Type {
	case ProviderOpenAI:
		return newOpenAITranscriber(config, transcriberOptions)
	case ProviderGemini:
		return newGeminiTranscriber(config, transcriberOptions)
	default:
		return nil, errors.Wrapf(ErrCapabilityUnsupported, "provider type %q", config.Type)
	}
}

func normalizeEndpoint(endpoint string, defaultEndpoint string, providerName string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", errors.Wrapf(err, "invalid %s endpoint", providerName)
	}
	return strings.TrimRight(endpoint, "/"), nil
}

func requireAPIKey(apiKey string, providerName string) error {
	if apiKey == "" {
		return errors.Errorf("%s API key is required", providerName)
	}
	return nil
}

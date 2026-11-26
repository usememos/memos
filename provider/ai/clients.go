package ai

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/pkg/errors"
	"google.golang.org/genai"
)

// ErrRedirected is returned when a provider endpoint answers with a redirect.
var ErrRedirected = errors.New("provider endpoint redirected the request")

// NewHTTPClient returns the client every provider call uses. A zero timeout
// leaves the deadline to the request context.
//
// It refuses redirects. Go forwards custom key headers such as x-goog-api-key
// to the redirect target, and Authorization to subdomains, so following one
// could hand the key to a host the administrator never configured.
func NewHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:       timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return ErrRedirected },
	}
}

type singleAttemptKey struct{}

// WithSingleAttempt marks calls under ctx as interactive checks: the SDK makes
// one request instead of retrying, so a refusal is reported at once and a
// sample is uploaded once.
func WithSingleAttempt(ctx context.Context) context.Context {
	return context.WithValue(ctx, singleAttemptKey{}, true)
}

// RequestOptions returns the per-request OpenAI SDK options that ctx asks for.
func RequestOptions(ctx context.Context) []option.RequestOption {
	if single, ok := ctx.Value(singleAttemptKey{}).(bool); ok && single {
		return []option.RequestOption{option.WithMaxRetries(0)}
	}
	return nil
}

// ValidateEndpoint reports whether a provider endpoint is a usable http(s) URL.
// An empty endpoint is valid: it selects the provider's public API.
func ValidateEndpoint(endpoint string) error {
	if strings.TrimSpace(endpoint) == "" {
		return nil
	}
	_, err := providerEndpoint(endpoint, "")
	return err
}

func providerEndpoint(endpoint, fallback string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = fallback
	}
	parsed, err := url.ParseRequestURI(endpoint)
	if err != nil {
		return "", errors.Wrap(err, "invalid provider endpoint")
	}
	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", errors.New("invalid provider endpoint: use an http or https URL")
	}
	return strings.TrimRight(endpoint, "/"), nil
}

// NewOpenAIClient connects to an OpenAI-compatible endpoint using the configured key.
func NewOpenAIClient(cfg ProviderConfig, client *http.Client) (openai.Client, error) {
	endpoint, err := providerEndpoint(cfg.Endpoint, defaultOpenAIEndpoint)
	if err != nil {
		return openai.Client{}, err
	}
	if cfg.APIKey == "" {
		return openai.Client{}, errors.New("OpenAI API key is required")
	}
	return openai.NewClient(option.WithAPIKey(cfg.APIKey), option.WithBaseURL(endpoint), option.WithHTTPClient(client)), nil
}

// NewGeminiClient connects to Gemini using the API version from the configured endpoint.
func NewGeminiClient(ctx context.Context, cfg ProviderConfig, client *http.Client) (*genai.Client, error) {
	endpoint, err := providerEndpoint(cfg.Endpoint, defaultGeminiEndpoint)
	if err != nil {
		return nil, err
	}
	if cfg.APIKey == "" {
		return nil, errors.New("Gemini API key is required")
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return nil, errors.Wrap(err, "invalid Gemini endpoint")
	}
	version := "v1beta"
	for _, supported := range []string{"v1alpha", "v1beta", "v1"} {
		if prefix, ok := strings.CutSuffix(parsed.Path, "/"+supported); ok {
			parsed.Path = prefix
			version = supported
			break
		}
	}
	options := genai.HTTPOptions{BaseURL: strings.TrimRight(parsed.String(), "/"), APIVersion: version}
	if client != nil && client.Timeout > 0 {
		timeout := client.Timeout
		options.Timeout = &timeout
	}
	return genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:      cfg.APIKey,
		Backend:     genai.BackendGeminiAPI,
		HTTPClient:  client,
		HTTPOptions: options,
	})
}

// TestConnection reads the first page of models with the supplied credentials.
//
// It proves the endpoint answers and, on providers that authenticate the
// listing, that the key is accepted. It does not prove a model can be called.
func TestConnection(ctx context.Context, cfg ProviderConfig) error {
	client := NewHTTPClient(0)
	switch cfg.Type {
	case ProviderOpenAI:
		sdk, err := NewOpenAIClient(cfg, client)
		if err != nil {
			return err
		}
		page, err := sdk.Models.List(ctx, RequestOptions(ctx)...)
		if err == nil && (page == nil || page.Data == nil) {
			return errors.Wrap(ErrUnusableResponse, "missing model list")
		}
		return err
	case ProviderGemini:
		sdk, err := NewGeminiClient(ctx, cfg, client)
		if err != nil {
			return err
		}
		page, err := sdk.Models.List(ctx, &genai.ListModelsConfig{PageSize: 1})
		if err == nil && page.Items == nil {
			return errors.Wrap(ErrUnusableResponse, "missing model list")
		}
		return err
	default:
		return ErrCapabilityUnsupported
	}
}

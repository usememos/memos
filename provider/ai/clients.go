package ai

import (
	"context"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go/v2"
	anthropicoption "github.com/anthropics/anthropic-sdk-go/v2/option"
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

func singleAttempt(ctx context.Context) bool {
	single, ok := ctx.Value(singleAttemptKey{}).(bool)
	return ok && single
}

// RequestOptions returns the per-request OpenAI SDK options that ctx asks for.
func RequestOptions(ctx context.Context) []option.RequestOption {
	if singleAttempt(ctx) {
		return []option.RequestOption{option.WithMaxRetries(0)}
	}
	return nil
}

func anthropicRequestOptions(ctx context.Context) []anthropicoption.RequestOption {
	if singleAttempt(ctx) {
		return []anthropicoption.RequestOption{anthropicoption.WithMaxRetries(0)}
	}
	return nil
}

// ValidateEndpoint reports whether a provider endpoint is a usable http(s) URL.
// An empty endpoint is valid: it selects the type's default.
func ValidateEndpoint(endpoint string) error {
	if strings.TrimSpace(endpoint) == "" {
		return nil
	}
	_, err := providerEndpoint(endpoint)
	return err
}

func providerEndpoint(endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return "", errors.New("provider endpoint is required")
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

// NewOpenAIClient connects to an OpenAI-compatible endpoint with the configured key.
//
// The SDK applies OPENAI_* variables from the server's environment to every
// client. Those belong to whatever else runs on the host, not to the endpoint an
// administrator configured here, so the key and organization are set explicitly
// and environment headers are stripped from each request.
func NewOpenAIClient(cfg ProviderConfig, client *http.Client) (openai.Client, error) {
	endpoint, err := providerEndpoint(cfg.Endpoint)
	if err != nil {
		return openai.Client{}, err
	}
	return openai.NewClient(
		option.WithBaseURL(endpoint),
		option.WithHTTPClient(client),
		option.WithAPIKey(cfg.APIKey),
		option.WithAdminAPIKey(""),
		option.WithMiddleware(stripEnvironmentHeaders(cfg.APIKey == "")),
	), nil
}

// stripEnvironmentHeaders removes the headers the OpenAI SDK adds from
// OPENAI_ORG_ID, OPENAI_PROJECT_ID and OPENAI_CUSTOM_HEADERS. Without a
// configured key, no Authorization header is sent at all.
func stripEnvironmentHeaders(keyless bool) option.Middleware {
	names := []string{"OpenAI-Organization", "OpenAI-Project"}
	if keyless {
		names = append(names, "Authorization")
	}
	for line := range strings.SplitSeq(os.Getenv("OPENAI_CUSTOM_HEADERS"), "\n") {
		// A configured key is the Authorization header; the SDK sets it after the environment's.
		if name, _, ok := strings.Cut(line, ":"); ok && strings.TrimSpace(name) != "" && !strings.EqualFold(strings.TrimSpace(name), "Authorization") {
			names = append(names, strings.TrimSpace(name))
		}
	}
	return func(req *http.Request, next option.MiddlewareNext) (*http.Response, error) {
		for _, name := range names {
			req.Header.Del(name)
		}
		return next(req)
	}
}

// NewAnthropicClient connects to an Anthropic Messages endpoint with the
// configured key, ignoring the ANTHROPIC_* environment and stored CLI profiles.
func NewAnthropicClient(cfg ProviderConfig, client *http.Client) (anthropic.Client, error) {
	endpoint, err := providerEndpoint(cfg.Endpoint)
	if err != nil {
		return anthropic.Client{}, err
	}
	opts := []anthropicoption.RequestOption{
		anthropicoption.WithoutEnvironmentDefaults(),
		anthropicoption.WithBaseURL(endpoint),
		anthropicoption.WithHTTPClient(client),
	}
	if cfg.APIKey != "" {
		// Anthropic accepts the key as a bearer token; services that copy the
		// Messages API often read only x-api-key, so send both.
		opts = append(opts, anthropicoption.WithAPIKey(cfg.APIKey), anthropicoption.WithHeader("x-api-key", cfg.APIKey))
	}
	return anthropic.NewClient(opts...), nil
}

// NewGeminiClient connects to Gemini using the API version from the configured endpoint.
func NewGeminiClient(ctx context.Context, cfg ProviderConfig, client *http.Client) (*genai.Client, error) {
	endpoint, err := providerEndpoint(cfg.Endpoint)
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

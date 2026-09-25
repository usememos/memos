// Package gemini implements chat.Completer against the Gemini generateContent
// endpoint. The assistant instruction is sent as a system instruction so the
// model treats it as behavior configuration rather than user content.
package gemini

import (
	"context"
	"net/url"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/genai"

	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
)

const (
	defaultEndpoint   = "https://generativelanguage.googleapis.com/v1beta"
	defaultAPIVersion = "v1beta"
	providerName      = "Gemini"
)

// Completer implements chat.Completer for Gemini generateContent.
type Completer struct {
	client *genai.Client
}

// New constructs a Completer from a provider config.
func New(cfg ai.ProviderConfig, options chat.Options) (*Completer, error) {
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
		return nil, errors.Wrapf(err, "failed to create %s client", providerName)
	}
	return &Completer{client: client}, nil
}

// Complete calls Gemini generateContent with the input as user content.
func (c *Completer) Complete(ctx context.Context, req chat.Request) (*chat.Response, error) {
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if strings.TrimSpace(req.Input) == "" {
		return nil, errors.New("input is required")
	}

	cfg := &genai.GenerateContentConfig{}
	if instructions := strings.TrimSpace(req.Instructions); instructions != "" {
		cfg.SystemInstruction = genai.NewContentFromText(instructions, genai.RoleUser)
	}
	if req.MaxTokens > 0 {
		cfg.MaxOutputTokens = int32(req.MaxTokens)
	}
	if req.Temperature != nil {
		temperature := float32(*req.Temperature)
		cfg.Temperature = &temperature
	}

	resp, err := c.client.Models.GenerateContent(ctx, normalizeModelName(req.Model), []*genai.Content{
		genai.NewContentFromText(req.Input, genai.RoleUser),
	}, cfg)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to send %s request", providerName)
	}

	return &chat.Response{
		Text:         strings.TrimSpace(resp.Text()),
		FinishReason: mapFinishReason(resp),
	}, nil
}

func mapFinishReason(resp *genai.GenerateContentResponse) chat.FinishReason {
	if resp == nil || len(resp.Candidates) == 0 {
		return chat.FinishOther
	}
	switch resp.Candidates[0].FinishReason {
	case genai.FinishReasonStop:
		return chat.FinishStop
	case genai.FinishReasonMaxTokens:
		return chat.FinishLength
	default:
		return chat.FinishOther
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
		return "", "", errors.Wrapf(err, "invalid %s endpoint", providerName)
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

func normalizeModelName(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}

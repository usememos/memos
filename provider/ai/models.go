package ai

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/pkg/errors"
	"google.golang.org/genai"
)

// maxListedModels bounds a model listing, so a catalog the size of
// OpenRouter's stays a list a person can pick from.
const maxListedModels = 2000

// ListModels returns the model identifiers a provider reports, sorted.
//
// A successful listing proves the endpoint answers and, on providers that
// authenticate the listing, that the key is accepted. It does not prove a
// model can be called.
func ListModels(ctx context.Context, cfg ProviderConfig) ([]string, error) {
	// An unknown type has no protocol and ends in the default case.
	spec, _ := LookupSpec(cfg.Type)
	client := NewHTTPClient(0)
	var models []string
	switch spec.Protocol {
	case ProtocolOpenAI:
		sdk, err := NewOpenAIClient(cfg, client)
		if err != nil {
			return nil, err
		}
		page, err := sdk.Models.List(ctx, RequestOptions(ctx)...)
		if err != nil {
			return nil, err
		}
		if page == nil || page.Data == nil {
			return nil, errors.Wrap(ErrUnusableResponse, "missing model list")
		}
		for _, model := range page.Data {
			models = append(models, model.ID)
		}
	case ProtocolGemini:
		sdk, err := NewGeminiClient(ctx, cfg, client)
		if err != nil {
			return nil, err
		}
		page, err := sdk.Models.List(ctx, &genai.ListModelsConfig{PageSize: 1000})
		for ; err == nil; page, err = page.Next(ctx) {
			if page.Items == nil && len(models) == 0 {
				return nil, errors.Wrap(ErrUnusableResponse, "missing model list")
			}
			for _, model := range page.Items {
				// Embedding and other models cannot generate content.
				if model != nil && slices.Contains(model.SupportedActions, "generateContent") {
					models = append(models, strings.TrimPrefix(model.Name, "models/"))
				}
			}
			if len(models) >= maxListedModels {
				break
			}
		}
		if err != nil && !errors.Is(err, genai.ErrPageDone) {
			return nil, err
		}
	case ProtocolAnthropic:
		sdk, err := NewAnthropicClient(cfg, client)
		if err != nil {
			return nil, err
		}
		pager := sdk.Models.ListAutoPaging(ctx, anthropic.ModelListParams{Limit: anthropic.Int(1000)}, anthropicRequestOptions(ctx)...)
		for len(models) < maxListedModels && pager.Next() {
			models = append(models, pager.Current().ID)
		}
		if err := pager.Err(); err != nil {
			return nil, err
		}
	default:
		return nil, ErrCapabilityUnsupported
	}
	slices.Sort(models)
	models = slices.Compact(models)
	if len(models) > maxListedModels {
		models = models[:maxListedModels]
	}
	return models, nil
}

// ModelListUnavailable reports whether a failed listing says nothing about the
// key: an OpenAI project key can be allowed to call models but not to list them.
func ModelListUnavailable(cfg ProviderConfig, failure Failure) bool {
	return failure.Status == http.StatusForbidden && cfg.Type == ProviderOpenAI
}

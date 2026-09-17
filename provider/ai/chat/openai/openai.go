// Package openai implements chat.Chatter and chat.ModelLister against the
// OpenAI /chat/completions and /models endpoints. It also serves every
// OpenAI-compatible third-party endpoint, which is how OpenRouter and
// DeepInfra are supported without provider-specific code.
package openai

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	openaioption "github.com/openai/openai-go/v3/option"
	"github.com/pkg/errors"

	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
)

// Client talks to an OpenAI-compatible provider.
type Client struct {
	sdk      openaisdk.Client
	endpoint string
	apiKey   string
	headers  map[string]string
	http     *http.Client
}

// New constructs a Client from a provider config.
func New(cfg ai.ProviderConfig, options chat.Options) (*Client, error) {
	endpoint, err := ai.NormalizeEndpoint(cfg.Type, cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.APIKey) == "" {
		return nil, errors.New("AI provider API key is required")
	}

	sdkOptions := []openaioption.RequestOption{
		openaioption.WithAPIKey(cfg.APIKey),
		openaioption.WithBaseURL(endpoint),
		openaioption.WithHTTPClient(options.HTTPClient),
	}
	for name, value := range options.ExtraHeaders {
		sdkOptions = append(sdkOptions, openaioption.WithHeader(name, value))
	}

	httpClient := options.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		sdk:      openaisdk.NewClient(sdkOptions...),
		endpoint: endpoint,
		apiKey:   cfg.APIKey,
		headers:  options.ExtraHeaders,
		http:     httpClient,
	}, nil
}

// Chat runs one completion turn.
func (c *Client) Chat(ctx context.Context, req chat.Request) (*chat.Response, error) {
	model := strings.TrimSpace(req.Model)
	if model == "" {
		return nil, errors.New("model is required")
	}
	if len(req.Messages) == 0 {
		return nil, errors.New("at least one message is required")
	}

	params := openaisdk.ChatCompletionNewParams{
		Model:    model,
		Messages: toSDKMessages(req.Messages),
	}
	if req.MaxCompletionTokens > 0 {
		params.MaxCompletionTokens = openaisdk.Int(req.MaxCompletionTokens)
	}

	completion, err := c.sdk.Chat.Completions.New(ctx, params)
	if err != nil {
		return nil, wrapSDKError(err)
	}
	if len(completion.Choices) == 0 {
		return nil, errors.New("provider returned no choices")
	}

	choice := completion.Choices[0]
	return &chat.Response{
		Text:         choice.Message.Content,
		FinishReason: convertFinishReason(choice.FinishReason),
		Model:        completion.Model,
		Usage: chat.Usage{
			PromptTokens:     completion.Usage.PromptTokens,
			CompletionTokens: completion.Usage.CompletionTokens,
			TotalTokens:      completion.Usage.TotalTokens,
		},
	}, nil
}

// ListModels fetches the provider's model catalog. OpenRouter additionally
// reports each model's context window, which the Hub uses to seed the context
// budget default.
func (c *Client) ListModels(ctx context.Context) ([]chat.Model, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint+"/models", nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build model list request")
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Accept", "application/json")
	for name, value := range c.headers {
		request.Header.Set(name, value)
	}

	response, err := c.http.Do(request)
	if err != nil {
		return nil, errors.Wrap(err, "failed to reach provider model list endpoint")
	}
	defer func() {
		_ = response.Body.Close()
	}()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, newAPIError(response)
	}

	var payload modelListResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, errors.Wrap(err, "failed to decode provider model list")
	}

	models := make([]chat.Model, 0, len(payload.Data))
	for _, entry := range payload.Data {
		id := strings.TrimSpace(entry.ID)
		if id == "" {
			continue
		}
		models = append(models, chat.Model{ID: id, ContextLength: entry.ContextLength})
	}
	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	return models, nil
}

// modelListResponse covers both the OpenAI-shaped catalog and OpenRouter's
// extended entries. Unknown fields are ignored, so one struct serves both.
type modelListResponse struct {
	Data []struct {
		ID            string `json:"id"`
		ContextLength int64  `json:"context_length"`
	} `json:"data"`
}

func toSDKMessages(messages []chat.Message) []openaisdk.ChatCompletionMessageParamUnion {
	converted := make([]openaisdk.ChatCompletionMessageParamUnion, 0, len(messages))
	for _, message := range messages {
		switch message.Role {
		case chat.RoleSystem:
			converted = append(converted, openaisdk.SystemMessage(message.Content))
		case chat.RoleAssistant:
			converted = append(converted, openaisdk.AssistantMessage(message.Content))
		default:
			// Unknown roles are treated as user input rather than dropped, so a
			// malformed client cannot silently remove the user's question.
			converted = append(converted, openaisdk.UserMessage(message.Content))
		}
	}
	return converted
}

func convertFinishReason(reason string) chat.FinishReason {
	switch reason {
	case "stop":
		return chat.FinishStop
	case "length":
		return chat.FinishLength
	case "content_filter":
		return chat.FinishContentFilter
	case "tool_calls", "function_call":
		return chat.FinishToolCalls
	default:
		return chat.FinishOther
	}
}

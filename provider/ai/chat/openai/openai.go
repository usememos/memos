// Package openai implements chat.Completer against the OpenAI
// /chat/completions endpoint (and any compatible third-party endpoint such as
// DeepSeek, Moonshot, Groq, Together, or a self-hosted vLLM server).
package openai

import (
	"context"
	"net/url"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	openaioption "github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/packages/param"
	"github.com/pkg/errors"

	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
)

const defaultEndpoint = "https://api.openai.com/v1"

// Completer implements chat.Completer for OpenAI-compatible chat endpoints.
type Completer struct {
	client openaisdk.Client
}

// New constructs a Completer from a provider config.
func New(cfg ai.ProviderConfig, options chat.Options) (*Completer, error) {
	endpoint, err := normalizeEndpoint(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	if cfg.APIKey == "" {
		return nil, errors.New("OpenAI API key is required")
	}
	return &Completer{
		client: openaisdk.NewClient(
			openaioption.WithAPIKey(cfg.APIKey),
			openaioption.WithBaseURL(endpoint),
			openaioption.WithHTTPClient(options.HTTPClient),
		),
	}, nil
}

// Complete sends the instruction and input to /chat/completions.
func (c *Completer) Complete(ctx context.Context, req chat.Request) (*chat.Response, error) {
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if strings.TrimSpace(req.Input) == "" {
		return nil, errors.New("input is required")
	}

	messages := make([]openaisdk.ChatCompletionMessageParamUnion, 0, 2)
	if instructions := strings.TrimSpace(req.Instructions); instructions != "" {
		messages = append(messages, openaisdk.SystemMessage(instructions))
	}
	messages = append(messages, openaisdk.UserMessage(req.Input))

	params := openaisdk.ChatCompletionNewParams{
		Messages: messages,
		Model:    openaisdk.ChatModel(req.Model),
	}
	// max_tokens is deprecated upstream but remains the field most widely
	// understood by OpenAI-compatible third-party endpoints.
	if req.MaxTokens > 0 {
		params.MaxTokens = param.NewOpt(int64(req.MaxTokens))
	}
	if req.Temperature != nil {
		params.Temperature = param.NewOpt(*req.Temperature)
	}

	resp, err := c.client.Chat.Completions.New(ctx, params)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send OpenAI chat completion request")
	}
	if len(resp.Choices) == 0 {
		return nil, errors.New("chat completion response did not include any choice")
	}
	choice := resp.Choices[0]
	return &chat.Response{
		Text:         choice.Message.Content,
		FinishReason: convertFinishReason(choice.FinishReason),
	}, nil
}

func convertFinishReason(reason string) chat.FinishReason {
	switch reason {
	case "stop":
		return chat.FinishStop
	case "length":
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
		return "", errors.Wrap(err, "invalid OpenAI endpoint")
	}
	return strings.TrimRight(endpoint, "/"), nil
}

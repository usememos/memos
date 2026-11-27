package ai

import (
	"context"
	stderrors "errors"
	"net/http"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/shared"
	"github.com/pkg/errors"
	"google.golang.org/genai"
)

// anthropicMaxTokens is the output budget of an Anthropic call, which the
// Messages API requires. It is generous because current models think before
// they answer and the thinking counts against it; the client timeout bounds
// the call instead.
const anthropicMaxTokens = 16000

// generateJSON requests a JSON object from the configured text model and
// returns the object's text.
//
// Output is not capped by tokens where the protocol allows it: reasoning models
// spend their reasoning against such a cap and would stop before answering, and
// a cap above a model's own limit is refused. The client timeout bounds the
// call instead.
func generateJSON(ctx context.Context, cfg ProviderConfig, model, instruction, input string, schema map[string]any) (string, error) {
	// An unknown type has no protocol and ends in the default case.
	spec, _ := LookupSpec(cfg.Type)
	client := NewHTTPClient(45 * time.Second)
	var (
		raw string
		err error
	)
	switch spec.Protocol {
	case ProtocolOpenAI:
		raw, err = generateOpenAIJSON(ctx, cfg, client, model, instruction, input, true)
		if err != nil && spec.LenientJSON && refusedRequest(err) {
			raw, err = generateOpenAIJSON(ctx, cfg, client, model, instruction, input, false)
		}
	case ProtocolGemini:
		raw, err = generateGeminiJSON(ctx, cfg, client, model, instruction, input)
	case ProtocolAnthropic:
		raw, err = generateAnthropicJSON(ctx, cfg, client, model, instruction, input, schema)
		if err != nil && spec.LenientJSON && refusedRequest(err) {
			raw, err = generateAnthropicJSON(ctx, cfg, client, model, instruction, input, nil)
		}
	default:
		return "", errors.Wrap(ErrCapabilityUnsupported, "text generation")
	}
	if err != nil {
		return "", err
	}
	object, ok := extractJSONObject(raw)
	if !ok {
		return "", errors.Wrap(ErrUnusableResponse, "response is not a JSON object")
	}
	return object, nil
}

func generateOpenAIJSON(ctx context.Context, cfg ProviderConfig, client *http.Client, model, instruction, input string, jsonMode bool) (string, error) {
	sdk, err := NewOpenAIClient(cfg, client)
	if err != nil {
		return "", err
	}
	params := openai.ChatCompletionNewParams{
		Model:    model,
		Messages: []openai.ChatCompletionMessageParamUnion{openai.SystemMessage(instruction), openai.UserMessage(input)},
	}
	if jsonMode {
		params.ResponseFormat = openai.ChatCompletionNewParamsResponseFormatUnion{OfJSONObject: &shared.ResponseFormatJSONObjectParam{}}
	}
	resp, err := sdk.Chat.Completions.New(ctx, params, RequestOptions(ctx)...)
	if err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].FinishReason != "stop" {
		return "", errors.Wrap(ErrUnusableResponse, "incomplete text generation")
	}
	return resp.Choices[0].Message.Content, nil
}

func generateGeminiJSON(ctx context.Context, cfg ProviderConfig, client *http.Client, model, instruction, input string) (string, error) {
	sdk, err := NewGeminiClient(ctx, cfg, client)
	if err != nil {
		return "", err
	}
	resp, err := sdk.Models.GenerateContent(ctx, strings.TrimPrefix(model, "models/"), genai.Text(input), &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(instruction, genai.RoleUser),
		ResponseMIMEType:  "application/json",
	})
	if err != nil {
		return "", err
	}
	if len(resp.Candidates) == 0 || resp.Candidates[0] == nil || resp.Candidates[0].FinishReason != genai.FinishReasonStop {
		return "", errors.Wrap(ErrUnusableResponse, "incomplete text generation")
	}
	return resp.Text(), nil
}

// generateAnthropicJSON calls the Messages API. A schema turns on structured
// outputs, which constrain the reply to it.
func generateAnthropicJSON(ctx context.Context, cfg ProviderConfig, client *http.Client, model, instruction, input string, schema map[string]any) (string, error) {
	sdk, err := NewAnthropicClient(cfg, client)
	if err != nil {
		return "", err
	}
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(model),
		MaxTokens: anthropicMaxTokens,
		System:    []anthropic.TextBlockParam{{Text: instruction}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(input))},
	}
	if schema != nil {
		params.OutputConfig = anthropic.OutputConfigParam{Format: anthropic.JSONOutputFormatParam{Schema: schema}}
	}
	resp, err := sdk.Messages.New(ctx, params, anthropicRequestOptions(ctx)...)
	if err != nil {
		return "", err
	}
	if resp.StopReason != anthropic.StopReasonEndTurn {
		return "", errors.Wrap(ErrUnusableResponse, "incomplete text generation")
	}
	var text strings.Builder
	for _, block := range resp.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	return text.String(), nil
}

// refusedRequest reports whether a provider refused the request itself, which
// is what a server that does not support a structured-output parameter answers.
func refusedRequest(err error) bool {
	if e, ok := stderrors.AsType[*openai.Error](err); ok {
		return e.StatusCode == http.StatusBadRequest || e.StatusCode == http.StatusUnprocessableEntity
	}
	if e, ok := stderrors.AsType[*anthropic.Error](err); ok {
		return e.StatusCode == http.StatusBadRequest || e.StatusCode == http.StatusUnprocessableEntity
	}
	return false
}

// extractJSONObject returns the JSON object in a reply. Models without a JSON
// mode often wrap it in a Markdown code fence or a sentence.
func extractJSONObject(text string) (string, bool) {
	start := strings.IndexByte(text, '{')
	end := strings.LastIndexByte(text, '}')
	if start < 0 || end < start {
		return "", false
	}
	return text[start : end+1], true
}

package ai

import (
	"context"
	"strings"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/shared"
	"github.com/pkg/errors"
	"google.golang.org/genai"
)

// generateJSON requests a JSON object from the configured text model.
//
// Output is not capped by tokens: reasoning models spend their reasoning against
// such a cap and would stop before answering, and a cap above a model's own limit
// is refused. The client timeout bounds the call instead.
func generateJSON(ctx context.Context, cfg ProviderConfig, model, instruction, input string) (string, error) {
	client := NewHTTPClient(45 * time.Second)
	switch cfg.Type {
	case ProviderOpenAI:
		sdk, err := NewOpenAIClient(cfg, client)
		if err != nil {
			return "", err
		}
		resp, err := sdk.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
			Model:          model,
			Messages:       []openai.ChatCompletionMessageParamUnion{openai.SystemMessage(instruction), openai.UserMessage(input)},
			ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{OfJSONObject: &shared.ResponseFormatJSONObjectParam{}},
		}, RequestOptions(ctx)...)
		if err != nil {
			return "", err
		}
		if len(resp.Choices) == 0 || resp.Choices[0].FinishReason != "stop" {
			return "", errors.Wrap(ErrUnusableResponse, "incomplete text generation")
		}
		return resp.Choices[0].Message.Content, nil
	case ProviderGemini:
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
	default:
		return "", errors.Wrap(ErrCapabilityUnsupported, "text generation")
	}
}

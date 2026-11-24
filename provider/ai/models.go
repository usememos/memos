package ai

import (
	"net/url"
	"strings"

	"github.com/pkg/errors"
)

const (
	// DefaultOpenAITranscriptionModel is the built-in OpenAI transcription model.
	DefaultOpenAITranscriptionModel = "gpt-transcribe"
	// DefaultGeminiTranscriptionModel is the built-in Gemini transcription model.
	DefaultGeminiTranscriptionModel = "gemini-2.5-flash"
)

// DefaultTranscriptionModel returns the built-in transcription model for a provider.
func DefaultTranscriptionModel(provider ProviderConfig) (string, error) {
	switch provider.Type {
	case ProviderOpenAI:
		// Custom OpenAI-compatible endpoints historically default to Whisper.
		if endpoint := strings.TrimSpace(provider.Endpoint); endpoint != "" {
			u, err := url.Parse(endpoint)
			if err != nil {
				return "", errors.Wrap(err, "invalid OpenAI endpoint")
			}
			if !strings.EqualFold(u.Hostname(), "api.openai.com") {
				return "whisper-1", nil
			}
		}
		return DefaultOpenAITranscriptionModel, nil
	case ProviderGemini:
		return DefaultGeminiTranscriptionModel, nil
	default:
		return "", errors.Wrapf(ErrCapabilityUnsupported, "provider type %q", provider.Type)
	}
}

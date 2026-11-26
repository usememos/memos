package ai

import (
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Length limits for AI model identifiers and transcription hints.
const (
	maxAIModelLength               = 256
	maxTranscriptionLanguageLength = 32
	maxTranscriptionPromptLength   = 4096
)

// Default endpoints applied by NormalizeSetting when a provider has none.
const (
	defaultOpenAIEndpoint = "https://api.openai.com/v1"
	defaultGeminiEndpoint = "https://generativelanguage.googleapis.com/v1beta"
)

// NormalizeSetting trims provider and model configuration fields and fills a
// provider's default endpoint. It never generates IDs or copies secrets.
func NormalizeSetting(setting *storepb.InstanceAISetting) {
	if setting == nil {
		return
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		provider.Id = strings.TrimSpace(provider.Id)
		provider.Title = strings.TrimSpace(provider.Title)
		provider.Endpoint = strings.TrimSpace(provider.Endpoint)
		if provider.Endpoint == "" {
			switch provider.Type {
			case storepb.AIProviderType_OPENAI:
				provider.Endpoint = defaultOpenAIEndpoint
			case storepb.AIProviderType_GEMINI:
				provider.Endpoint = defaultGeminiEndpoint
			default:
			}
		}
	}
	if cfg := setting.TextGeneration; cfg != nil {
		cfg.ProviderId = strings.TrimSpace(cfg.ProviderId)
		cfg.Model = strings.TrimSpace(cfg.Model)
	}
	if transcription := setting.Transcription; transcription != nil {
		transcription.ProviderId = strings.TrimSpace(transcription.ProviderId)
		transcription.Model = strings.TrimSpace(transcription.Model)
		transcription.Language = strings.TrimSpace(transcription.Language)
		transcription.Prompt = strings.TrimSpace(transcription.Prompt)
	}
}

// ValidateSetting checks the configured providers and feature models.
func ValidateSetting(setting *storepb.InstanceAISetting) error {
	if setting == nil {
		return errors.New("AI setting is required")
	}
	seenIDs := make(map[string]bool, len(setting.Providers))
	for i, provider := range setting.Providers {
		if provider == nil {
			return errors.Errorf("providers[%d] must not be null", i)
		}
		if provider.Id == "" {
			return errors.Errorf("providers[%d].id is required", i)
		}
		if seenIDs[provider.Id] {
			return errors.Errorf("duplicate provider ID %q", provider.Id)
		}
		seenIDs[provider.Id] = true
		if provider.Title == "" {
			return errors.Errorf("provider %q title is required", provider.Id)
		}
		if provider.Type != storepb.AIProviderType_OPENAI && provider.Type != storepb.AIProviderType_GEMINI {
			return errors.Errorf("provider %q has unsupported type", provider.Id)
		}
		if ValidateEndpoint(provider.Endpoint) != nil {
			return errors.Errorf("provider %q endpoint must be an http or https URL", provider.Id)
		}
		if provider.ApiKey == "" {
			return errors.Errorf("provider %q API key is required", provider.Id)
		}
	}

	if cfg := setting.TextGeneration; cfg != nil {
		if err := validateModelSelection("text_generation", cfg.ProviderId, cfg.Model, seenIDs); err != nil {
			return err
		}
	}
	if cfg := setting.Transcription; cfg != nil {
		if err := validateModelSelection("transcription", cfg.ProviderId, cfg.Model, seenIDs); err != nil {
			return err
		}
		if len(cfg.Language) > maxTranscriptionLanguageLength {
			return errors.Errorf("transcription language is too long; maximum length is %d characters", maxTranscriptionLanguageLength)
		}
		if len(cfg.Prompt) > maxTranscriptionPromptLength {
			return errors.Errorf("transcription prompt is too long; maximum length is %d characters", maxTranscriptionPromptLength)
		}
	}
	return nil
}

// validateModelSelection checks a capability's provider and model. A capability that is set is on,
// so it needs both: leaving the capability unset is how it is turned off.
func validateModelSelection(capability, providerID, model string, providerIDs map[string]bool) error {
	if providerID == "" {
		return errors.Errorf("%s provider_id is required", capability)
	}
	if !providerIDs[providerID] {
		return errors.Errorf("%s provider_id %q does not reference any configured provider", capability, providerID)
	}
	if model == "" || len(model) > maxAIModelLength {
		return errors.Errorf("%s model must be between 1 and %d bytes", capability, maxAIModelLength)
	}
	return nil
}

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

// TypeFromStore returns the provider type of a stored provider type.
func TypeFromStore(providerType storepb.AIProviderType) ProviderType {
	return ProviderType(providerType.String())
}

// ResolveEndpoint returns the endpoint a provider's requests go to: its own, or its type's default.
func ResolveEndpoint(provider *storepb.AIProviderConfig) string {
	if endpoint := strings.TrimSpace(provider.GetEndpoint()); endpoint != "" {
		return strings.TrimRight(endpoint, "/")
	}
	spec, _ := LookupSpec(TypeFromStore(provider.GetType()))
	return spec.DefaultEndpoint
}

// NormalizeSetting trims provider and model configuration fields. An endpoint
// equal to its type's default is cleared, so a provider follows the default if
// it ever moves. It never generates IDs or copies secrets.
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
		provider.Endpoint = strings.TrimRight(strings.TrimSpace(provider.Endpoint), "/")
		if spec, ok := LookupSpec(TypeFromStore(provider.Type)); ok && provider.Endpoint == spec.DefaultEndpoint {
			provider.Endpoint = ""
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
	providerTypes := make(map[string]ProviderSpec, len(setting.Providers))
	for i, provider := range setting.Providers {
		if provider == nil {
			return errors.Errorf("providers[%d] must not be null", i)
		}
		if provider.Id == "" {
			return errors.Errorf("providers[%d].id is required", i)
		}
		if _, seen := providerTypes[provider.Id]; seen {
			return errors.Errorf("duplicate provider ID %q", provider.Id)
		}
		if provider.Title == "" {
			return errors.Errorf("provider %q title is required", provider.Id)
		}
		spec, ok := LookupSpec(TypeFromStore(provider.Type))
		if !ok {
			return errors.Errorf("provider %q has unsupported type", provider.Id)
		}
		if spec.DefaultEndpoint == "" && provider.Endpoint == "" {
			return errors.Errorf("provider %q endpoint is required", provider.Id)
		}
		if ValidateEndpoint(provider.Endpoint) != nil {
			return errors.Errorf("provider %q endpoint must be an http or https URL", provider.Id)
		}
		if spec.APIKeyRequired && provider.ApiKey == "" {
			return errors.Errorf("provider %q API key is required", provider.Id)
		}
		providerTypes[provider.Id] = spec
	}

	if cfg := setting.TextGeneration; cfg != nil {
		if err := validateModelSelection("text_generation", CapabilityTextGeneration, cfg.ProviderId, cfg.Model, providerTypes); err != nil {
			return err
		}
	}
	if cfg := setting.Transcription; cfg != nil {
		if err := validateModelSelection("transcription", CapabilityTranscription, cfg.ProviderId, cfg.Model, providerTypes); err != nil {
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
func validateModelSelection(field string, capability Capability, providerID, model string, providers map[string]ProviderSpec) error {
	if providerID == "" {
		return errors.Errorf("%s provider_id is required", field)
	}
	spec, ok := providers[providerID]
	if !ok {
		return errors.Errorf("%s provider_id %q does not reference any configured provider", field, providerID)
	}
	if !spec.Supports(capability) {
		return errors.Errorf("provider %q cannot be used for %s", providerID, field)
	}
	if model == "" || len(model) > maxAIModelLength {
		return errors.Errorf("%s model must be between 1 and %d bytes", field, maxAIModelLength)
	}
	return nil
}

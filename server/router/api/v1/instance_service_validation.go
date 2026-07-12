package v1

import (
	"context"
	"math"
	"regexp"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	colorpb "google.golang.org/genproto/googleapis/type/color"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func validateInstanceSetting(setting *v1pb.InstanceSetting) error {
	key, err := ExtractInstanceSettingKeyFromName(setting.Name)
	if err != nil {
		return err
	}
	if key != storepb.InstanceSettingKey_TAGS.String() {
		return nil
	}
	return validateInstanceTagsSetting(setting.GetTagsSetting())
}

func (s *APIV1Service) prepareInstanceAISettingForUpdate(ctx context.Context, setting *storepb.InstanceAISetting) error {
	if setting == nil {
		return errors.New("AI setting is required")
	}

	existing, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get existing AI setting")
	}
	existingProviders := map[string]*storepb.AIProviderConfig{}
	if existing != nil {
		for _, provider := range existing.Providers {
			if provider != nil && provider.Id != "" {
				existingProviders[provider.Id] = provider
			}
		}
	}

	seenIDs := map[string]bool{}
	for _, provider := range setting.Providers {
		if provider == nil {
			return errors.New("provider cannot be nil")
		}

		provider.Id = strings.TrimSpace(provider.Id)
		if provider.Id == "" {
			provider.Id = shortuuid.New()
		}
		if seenIDs[provider.Id] {
			return errors.Errorf("duplicate provider ID %q", provider.Id)
		}
		seenIDs[provider.Id] = true

		provider.Title = strings.TrimSpace(provider.Title)
		if provider.Title == "" {
			return errors.New("provider title is required")
		}
		if provider.Type != storepb.AIProviderType_OPENAI && provider.Type != storepb.AIProviderType_GEMINI {
			return errors.Errorf("provider %q has unsupported type", provider.Id)
		}

		provider.Endpoint = strings.TrimSpace(provider.Endpoint)
		if provider.Type == storepb.AIProviderType_OPENAI && provider.Endpoint == "" {
			provider.Endpoint = "https://api.openai.com/v1"
		}
		if provider.Type == storepb.AIProviderType_GEMINI && provider.Endpoint == "" {
			provider.Endpoint = "https://generativelanguage.googleapis.com/v1beta"
		}

		if provider.ApiKey == "" {
			if existingProvider, ok := existingProviders[provider.Id]; ok {
				provider.ApiKey = existingProvider.ApiKey
			}
		}
		if provider.ApiKey == "" {
			return errors.Errorf("provider %q API key is required", provider.Id)
		}
	}

	if err := preparePersistedTranscriptionConfig(setting, existing); err != nil {
		return err
	}
	return nil
}

func preparePersistedTranscriptionConfig(setting *storepb.InstanceAISetting, existing *storepb.InstanceAISetting) error {
	// Preserve the previously stored transcription config when the request omits it,
	// matching the same "absence == keep" semantics used for API keys. The preserved
	// config still falls through to validation below, so a stale provider_id is
	// rejected if the same update removed or renamed its referenced provider.
	if setting.Transcription == nil && existing != nil {
		setting.Transcription = existing.GetTranscription()
	}
	if setting.Transcription == nil {
		return nil
	}

	cfg := setting.Transcription
	cfg.ProviderId = strings.TrimSpace(cfg.ProviderId)
	cfg.Model = strings.TrimSpace(cfg.Model)
	cfg.Language = strings.TrimSpace(cfg.Language)
	cfg.Prompt = strings.TrimSpace(cfg.Prompt)

	if cfg.ProviderId != "" {
		referenced := false
		for _, provider := range setting.Providers {
			if provider != nil && provider.Id == cfg.ProviderId {
				referenced = true
				break
			}
		}
		if !referenced {
			return errors.Errorf("transcription provider_id %q does not reference any configured provider", cfg.ProviderId)
		}
	}

	if len(cfg.Model) > maxTranscriptionConfigModelLength {
		return errors.Errorf("transcription model is too long; maximum length is %d characters", maxTranscriptionConfigModelLength)
	}
	if len(cfg.Language) > maxTranscriptionConfigLanguageLength {
		return errors.Errorf("transcription language is too long; maximum length is %d characters", maxTranscriptionConfigLanguageLength)
	}
	if len(cfg.Prompt) > maxTranscriptionConfigPromptLength {
		return errors.Errorf("transcription prompt is too long; maximum length is %d characters", maxTranscriptionConfigPromptLength)
	}
	return nil
}

func maskAPIKey(apiKey string) string {
	if apiKey == "" {
		return ""
	}
	if len(apiKey) <= 8 {
		return "..."
	}
	prefixLength := min(4, len(apiKey))
	return apiKey[:prefixLength] + "..." + apiKey[len(apiKey)-4:]
}

func validateInstanceTagsSetting(setting *v1pb.InstanceSetting_TagsSetting) error {
	if setting == nil {
		return errors.New("tags setting is required")
	}
	for tag, metadata := range setting.Tags {
		if strings.TrimSpace(tag) == "" {
			return errors.New("tag key cannot be empty")
		}
		if _, err := regexp.Compile(tag); err != nil {
			return errors.Errorf("tag key %q is not a valid regex pattern: %v", tag, err)
		}
		if metadata == nil {
			return errors.Errorf("tag metadata is required for %q", tag)
		}
		if metadata.GetBackgroundColor() != nil {
			if err := validateInstanceColor(metadata.GetBackgroundColor()); err != nil {
				return errors.Wrapf(err, "background_color for %q", tag)
			}
		}
	}
	return nil
}

func validateInstanceColor(color *colorpb.Color) error {
	if err := validateInstanceColorComponent("red", color.GetRed()); err != nil {
		return err
	}
	if err := validateInstanceColorComponent("green", color.GetGreen()); err != nil {
		return err
	}
	if err := validateInstanceColorComponent("blue", color.GetBlue()); err != nil {
		return err
	}
	if alpha := color.GetAlpha(); alpha != nil {
		if err := validateInstanceColorComponent("alpha", alpha.GetValue()); err != nil {
			return err
		}
	}
	return nil
}

func validateInstanceColorComponent(name string, value float32) error {
	if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
		return errors.Errorf("%s must be a finite number", name)
	}
	if value < 0 || value > 1 {
		return errors.Errorf("%s must be between 0 and 1", name)
	}
	return nil
}

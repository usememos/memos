package api

import (
	"context"
	"math"
	"regexp"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	colorpb "google.golang.org/genproto/googleapis/type/color"

	"github.com/usememos/memos/core/instancesetting"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// prepareInstanceAISettingForUpdate applies the API's update conveniences to an
// AI setting before it is validated: trimming and default endpoints, generated
// IDs for new providers, an empty API key meaning "keep the stored key", and an
// omitted transcription config meaning "keep the stored config".
func (s *APIService) prepareInstanceAISettingForUpdate(ctx context.Context, setting *storepb.InstanceAISetting) error {
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

	instancesetting.NormalizeAISetting(setting)
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		if provider.Id == "" {
			provider.Id = shortuuid.New()
		}
		if provider.ApiKey == "" {
			if existingProvider, ok := existingProviders[provider.Id]; ok {
				provider.ApiKey = existingProvider.ApiKey
			}
		}
	}
	// The preserved config is still validated, so a stale provider_id is
	// rejected if the same update removed or renamed its referenced provider.
	if setting.Transcription == nil && existing != nil {
		setting.Transcription = existing.GetTranscription()
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

func validateInstanceTagsSetting(setting *apipb.InstanceSetting_TagsSetting) error {
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

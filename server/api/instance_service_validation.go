package api

import (
	"context"
	"math"
	"regexp"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	colorpb "google.golang.org/genproto/googleapis/type/color"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
)

// prepareInstanceAISettingForUpdate applies the API's update conveniences to an
// AI setting before it is validated: trimming and default endpoints, generated
// IDs for new providers, and an empty API key meaning "keep the stored key".
// The setting is otherwise taken as sent: an unset capability is off.
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

	ai.NormalizeSetting(setting)
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		if provider.Id == "" {
			provider.Id = shortuuid.New()
		}
		if provider.ApiKey == "" {
			if existingProvider := existingProviders[provider.Id]; sameAIConnection(provider, existingProvider) {
				provider.ApiKey = existingProvider.ApiKey
			}
		}
	}
	return nil
}

// Compare normalized copies so older settings with an implicit endpoint keep their key.
func sameAIConnection(draft, stored *storepb.AIProviderConfig) bool {
	if stored == nil || stored.Type != draft.Type || stored.Id != draft.Id {
		return false
	}
	previous := &storepb.AIProviderConfig{Type: stored.Type, Endpoint: stored.Endpoint}
	ai.NormalizeSetting(&storepb.InstanceAISetting{Providers: []*storepb.AIProviderConfig{previous}})
	return strings.TrimRight(previous.Endpoint, "/") == strings.TrimRight(draft.Endpoint, "/")
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

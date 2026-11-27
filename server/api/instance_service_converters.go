package api

import (
	"github.com/usememos/memos/core/instancesetting"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// The conversion between API and store settings lives in core/instancesetting,
// because declarative configuration files use the same API messages. This file
// holds what only responses need.

// convertInstanceSettingFromStore converts a stored setting for a response,
// with write-only secrets cleared.
func convertInstanceSettingFromStore(setting *storepb.InstanceSetting) *apipb.InstanceSetting {
	result := instancesetting.FromStore(setting)
	redactInstanceSetting(result)
	return result
}

// redactInstanceSetting clears the S3 secrets and SMTP password and replaces
// each AI API key with whether it is set and a masked hint.
func redactInstanceSetting(setting *apipb.InstanceSetting) {
	if storage := setting.GetStorageSetting(); storage != nil {
		if storage.S3Config != nil {
			storage.S3Config.AccessKeySecret = ""
		}
		for _, configured := range storage.Storages {
			if s3Config := configured.GetS3Config(); s3Config != nil {
				s3Config.AccessKeySecret = ""
			}
		}
	}
	if email := setting.GetNotificationSetting().GetEmail(); email != nil {
		email.SmtpPassword = ""
	}
	for _, provider := range setting.GetAiSetting().GetProviders() {
		provider.ApiKeySet = provider.ApiKey != ""
		provider.ApiKeyHint = maskAPIKey(provider.ApiKey)
		provider.ApiKey = ""
	}
}

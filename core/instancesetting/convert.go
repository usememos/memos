package instancesetting

import (
	"strings"

	"github.com/pkg/errors"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// NamePrefix starts every instance setting resource name.
const NamePrefix = "instance/settings/"

// ToStore converts an API instance setting for the store. The key comes from
// the resource name; an unknown name gives an unspecified key and no value,
// which Validate rejects. USAGE_LIMITS names users, so its value is converted
// by UsageLimitsToStore once the names are resolved.
func ToStore(setting *apipb.InstanceSetting) *storepb.InstanceSetting {
	if setting == nil {
		return nil
	}
	result := &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[strings.TrimPrefix(setting.Name, NamePrefix)]),
	}
	if !strings.HasPrefix(setting.Name, NamePrefix) {
		result.Key = storepb.InstanceSettingKey_INSTANCE_SETTING_KEY_UNSPECIFIED
	}
	switch result.Key {
	case storepb.InstanceSettingKey_GENERAL:
		if value := setting.GetGeneralSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_GeneralSetting{GeneralSetting: generalSettingToStore(value)}
		}
	case storepb.InstanceSettingKey_STORAGE:
		if value := setting.GetStorageSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_StorageSetting{StorageSetting: storageSettingToStore(value)}
		}
	case storepb.InstanceSettingKey_MEMO_RELATED:
		if value := setting.GetMemoRelatedSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: memoRelatedSettingToStore(value)}
		}
	case storepb.InstanceSettingKey_TAGS:
		if value := setting.GetTagsSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_TagsSetting{TagsSetting: tagsSettingToStore(value)}
		}
	case storepb.InstanceSettingKey_NOTIFICATION:
		if value := setting.GetNotificationSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_NotificationSetting{NotificationSetting: NotificationSettingToStore(value)}
		}
	case storepb.InstanceSettingKey_AI:
		if value := setting.GetAiSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_AiSetting{AiSetting: aiSettingToStore(value)}
		}
	case storepb.InstanceSettingKey_ACCESS:
		if value := setting.GetAccessSetting(); value != nil {
			result.Value = &storepb.InstanceSetting_AccessSetting{AccessSetting: accessSettingToStore(value)}
		}
	default:
		// BASIC has no API value, and USAGE_LIMITS is converted by UsageLimitsToStore.
	}
	return result
}

// FromStore converts a stored instance setting for the API. It keeps every
// secret; a response must redact them. USAGE_LIMITS is left without a value,
// since naming its users needs the store; see UsageLimitsFromStore.
func FromStore(setting *storepb.InstanceSetting) *apipb.InstanceSetting {
	if setting == nil {
		return nil
	}
	result := &apipb.InstanceSetting{Name: NamePrefix + setting.Key.String()}
	switch setting.Value.(type) {
	case *storepb.InstanceSetting_GeneralSetting:
		result.Value = &apipb.InstanceSetting_GeneralSetting_{GeneralSetting: generalSettingFromStore(setting.GetGeneralSetting())}
	case *storepb.InstanceSetting_StorageSetting:
		result.Value = &apipb.InstanceSetting_StorageSetting_{StorageSetting: storageSettingFromStore(setting.GetStorageSetting())}
	case *storepb.InstanceSetting_MemoRelatedSetting:
		result.Value = &apipb.InstanceSetting_MemoRelatedSetting_{MemoRelatedSetting: memoRelatedSettingFromStore(setting.GetMemoRelatedSetting())}
	case *storepb.InstanceSetting_TagsSetting:
		result.Value = &apipb.InstanceSetting_TagsSetting_{TagsSetting: tagsSettingFromStore(setting.GetTagsSetting())}
	case *storepb.InstanceSetting_NotificationSetting:
		result.Value = &apipb.InstanceSetting_NotificationSetting_{NotificationSetting: notificationSettingFromStore(setting.GetNotificationSetting())}
	case *storepb.InstanceSetting_AiSetting:
		result.Value = &apipb.InstanceSetting_AiSetting{AiSetting: aiSettingFromStore(setting.GetAiSetting())}
	case *storepb.InstanceSetting_AccessSetting:
		result.Value = &apipb.InstanceSetting_AccessSetting_{AccessSetting: accessSettingFromStore(setting.GetAccessSetting())}
	default:
		// Leave Value unset for BASIC and USAGE_LIMITS.
	}
	return result
}

// UsageLimitsToStore converts API usage limits for the store. userIDs maps
// each user resource name the limits use to its user ID.
func UsageLimitsToStore(setting *apipb.InstanceSetting_UsageLimitsSetting, userIDs map[string]int32) (*storepb.InstanceUsageLimitsSetting, error) {
	if setting == nil {
		return nil, errors.New("usage limits setting is required")
	}
	result := &storepb.InstanceUsageLimitsSetting{}
	for _, limit := range setting.GetLimits() {
		entry := &storepb.InstanceUsageLimitsSetting_UsageLimit{
			AllUsers:         limit.GetAllUsers(),
			MemoCount:        limit.MemoCount,
			MemoContentBytes: limit.MemoContentBytes,
			StorageBytes:     limit.StorageBytes,
			UploadBytes:      limit.UploadBytes,
		}
		for _, name := range limit.GetUsers() {
			userID, ok := userIDs[name]
			if !ok {
				return nil, errors.Errorf("user %q not found", name)
			}
			entry.UserIds = append(entry.UserIds, userID)
		}
		result.Limits = append(result.Limits, entry)
	}
	return result, nil
}

// UsageLimitsFromStore converts stored usage limits for the API. userNames
// maps user IDs to user resource names; an ID without a name, a user that no
// longer exists, is left out because it never matches anyone.
func UsageLimitsFromStore(setting *storepb.InstanceUsageLimitsSetting, userNames map[int32]string) *apipb.InstanceSetting_UsageLimitsSetting {
	result := &apipb.InstanceSetting_UsageLimitsSetting{}
	for _, limit := range setting.GetLimits() {
		entry := &apipb.InstanceSetting_UsageLimitsSetting_UsageLimit{
			AllUsers:         limit.GetAllUsers(),
			MemoCount:        limit.MemoCount,
			MemoContentBytes: limit.MemoContentBytes,
			StorageBytes:     limit.StorageBytes,
			UploadBytes:      limit.UploadBytes,
		}
		for _, userID := range limit.GetUserIds() {
			if name, ok := userNames[userID]; ok {
				entry.Users = append(entry.Users, name)
			}
		}
		result.Limits = append(result.Limits, entry)
	}
	return result
}

func accessSettingFromStore(setting *storepb.InstanceAccessSetting) *apipb.InstanceSetting_AccessSetting {
	if setting == nil {
		return nil
	}
	return &apipb.InstanceSetting_AccessSetting{
		AccessMode: AccessModeFromStore(setting.AccessMode),
	}
}

func accessSettingToStore(setting *apipb.InstanceSetting_AccessSetting) *storepb.InstanceAccessSetting {
	if setting == nil {
		return nil
	}
	return &storepb.InstanceAccessSetting{
		AccessMode: storepb.InstanceAccessMode(setting.AccessMode),
	}
}

// AccessModeFromStore converts a stored access mode for the API.
func AccessModeFromStore(mode storepb.InstanceAccessMode) apipb.InstanceAccessMode {
	return apipb.InstanceAccessMode(mode)
}

func generalSettingFromStore(setting *storepb.InstanceGeneralSetting) *apipb.InstanceSetting_GeneralSetting {
	if setting == nil {
		return nil
	}

	generalSetting := &apipb.InstanceSetting_GeneralSetting{
		DisallowUserRegistration: setting.DisallowUserRegistration,
		DisallowPasswordAuth:     setting.DisallowPasswordAuth,
		AdditionalScript:         setting.AdditionalScript,
		AdditionalStyle:          setting.AdditionalStyle,
		WeekStartDayOffset:       setting.WeekStartDayOffset,
		DisallowChangeUsername:   setting.DisallowChangeUsername,
		DisallowChangeNickname:   setting.DisallowChangeNickname,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &apipb.InstanceSetting_GeneralSetting_CustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
		}
	}
	return generalSetting
}

func generalSettingToStore(setting *apipb.InstanceSetting_GeneralSetting) *storepb.InstanceGeneralSetting {
	if setting == nil {
		return nil
	}
	generalSetting := &storepb.InstanceGeneralSetting{
		DisallowUserRegistration: setting.DisallowUserRegistration,
		DisallowPasswordAuth:     setting.DisallowPasswordAuth,
		AdditionalScript:         setting.AdditionalScript,
		AdditionalStyle:          setting.AdditionalStyle,
		WeekStartDayOffset:       setting.WeekStartDayOffset,
		DisallowChangeUsername:   setting.DisallowChangeUsername,
		DisallowChangeNickname:   setting.DisallowChangeNickname,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &storepb.InstanceCustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
		}
	}
	return generalSetting
}

func storageSettingFromStore(settingpb *storepb.InstanceStorageSetting) *apipb.InstanceSetting_StorageSetting {
	if settingpb == nil {
		return nil
	}
	setting := &apipb.InstanceSetting_StorageSetting{
		StorageType:      apipb.InstanceSetting_StorageSetting_StorageType(settingpb.StorageType),
		FilepathTemplate: settingpb.FilepathTemplate,
		DefaultStorageId: settingpb.DefaultStorageId,
	}
	for _, storagepb := range settingpb.Storages {
		setting.Storages = append(setting.Storages, storageFromStore(storagepb))
	}
	if settingpb.S3Config != nil {
		setting.S3Config = &apipb.InstanceSetting_StorageSetting_S3Config{
			AccessKeyId:           settingpb.S3Config.AccessKeyId,
			AccessKeySecret:       settingpb.S3Config.AccessKeySecret,
			Endpoint:              settingpb.S3Config.Endpoint,
			Region:                settingpb.S3Config.Region,
			Bucket:                settingpb.S3Config.Bucket,
			UsePathStyle:          settingpb.S3Config.UsePathStyle,
			InsecureSkipTlsVerify: settingpb.S3Config.InsecureSkipTlsVerify,
		}
	}
	return setting
}

func storageSettingToStore(setting *apipb.InstanceSetting_StorageSetting) *storepb.InstanceStorageSetting {
	if setting == nil {
		return nil
	}
	settingpb := &storepb.InstanceStorageSetting{
		StorageType:      storepb.InstanceStorageSetting_StorageType(setting.StorageType),
		FilepathTemplate: setting.FilepathTemplate,
		DefaultStorageId: setting.DefaultStorageId,
	}
	for _, storage := range setting.Storages {
		settingpb.Storages = append(settingpb.Storages, storageToStore(storage))
	}
	if setting.S3Config != nil {
		settingpb.S3Config = &storepb.StorageS3Config{
			AccessKeyId:           setting.S3Config.AccessKeyId,
			AccessKeySecret:       setting.S3Config.AccessKeySecret,
			Endpoint:              setting.S3Config.Endpoint,
			Region:                setting.S3Config.Region,
			Bucket:                setting.S3Config.Bucket,
			UsePathStyle:          setting.S3Config.UsePathStyle,
			InsecureSkipTlsVerify: setting.S3Config.InsecureSkipTlsVerify,
		}
	}
	return settingpb
}

func storageFromStore(storagepb *storepb.Storage) *apipb.InstanceSetting_Storage {
	if storagepb == nil {
		return nil
	}
	storage := &apipb.InstanceSetting_Storage{
		Id:   storagepb.Id,
		Name: storagepb.Name,
		Type: apipb.InstanceSetting_StorageType(storagepb.Type),
	}
	if s3Config := storagepb.GetS3Config(); s3Config != nil {
		storage.Config = &apipb.InstanceSetting_Storage_S3Config_{
			S3Config: &apipb.InstanceSetting_Storage_S3Config{
				AccessKeyId:           s3Config.AccessKeyId,
				AccessKeySecret:       s3Config.AccessKeySecret,
				Endpoint:              s3Config.Endpoint,
				Region:                s3Config.Region,
				Bucket:                s3Config.Bucket,
				UsePathStyle:          s3Config.UsePathStyle,
				InsecureSkipTlsVerify: s3Config.InsecureSkipTlsVerify,
			},
		}
	}
	return storage
}

func storageToStore(storage *apipb.InstanceSetting_Storage) *storepb.Storage {
	if storage == nil {
		return nil
	}
	storagepb := &storepb.Storage{
		Id:   storage.Id,
		Name: storage.Name,
		Type: storepb.StorageType(storage.Type),
	}
	if s3Config := storage.GetS3Config(); s3Config != nil {
		storagepb.Config = &storepb.Storage_S3Config{
			S3Config: &storepb.StorageS3Config{
				AccessKeyId:           s3Config.AccessKeyId,
				AccessKeySecret:       s3Config.AccessKeySecret,
				Endpoint:              s3Config.Endpoint,
				Region:                s3Config.Region,
				Bucket:                s3Config.Bucket,
				UsePathStyle:          s3Config.UsePathStyle,
				InsecureSkipTlsVerify: s3Config.InsecureSkipTlsVerify,
			},
		}
	}
	return storagepb
}

func memoRelatedSettingFromStore(setting *storepb.InstanceMemoRelatedSetting) *apipb.InstanceSetting_MemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &apipb.InstanceSetting_MemoRelatedSetting{
		Reactions: setting.Reactions,
	}
}

func memoRelatedSettingToStore(setting *apipb.InstanceSetting_MemoRelatedSetting) *storepb.InstanceMemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &storepb.InstanceMemoRelatedSetting{
		Reactions: setting.Reactions,
	}
}

func tagsSettingFromStore(setting *storepb.InstanceTagsSetting) *apipb.InstanceSetting_TagsSetting {
	if setting == nil {
		return nil
	}
	tags := make(map[string]*apipb.InstanceSetting_TagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		tags[tag] = &apipb.InstanceSetting_TagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &apipb.InstanceSetting_TagsSetting{
		Tags: tags,
	}
}

func tagsSettingToStore(setting *apipb.InstanceSetting_TagsSetting) *storepb.InstanceTagsSetting {
	if setting == nil {
		return nil
	}
	tags := make(map[string]*storepb.InstanceTagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		tags[tag] = &storepb.InstanceTagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &storepb.InstanceTagsSetting{
		Tags: tags,
	}
}

func notificationSettingFromStore(setting *storepb.InstanceNotificationSetting) *apipb.InstanceSetting_NotificationSetting {
	if setting == nil {
		return nil
	}

	notificationSetting := &apipb.InstanceSetting_NotificationSetting{}
	if setting.Email != nil {
		notificationSetting.Email = &apipb.InstanceSetting_NotificationSetting_EmailSetting{
			Enabled:      setting.Email.Enabled,
			SmtpHost:     setting.Email.SmtpHost,
			SmtpPort:     setting.Email.SmtpPort,
			SmtpUsername: setting.Email.SmtpUsername,
			SmtpPassword: setting.Email.SmtpPassword,
			FromEmail:    setting.Email.FromEmail,
			FromName:     setting.Email.FromName,
			ReplyTo:      setting.Email.ReplyTo,
			UseTls:       setting.Email.UseTls,
			UseSsl:       setting.Email.UseSsl,
		}
	}
	return notificationSetting
}

// NotificationSettingToStore converts an API notification setting for the store.
func NotificationSettingToStore(setting *apipb.InstanceSetting_NotificationSetting) *storepb.InstanceNotificationSetting {
	if setting == nil {
		return nil
	}

	notificationSetting := &storepb.InstanceNotificationSetting{}
	if setting.Email != nil {
		notificationSetting.Email = &storepb.InstanceNotificationSetting_EmailSetting{
			Enabled:      setting.Email.Enabled,
			SmtpHost:     setting.Email.SmtpHost,
			SmtpPort:     setting.Email.SmtpPort,
			SmtpUsername: setting.Email.SmtpUsername,
			SmtpPassword: setting.Email.SmtpPassword,
			FromEmail:    setting.Email.FromEmail,
			FromName:     setting.Email.FromName,
			ReplyTo:      setting.Email.ReplyTo,
			UseTls:       setting.Email.UseTls,
			UseSsl:       setting.Email.UseSsl,
		}
	}
	return notificationSetting
}

func aiSettingFromStore(setting *storepb.InstanceAISetting) *apipb.InstanceSetting_AISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &apipb.InstanceSetting_AISetting{
		Providers:     make([]*apipb.InstanceSetting_AIProviderConfig, 0, len(setting.Providers)),
		Transcription: transcriptionConfigFromStore(setting.GetTranscription()),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		aiSetting.Providers = append(aiSetting.Providers, &apipb.InstanceSetting_AIProviderConfig{
			Id:       provider.GetId(),
			Title:    provider.GetTitle(),
			Type:     apipb.InstanceSetting_AIProviderType(provider.GetType()),
			Endpoint: provider.GetEndpoint(),
			ApiKey:   provider.GetApiKey(),
		})
	}
	return aiSetting
}

func aiSettingToStore(setting *apipb.InstanceSetting_AISetting) *storepb.InstanceAISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &storepb.InstanceAISetting{
		Providers:     make([]*storepb.AIProviderConfig, 0, len(setting.Providers)),
		Transcription: transcriptionConfigToStore(setting.GetTranscription()),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		aiSetting.Providers = append(aiSetting.Providers, &storepb.AIProviderConfig{
			Id:       provider.GetId(),
			Title:    provider.GetTitle(),
			Type:     storepb.AIProviderType(provider.GetType()),
			Endpoint: provider.GetEndpoint(),
			ApiKey:   provider.GetApiKey(),
		})
	}
	return aiSetting
}

func transcriptionConfigFromStore(setting *storepb.TranscriptionConfig) *apipb.InstanceSetting_TranscriptionConfig {
	if setting == nil {
		return nil
	}
	return &apipb.InstanceSetting_TranscriptionConfig{
		ProviderId: setting.GetProviderId(),
		Model:      setting.GetModel(),
		Language:   setting.GetLanguage(),
		Prompt:     setting.GetPrompt(),
	}
}

func transcriptionConfigToStore(setting *apipb.InstanceSetting_TranscriptionConfig) *storepb.TranscriptionConfig {
	if setting == nil {
		return nil
	}
	return &storepb.TranscriptionConfig{
		ProviderId: setting.GetProviderId(),
		Model:      setting.GetModel(),
		Language:   setting.GetLanguage(),
		Prompt:     setting.GetPrompt(),
	}
}

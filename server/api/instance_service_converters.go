package api

import (
	"fmt"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func convertInstanceSettingFromStore(setting *storepb.InstanceSetting) *apipb.InstanceSetting {
	instanceSetting := &apipb.InstanceSetting{
		Name: fmt.Sprintf("instance/settings/%s", setting.Key.String()),
	}
	switch setting.Value.(type) {
	case *storepb.InstanceSetting_GeneralSetting:
		instanceSetting.Value = &apipb.InstanceSetting_GeneralSetting_{
			GeneralSetting: convertInstanceGeneralSettingFromStore(setting.GetGeneralSetting()),
		}
	case *storepb.InstanceSetting_StorageSetting:
		instanceSetting.Value = &apipb.InstanceSetting_StorageSetting_{
			StorageSetting: convertInstanceStorageSettingFromStore(setting.GetStorageSetting()),
		}
	case *storepb.InstanceSetting_MemoRelatedSetting:
		instanceSetting.Value = &apipb.InstanceSetting_MemoRelatedSetting_{
			MemoRelatedSetting: convertInstanceMemoRelatedSettingFromStore(setting.GetMemoRelatedSetting()),
		}
	case *storepb.InstanceSetting_TagsSetting:
		instanceSetting.Value = &apipb.InstanceSetting_TagsSetting_{
			TagsSetting: convertInstanceTagsSettingFromStore(setting.GetTagsSetting()),
		}
	case *storepb.InstanceSetting_NotificationSetting:
		instanceSetting.Value = &apipb.InstanceSetting_NotificationSetting_{
			NotificationSetting: convertInstanceNotificationSettingFromStore(setting.GetNotificationSetting()),
		}
	case *storepb.InstanceSetting_AiSetting:
		instanceSetting.Value = &apipb.InstanceSetting_AiSetting{
			AiSetting: convertInstanceAISettingFromStore(setting.GetAiSetting()),
		}
	case *storepb.InstanceSetting_AccessSetting:
		instanceSetting.Value = &apipb.InstanceSetting_AccessSetting_{
			AccessSetting: convertInstanceAccessSettingFromStore(setting.GetAccessSetting()),
		}
	default:
		// Leave Value unset for unsupported setting variants.
	}
	return instanceSetting
}

func convertInstanceSettingToStore(setting *apipb.InstanceSetting) *storepb.InstanceSetting {
	settingKeyString, _ := ExtractInstanceSettingKeyFromName(setting.Name)
	instanceSetting := &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[settingKeyString]),
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: convertInstanceGeneralSettingToStore(setting.GetGeneralSetting()),
		},
	}
	switch instanceSetting.Key {
	case storepb.InstanceSettingKey_GENERAL:
		instanceSetting.Value = &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: convertInstanceGeneralSettingToStore(setting.GetGeneralSetting()),
		}
	case storepb.InstanceSettingKey_STORAGE:
		instanceSetting.Value = &storepb.InstanceSetting_StorageSetting{
			StorageSetting: convertInstanceStorageSettingToStore(setting.GetStorageSetting()),
		}
	case storepb.InstanceSettingKey_MEMO_RELATED:
		instanceSetting.Value = &storepb.InstanceSetting_MemoRelatedSetting{
			MemoRelatedSetting: convertInstanceMemoRelatedSettingToStore(setting.GetMemoRelatedSetting()),
		}
	case storepb.InstanceSettingKey_TAGS:
		instanceSetting.Value = &storepb.InstanceSetting_TagsSetting{
			TagsSetting: convertInstanceTagsSettingToStore(setting.GetTagsSetting()),
		}
	case storepb.InstanceSettingKey_NOTIFICATION:
		instanceSetting.Value = &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: convertInstanceNotificationSettingToStore(setting.GetNotificationSetting()),
		}
	case storepb.InstanceSettingKey_AI:
		instanceSetting.Value = &storepb.InstanceSetting_AiSetting{
			AiSetting: convertInstanceAISettingToStore(setting.GetAiSetting()),
		}
	case storepb.InstanceSettingKey_ACCESS:
		instanceSetting.Value = &storepb.InstanceSetting_AccessSetting{
			AccessSetting: convertInstanceAccessSettingToStore(setting.GetAccessSetting()),
		}
	default:
		// Keep the default GeneralSetting value
	}
	return instanceSetting
}

func convertInstanceAccessSettingFromStore(setting *storepb.InstanceAccessSetting) *apipb.InstanceSetting_AccessSetting {
	if setting == nil {
		return nil
	}
	return &apipb.InstanceSetting_AccessSetting{
		AccessMode: convertInstanceAccessModeFromStore(setting.AccessMode),
	}
}

func convertInstanceAccessSettingToStore(setting *apipb.InstanceSetting_AccessSetting) *storepb.InstanceAccessSetting {
	if setting == nil {
		return nil
	}
	return &storepb.InstanceAccessSetting{
		AccessMode: storepb.InstanceAccessMode(setting.AccessMode),
	}
}

func convertInstanceAccessModeFromStore(mode storepb.InstanceAccessMode) apipb.InstanceAccessMode {
	return apipb.InstanceAccessMode(mode)
}

func convertInstanceGeneralSettingFromStore(setting *storepb.InstanceGeneralSetting) *apipb.InstanceSetting_GeneralSetting {
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

func convertInstanceGeneralSettingToStore(setting *apipb.InstanceSetting_GeneralSetting) *storepb.InstanceGeneralSetting {
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

func convertInstanceStorageSettingFromStore(settingpb *storepb.InstanceStorageSetting) *apipb.InstanceSetting_StorageSetting {
	if settingpb == nil {
		return nil
	}
	setting := &apipb.InstanceSetting_StorageSetting{
		StorageType:       apipb.InstanceSetting_StorageSetting_StorageType(settingpb.StorageType),
		FilepathTemplate:  settingpb.FilepathTemplate,
		UploadSizeLimitMb: settingpb.UploadSizeLimitMb,
		DefaultStorageId:  settingpb.DefaultStorageId,
	}
	for _, storagepb := range settingpb.Storages {
		setting.Storages = append(setting.Storages, convertStorageFromStore(storagepb))
	}
	if settingpb.S3Config != nil {
		setting.S3Config = &apipb.InstanceSetting_StorageSetting_S3Config{
			AccessKeyId: settingpb.S3Config.AccessKeyId,
			// AccessKeySecret is write-only: never returned in responses.
			Endpoint:              settingpb.S3Config.Endpoint,
			Region:                settingpb.S3Config.Region,
			Bucket:                settingpb.S3Config.Bucket,
			UsePathStyle:          settingpb.S3Config.UsePathStyle,
			InsecureSkipTlsVerify: settingpb.S3Config.InsecureSkipTlsVerify,
		}
	}
	return setting
}

func convertInstanceStorageSettingToStore(setting *apipb.InstanceSetting_StorageSetting) *storepb.InstanceStorageSetting {
	if setting == nil {
		return nil
	}
	settingpb := &storepb.InstanceStorageSetting{
		StorageType:       storepb.InstanceStorageSetting_StorageType(setting.StorageType),
		FilepathTemplate:  setting.FilepathTemplate,
		UploadSizeLimitMb: setting.UploadSizeLimitMb,
		DefaultStorageId:  setting.DefaultStorageId,
	}
	for _, storage := range setting.Storages {
		settingpb.Storages = append(settingpb.Storages, convertStorageToStore(storage))
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

func convertStorageFromStore(storagepb *storepb.Storage) *apipb.InstanceSetting_Storage {
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
				AccessKeyId: s3Config.AccessKeyId,
				// AccessKeySecret is write-only: never returned in responses.
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

func convertStorageToStore(storage *apipb.InstanceSetting_Storage) *storepb.Storage {
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

func convertInstanceMemoRelatedSettingFromStore(setting *storepb.InstanceMemoRelatedSetting) *apipb.InstanceSetting_MemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &apipb.InstanceSetting_MemoRelatedSetting{
		ContentLengthLimit:    setting.ContentLengthLimit,
		EnableDoubleClickEdit: setting.EnableDoubleClickEdit,
		Reactions:             setting.Reactions,
	}
}

func convertInstanceMemoRelatedSettingToStore(setting *apipb.InstanceSetting_MemoRelatedSetting) *storepb.InstanceMemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &storepb.InstanceMemoRelatedSetting{
		ContentLengthLimit:    setting.ContentLengthLimit,
		EnableDoubleClickEdit: setting.EnableDoubleClickEdit,
		Reactions:             setting.Reactions,
	}
}

func convertInstanceTagsSettingFromStore(setting *storepb.InstanceTagsSetting) *apipb.InstanceSetting_TagsSetting {
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

func convertInstanceTagsSettingToStore(setting *apipb.InstanceSetting_TagsSetting) *storepb.InstanceTagsSetting {
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

func convertInstanceNotificationSettingFromStore(setting *storepb.InstanceNotificationSetting) *apipb.InstanceSetting_NotificationSetting {
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
			// SmtpPassword is write-only: never returned in responses.
			FromEmail: setting.Email.FromEmail,
			FromName:  setting.Email.FromName,
			ReplyTo:   setting.Email.ReplyTo,
			UseTls:    setting.Email.UseTls,
			UseSsl:    setting.Email.UseSsl,
		}
	}
	return notificationSetting
}

func convertInstanceNotificationSettingToStore(setting *apipb.InstanceSetting_NotificationSetting) *storepb.InstanceNotificationSetting {
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

func convertInstanceAISettingFromStore(setting *storepb.InstanceAISetting) *apipb.InstanceSetting_AISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &apipb.InstanceSetting_AISetting{
		Providers:     make([]*apipb.InstanceSetting_AIProviderConfig, 0, len(setting.Providers)),
		Transcription: convertTranscriptionConfigFromStore(setting.GetTranscription()),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		apiKey := provider.GetApiKey()
		aiSetting.Providers = append(aiSetting.Providers, &apipb.InstanceSetting_AIProviderConfig{
			Id:         provider.GetId(),
			Title:      provider.GetTitle(),
			Type:       apipb.InstanceSetting_AIProviderType(provider.GetType()),
			Endpoint:   provider.GetEndpoint(),
			ApiKeySet:  apiKey != "",
			ApiKeyHint: maskAPIKey(apiKey),
		})
	}
	return aiSetting
}

func convertInstanceAISettingToStore(setting *apipb.InstanceSetting_AISetting) *storepb.InstanceAISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &storepb.InstanceAISetting{
		Providers:     make([]*storepb.AIProviderConfig, 0, len(setting.Providers)),
		Transcription: convertTranscriptionConfigToStore(setting.GetTranscription()),
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

func convertTranscriptionConfigFromStore(setting *storepb.TranscriptionConfig) *apipb.InstanceSetting_TranscriptionConfig {
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

func convertTranscriptionConfigToStore(setting *apipb.InstanceSetting_TranscriptionConfig) *storepb.TranscriptionConfig {
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

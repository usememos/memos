package v1

import (
	"fmt"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func convertInstanceSettingFromStore(setting *storepb.InstanceSetting) *v1pb.InstanceSetting {
	instanceSetting := &v1pb.InstanceSetting{
		Name: fmt.Sprintf("instance/settings/%s", setting.Key.String()),
	}
	switch setting.Value.(type) {
	case *storepb.InstanceSetting_GeneralSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_GeneralSetting_{
			GeneralSetting: convertInstanceGeneralSettingFromStore(setting.GetGeneralSetting()),
		}
	case *storepb.InstanceSetting_StorageSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_StorageSetting_{
			StorageSetting: convertInstanceStorageSettingFromStore(setting.GetStorageSetting()),
		}
	case *storepb.InstanceSetting_MemoRelatedSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_MemoRelatedSetting_{
			MemoRelatedSetting: convertInstanceMemoRelatedSettingFromStore(setting.GetMemoRelatedSetting()),
		}
	case *storepb.InstanceSetting_TagsSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_TagsSetting_{
			TagsSetting: convertInstanceTagsSettingFromStore(setting.GetTagsSetting()),
		}
	case *storepb.InstanceSetting_NotificationSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_NotificationSetting_{
			NotificationSetting: convertInstanceNotificationSettingFromStore(setting.GetNotificationSetting()),
		}
	case *storepb.InstanceSetting_AiSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_AiSetting{
			AiSetting: convertInstanceAISettingFromStore(setting.GetAiSetting()),
		}
	default:
		// Leave Value unset for unsupported setting variants.
	}
	return instanceSetting
}

func convertInstanceSettingToStore(setting *v1pb.InstanceSetting) *storepb.InstanceSetting {
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
	default:
		// Keep the default GeneralSetting value
	}
	return instanceSetting
}

func convertInstanceGeneralSettingFromStore(setting *storepb.InstanceGeneralSetting) *v1pb.InstanceSetting_GeneralSetting {
	if setting == nil {
		return nil
	}

	generalSetting := &v1pb.InstanceSetting_GeneralSetting{
		DisallowUserRegistration: setting.DisallowUserRegistration,
		DisallowPasswordAuth:     setting.DisallowPasswordAuth,
		AdditionalScript:         setting.AdditionalScript,
		AdditionalStyle:          setting.AdditionalStyle,
		WeekStartDayOffset:       setting.WeekStartDayOffset,
		DisallowChangeUsername:   setting.DisallowChangeUsername,
		DisallowChangeNickname:   setting.DisallowChangeNickname,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &v1pb.InstanceSetting_GeneralSetting_CustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
		}
	}
	return generalSetting
}

func convertInstanceGeneralSettingToStore(setting *v1pb.InstanceSetting_GeneralSetting) *storepb.InstanceGeneralSetting {
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

func convertInstanceStorageSettingFromStore(settingpb *storepb.InstanceStorageSetting) *v1pb.InstanceSetting_StorageSetting {
	if settingpb == nil {
		return nil
	}
	setting := &v1pb.InstanceSetting_StorageSetting{
		StorageType:       v1pb.InstanceSetting_StorageSetting_StorageType(settingpb.StorageType),
		FilepathTemplate:  settingpb.FilepathTemplate,
		UploadSizeLimitMb: settingpb.UploadSizeLimitMb,
	}
	if settingpb.S3Config != nil {
		setting.S3Config = &v1pb.InstanceSetting_StorageSetting_S3Config{
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

func convertInstanceStorageSettingToStore(setting *v1pb.InstanceSetting_StorageSetting) *storepb.InstanceStorageSetting {
	if setting == nil {
		return nil
	}
	settingpb := &storepb.InstanceStorageSetting{
		StorageType:       storepb.InstanceStorageSetting_StorageType(setting.StorageType),
		FilepathTemplate:  setting.FilepathTemplate,
		UploadSizeLimitMb: setting.UploadSizeLimitMb,
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

func convertInstanceMemoRelatedSettingFromStore(setting *storepb.InstanceMemoRelatedSetting) *v1pb.InstanceSetting_MemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &v1pb.InstanceSetting_MemoRelatedSetting{
		ContentLengthLimit:    setting.ContentLengthLimit,
		EnableDoubleClickEdit: setting.EnableDoubleClickEdit,
		Reactions:             setting.Reactions,
	}
}

func convertInstanceMemoRelatedSettingToStore(setting *v1pb.InstanceSetting_MemoRelatedSetting) *storepb.InstanceMemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &storepb.InstanceMemoRelatedSetting{
		ContentLengthLimit:    setting.ContentLengthLimit,
		EnableDoubleClickEdit: setting.EnableDoubleClickEdit,
		Reactions:             setting.Reactions,
	}
}

func convertInstanceTagsSettingFromStore(setting *storepb.InstanceTagsSetting) *v1pb.InstanceSetting_TagsSetting {
	if setting == nil {
		return nil
	}
	tags := make(map[string]*v1pb.InstanceSetting_TagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		tags[tag] = &v1pb.InstanceSetting_TagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &v1pb.InstanceSetting_TagsSetting{
		Tags: tags,
	}
}

func convertInstanceTagsSettingToStore(setting *v1pb.InstanceSetting_TagsSetting) *storepb.InstanceTagsSetting {
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

func convertInstanceNotificationSettingFromStore(setting *storepb.InstanceNotificationSetting) *v1pb.InstanceSetting_NotificationSetting {
	if setting == nil {
		return nil
	}

	notificationSetting := &v1pb.InstanceSetting_NotificationSetting{}
	if setting.Email != nil {
		notificationSetting.Email = &v1pb.InstanceSetting_NotificationSetting_EmailSetting{
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

func convertInstanceNotificationSettingToStore(setting *v1pb.InstanceSetting_NotificationSetting) *storepb.InstanceNotificationSetting {
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

func convertInstanceAISettingFromStore(setting *storepb.InstanceAISetting) *v1pb.InstanceSetting_AISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &v1pb.InstanceSetting_AISetting{
		Providers:     make([]*v1pb.InstanceSetting_AIProviderConfig, 0, len(setting.Providers)),
		Transcription: convertTranscriptionConfigFromStore(setting.GetTranscription()),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		apiKey := provider.GetApiKey()
		aiSetting.Providers = append(aiSetting.Providers, &v1pb.InstanceSetting_AIProviderConfig{
			Id:         provider.GetId(),
			Title:      provider.GetTitle(),
			Type:       v1pb.InstanceSetting_AIProviderType(provider.GetType()),
			Endpoint:   provider.GetEndpoint(),
			ApiKeySet:  apiKey != "",
			ApiKeyHint: maskAPIKey(apiKey),
		})
	}
	return aiSetting
}

func convertInstanceAISettingToStore(setting *v1pb.InstanceSetting_AISetting) *storepb.InstanceAISetting {
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

func convertTranscriptionConfigFromStore(setting *storepb.TranscriptionConfig) *v1pb.InstanceSetting_TranscriptionConfig {
	if setting == nil {
		return nil
	}
	return &v1pb.InstanceSetting_TranscriptionConfig{
		ProviderId: setting.GetProviderId(),
		Model:      setting.GetModel(),
		Language:   setting.GetLanguage(),
		Prompt:     setting.GetPrompt(),
	}
}

func convertTranscriptionConfigToStore(setting *v1pb.InstanceSetting_TranscriptionConfig) *storepb.TranscriptionConfig {
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

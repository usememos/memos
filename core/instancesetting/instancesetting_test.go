package instancesetting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestValidateRequiresValueMatchingKey(t *testing.T) {
	for _, key := range []storepb.InstanceSettingKey{
		storepb.InstanceSettingKey_GENERAL,
		storepb.InstanceSettingKey_STORAGE,
		storepb.InstanceSettingKey_MEMO_RELATED,
		storepb.InstanceSettingKey_TAGS,
		storepb.InstanceSettingKey_NOTIFICATION,
		storepb.InstanceSettingKey_AI,
		storepb.InstanceSettingKey_ACCESS,
		storepb.InstanceSettingKey_USAGE_LIMITS,
	} {
		// A GENERAL value under every other key is a mismatch; under GENERAL
		// the MEMO_RELATED value is.
		setting := &storepb.InstanceSetting{
			Key:   key,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{}},
		}
		if key == storepb.InstanceSettingKey_GENERAL {
			setting.Value = &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: &storepb.InstanceMemoRelatedSetting{}}
		}
		require.Error(t, Validate(setting), key.String())
	}
}

func TestValidateRejectsUnwritableKeys(t *testing.T) {
	err := Validate(&storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: &storepb.InstanceBasicSetting{}},
	})
	require.ErrorContains(t, err, "cannot be written")
	require.ErrorContains(t, Validate(&storepb.InstanceSetting{Key: storepb.InstanceSettingKey_CONFIGURATION_STATE}), "state record")
	require.ErrorContains(t, Validate(&storepb.InstanceSetting{}), "unsupported instance setting key")
	require.Error(t, Validate(nil))
}

func TestValidateGeneral(t *testing.T) {
	general := func(offset int32) *storepb.InstanceSetting {
		return &storepb.InstanceSetting{
			Key:   storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{WeekStartDayOffset: offset}},
		}
	}
	require.NoError(t, Validate(general(-1)))
	require.NoError(t, Validate(general(6)))
	require.ErrorContains(t, Validate(general(7)), "week_start_day_offset")
	require.ErrorContains(t, Validate(general(-2)), "week_start_day_offset")
}

func TestValidateAccess(t *testing.T) {
	access := func(mode storepb.InstanceAccessMode) *storepb.InstanceSetting {
		return &storepb.InstanceSetting{
			Key:   storepb.InstanceSettingKey_ACCESS,
			Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{AccessMode: mode}},
		}
	}
	require.NoError(t, Validate(access(storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)))
	require.NoError(t, Validate(access(storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)))
	require.ErrorContains(t, Validate(access(storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_UNSPECIFIED)), "access_mode")
}

func TestValidateNotification(t *testing.T) {
	notification := func(email *storepb.InstanceNotificationSetting_EmailSetting) *storepb.InstanceSetting {
		return &storepb.InstanceSetting{
			Key:   storepb.InstanceSettingKey_NOTIFICATION,
			Value: &storepb.InstanceSetting_NotificationSetting{NotificationSetting: &storepb.InstanceNotificationSetting{Email: email}},
		}
	}
	require.NoError(t, Validate(notification(nil)))
	require.NoError(t, Validate(notification(&storepb.InstanceNotificationSetting_EmailSetting{Enabled: false})))
	require.NoError(t, Validate(notification(&storepb.InstanceNotificationSetting_EmailSetting{
		Enabled: true, SmtpHost: "smtp.example.com", SmtpPort: 587, FromEmail: "memos@example.com", UseTls: true,
	})))
	require.ErrorContains(t, Validate(notification(&storepb.InstanceNotificationSetting_EmailSetting{
		Enabled: true, SmtpHost: "smtp.example.com", FromEmail: "memos@example.com",
	})), "smtp_port")
	require.ErrorContains(t, Validate(notification(&storepb.InstanceNotificationSetting_EmailSetting{
		Enabled: true, SmtpHost: "smtp.example.com", SmtpPort: 465, FromEmail: "memos@example.com", UseTls: true, UseSsl: true,
	})), "use_tls and use_ssl")
}

func aiSetting(providers ...*storepb.AIProviderConfig) *storepb.InstanceSetting {
	return &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_AI,
		Value: &storepb.InstanceSetting_AiSetting{AiSetting: &storepb.InstanceAISetting{Providers: providers}},
	}
}

func TestValidateAI(t *testing.T) {
	provider := func(id string) *storepb.AIProviderConfig {
		return &storepb.AIProviderConfig{Id: id, Title: "OpenAI", Type: storepb.AIProviderType_OPENAI, ApiKey: "key"}
	}
	require.NoError(t, Validate(aiSetting()))
	require.NoError(t, Validate(aiSetting(provider("a"), provider("b"))))
	require.ErrorContains(t, Validate(aiSetting(provider(""))), "id is required")
	require.ErrorContains(t, Validate(aiSetting(provider("a"), provider("a"))), "duplicate provider ID")

	noKey := provider("a")
	noKey.ApiKey = ""
	require.ErrorContains(t, Validate(aiSetting(noKey)), "API key is required")

	badType := provider("a")
	badType.Type = storepb.AIProviderType_AI_PROVIDER_TYPE_UNSPECIFIED
	require.ErrorContains(t, Validate(aiSetting(badType)), "unsupported type")

	setting := aiSetting(provider("a"))
	setting.GetAiSetting().Transcription = &storepb.TranscriptionConfig{ProviderId: "missing"}
	require.ErrorContains(t, Validate(setting), "does not reference")
	setting.GetAiSetting().Transcription = &storepb.TranscriptionConfig{ProviderId: "a", Language: strings.Repeat("x", MaxTranscriptionLanguageLength+1)}
	require.ErrorContains(t, Validate(setting), "language is too long")
}

func TestNormalizeAISetting(t *testing.T) {
	setting := &storepb.InstanceAISetting{
		Providers: []*storepb.AIProviderConfig{
			{Id: " a ", Title: " OpenAI ", Type: storepb.AIProviderType_OPENAI},
			{Id: "b", Type: storepb.AIProviderType_GEMINI, Endpoint: " https://proxy.example.com "},
			nil,
		},
		Transcription: &storepb.TranscriptionConfig{ProviderId: " a ", Model: " whisper-1 "},
	}
	NormalizeAISetting(setting)
	require.Equal(t, "a", setting.Providers[0].Id)
	require.Equal(t, "OpenAI", setting.Providers[0].Title)
	require.Equal(t, DefaultOpenAIEndpoint, setting.Providers[0].Endpoint)
	require.Equal(t, "https://proxy.example.com", setting.Providers[1].Endpoint)
	require.Equal(t, "a", setting.Transcription.ProviderId)
	require.Equal(t, "whisper-1", setting.Transcription.Model)
}

func s3Storage(id string) *storepb.Storage {
	return &storepb.Storage{
		Id:   id,
		Type: storepb.StorageType_STORAGE_TYPE_S3,
		Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
			Endpoint: "https://s3.example.com", Region: "us-east-1", Bucket: "memos", AccessKeyId: "AKID", AccessKeySecret: "secret",
		}},
	}
}

func storageSetting(defaultID string, storages ...*storepb.Storage) *storepb.InstanceSetting {
	return &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			Storages:         storages,
			DefaultStorageId: defaultID,
		}},
	}
}

func TestValidateStorage(t *testing.T) {
	local := &storepb.Storage{Id: "local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}
	require.NoError(t, Validate(storageSetting("main", s3Storage("main"), local)))
	require.ErrorContains(t, Validate(storageSetting("mian", s3Storage("main"))), `default storage "mian" is not configured`)
	require.ErrorContains(t, Validate(storageSetting("main", s3Storage("main"), s3Storage("main"))), "duplicated")
	require.ErrorContains(t, Validate(storageSetting("main", s3Storage(""))), "storages[0].id is required")
	require.ErrorContains(t, Validate(storageSetting("x", &storepb.Storage{Id: "x"})), "type is required")

	for field, clear := range map[string]func(*storepb.StorageS3Config){
		"endpoint":          func(c *storepb.StorageS3Config) { c.Endpoint = "" },
		"region":            func(c *storepb.StorageS3Config) { c.Region = "" },
		"bucket":            func(c *storepb.StorageS3Config) { c.Bucket = "" },
		"access_key_id":     func(c *storepb.StorageS3Config) { c.AccessKeyId = "" },
		"access_key_secret": func(c *storepb.StorageS3Config) { c.AccessKeySecret = "" },
	} {
		incomplete := s3Storage("archive")
		clear(incomplete.GetS3Config())
		// A non-default storage is checked as strictly as the default one.
		err := Validate(storageSetting("local", local, incomplete))
		require.ErrorContains(t, err, `storage archive `+field+` is required`, field)
	}

	legacy := &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{StorageType: storepb.InstanceStorageSetting_S3}},
	}
	require.ErrorContains(t, Validate(legacy), "s3_config is required")
	legacy.GetStorageSetting().StorageType = storepb.InstanceStorageSetting_LOCAL
	require.NoError(t, Validate(legacy))
}

func TestValidateUpdateSkipsUnchangedStorages(t *testing.T) {
	stale := s3Storage("old")
	stale.GetS3Config().Region = ""
	existing := storageSetting("old", stale)

	// Switching the default away from a storage stored before region was
	// required does not fail on that storage.
	update := storageSetting("local", &storepb.Storage{Id: "local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}, proto.CloneOf(stale))
	require.NoError(t, ValidateUpdate(update, existing))
	require.Error(t, Validate(update), "without an existing setting every storage is checked")

	// Editing the stale storage checks it again.
	edited := proto.CloneOf(stale)
	edited.GetS3Config().Bucket = "renamed"
	require.ErrorContains(t, ValidateUpdate(storageSetting("old", edited), existing), "region is required")
}

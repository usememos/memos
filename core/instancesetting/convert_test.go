package instancesetting

import (
	"testing"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// TestConversionRoundTrips converts fully populated stored settings to the API
// and back. Secrets survive, because comparing configuration with stored state
// needs them; responses redact them in server/api.
func TestConversionRoundTrips(t *testing.T) {
	s3 := &storepb.StorageS3Config{
		AccessKeyId: "AKID", AccessKeySecret: "secret", Endpoint: "https://s3.example.com", Region: "auto",
		Bucket: "memos", UsePathStyle: true, InsecureSkipTlsVerify: true,
	}
	settings := []*storepb.InstanceSetting{
		{Key: storepb.InstanceSettingKey_GENERAL, Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
			DisallowUserRegistration: true, DisallowPasswordAuth: true, AdditionalScript: "s", AdditionalStyle: "c",
			WeekStartDayOffset: 1, DisallowChangeUsername: true, DisallowChangeNickname: true,
			CustomProfile: &storepb.InstanceCustomProfile{Title: "t", Description: "d", LogoUrl: "https://example.com/logo.png"},
		}}},
		{Key: storepb.InstanceSettingKey_STORAGE, Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			StorageType: storepb.InstanceStorageSetting_S3, FilepathTemplate: "assets/{filename}", S3Config: proto.CloneOf(s3),
			Storages: []*storepb.Storage{
				{Id: "s3", Name: "Archive", Type: storepb.StorageType_STORAGE_TYPE_S3, Config: &storepb.Storage_S3Config{S3Config: proto.CloneOf(s3)}},
				{Id: "local", Name: "Local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL},
			},
			DefaultStorageId: "s3",
		}}},
		{Key: storepb.InstanceSettingKey_MEMO_RELATED, Value: &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: &storepb.InstanceMemoRelatedSetting{
			Reactions: []string{"👍", "🎉"},
		}}},
		{Key: storepb.InstanceSettingKey_TAGS, Value: &storepb.InstanceSetting_TagsSetting{TagsSetting: &storepb.InstanceTagsSetting{
			Tags: map[string]*storepb.InstanceTagMetadata{"work": {BackgroundColor: &colorpb.Color{Red: 1}, BlurContent: true}},
		}}},
		{Key: storepb.InstanceSettingKey_NOTIFICATION, Value: &storepb.InstanceSetting_NotificationSetting{NotificationSetting: &storepb.InstanceNotificationSetting{
			Email: &storepb.InstanceNotificationSetting_EmailSetting{
				Enabled: true, SmtpHost: "smtp.example.com", SmtpPort: 587, SmtpUsername: "memos", SmtpPassword: "password",
				FromEmail: "memos@example.com", FromName: "Memos", ReplyTo: "support@example.com", UseTls: true,
			},
		}}},
		{Key: storepb.InstanceSettingKey_AI, Value: &storepb.InstanceSetting_AiSetting{AiSetting: &storepb.InstanceAISetting{
			Providers: []*storepb.AIProviderConfig{
				{Id: "openai", Title: "OpenAI", Type: storepb.AIProviderType_OPENAI, Endpoint: DefaultOpenAIEndpoint, ApiKey: "sk-secret"},
			},
			Transcription: &storepb.TranscriptionConfig{ProviderId: "openai", Model: "whisper-1", Language: "en", Prompt: "notes"},
		}}},
		{Key: storepb.InstanceSettingKey_ACCESS, Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC,
		}}},
	}
	for _, setting := range settings {
		t.Run(setting.Key.String(), func(t *testing.T) {
			api := FromStore(setting)
			require.Equal(t, NamePrefix+setting.Key.String(), api.GetName())
			require.True(t, proto.Equal(setting, ToStore(api)), "round trip changed %s", setting.Key)
		})
	}
}

func TestUsageLimitsConversion(t *testing.T) {
	stored := &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		{UserIds: []int32{1, 2, 3}, MemoCount: new(int64(100))},
		{AllUsers: true, UploadBytes: new(int64(1 << 20))},
	}}
	// User 3 no longer exists, so it is left out.
	api := UsageLimitsFromStore(stored, map[int32]string{1: "users/alice", 2: "users/bob"})
	require.Equal(t, []string{"users/alice", "users/bob"}, api.GetLimits()[0].GetUsers())
	require.True(t, api.GetLimits()[1].GetAllUsers())

	back, err := UsageLimitsToStore(api, map[string]int32{"users/alice": 1, "users/bob": 2})
	require.NoError(t, err)
	require.Equal(t, []int32{1, 2}, back.GetLimits()[0].GetUserIds())
	require.Equal(t, int64(100), back.GetLimits()[0].GetMemoCount())
	require.Equal(t, int64(1<<20), back.GetLimits()[1].GetUploadBytes())

	_, err = UsageLimitsToStore(api, map[string]int32{"users/alice": 1})
	require.ErrorContains(t, err, `user "users/bob" not found`)
}

func TestToStoreRejectsUnknownNames(t *testing.T) {
	require.Equal(t, storepb.InstanceSettingKey_INSTANCE_SETTING_KEY_UNSPECIFIED, ToStore(FromStore(&storepb.InstanceSetting{})).Key)
	require.Error(t, Validate(ToStore(FromStore(&storepb.InstanceSetting{Key: storepb.InstanceSettingKey_GENERAL}))),
		"a setting without a value fails validation")
}

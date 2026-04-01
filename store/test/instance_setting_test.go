package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestInstanceSettingV1Store(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	instanceSetting, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{
				AdditionalScript: "",
			},
		},
	})
	require.NoError(t, err)
	setting, err := ts.GetInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_GENERAL.String(),
	})
	require.NoError(t, err)
	require.Equal(t, instanceSetting, setting)
	ts.Close()
}

func TestInstanceSettingGetNonExistent(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get non-existent setting
	setting, err := ts.GetInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_STORAGE.String(),
	})
	require.NoError(t, err)
	require.Nil(t, setting)

	ts.Close()
}

func TestInstanceSettingUpsertUpdate(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create setting
	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{
				AdditionalScript: "console.log('v1')",
			},
		},
	})
	require.NoError(t, err)

	// Update setting
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{
				AdditionalScript: "console.log('v2')",
			},
		},
	})
	require.NoError(t, err)

	// Verify update
	setting, err := ts.GetInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_GENERAL.String(),
	})
	require.NoError(t, err)
	require.Equal(t, "console.log('v2')", setting.GetGeneralSetting().AdditionalScript)

	// Verify only one setting exists
	list, err := ts.ListInstanceSettings(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_GENERAL.String(),
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))

	ts.Close()
}

func TestInstanceSettingBasicSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get default basic setting (should return empty defaults)
	basicSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, basicSetting)

	// Set basic setting
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{
			BasicSetting: &storepb.InstanceBasicSetting{
				SecretKey: "my-secret-key",
			},
		},
	})
	require.NoError(t, err)

	// Verify
	basicSetting, err = ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "my-secret-key", basicSetting.SecretKey)

	ts.Close()
}

func TestInstanceSettingGeneralSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get default general setting
	generalSetting, err := ts.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, generalSetting)

	// Set general setting
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{
				AdditionalScript: "console.log('test')",
				AdditionalStyle:  "body { color: red; }",
			},
		},
	})
	require.NoError(t, err)

	// Verify
	generalSetting, err = ts.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "console.log('test')", generalSetting.AdditionalScript)
	require.Equal(t, "body { color: red; }", generalSetting.AdditionalStyle)

	ts.Close()
}

func TestInstanceSettingMemoRelatedSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get default memo related setting (should have defaults)
	memoSetting, err := ts.GetInstanceMemoRelatedSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, memoSetting)
	require.GreaterOrEqual(t, memoSetting.ContentLengthLimit, int32(store.DefaultContentLengthLimit))
	require.NotEmpty(t, memoSetting.Reactions)

	// Set custom memo related setting
	customReactions := []string{"👍", "👎", "🚀"}
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_MEMO_RELATED,
		Value: &storepb.InstanceSetting_MemoRelatedSetting{
			MemoRelatedSetting: &storepb.InstanceMemoRelatedSetting{
				ContentLengthLimit: 16384,
				Reactions:          customReactions,
			},
		},
	})
	require.NoError(t, err)

	// Verify
	memoSetting, err = ts.GetInstanceMemoRelatedSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, int32(16384), memoSetting.ContentLengthLimit)
	require.Equal(t, customReactions, memoSetting.Reactions)

	ts.Close()
}

func TestInstanceSettingStorageSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get default storage setting (should have defaults)
	storageSetting, err := ts.GetInstanceStorageSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, storageSetting)
	require.Equal(t, storepb.InstanceStorageSetting_LOCAL, storageSetting.StorageType)
	require.Equal(t, int64(30), storageSetting.UploadSizeLimitMb)
	require.Equal(t, "assets/{timestamp}_{uuid}_{filename}", storageSetting.FilepathTemplate)

	// Set custom storage setting
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{
			StorageSetting: &storepb.InstanceStorageSetting{
				StorageType:       storepb.InstanceStorageSetting_LOCAL,
				UploadSizeLimitMb: 100,
				FilepathTemplate:  "uploads/{date}/{filename}",
			},
		},
	})
	require.NoError(t, err)

	// Verify
	storageSetting, err = ts.GetInstanceStorageSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, storepb.InstanceStorageSetting_LOCAL, storageSetting.StorageType)
	require.Equal(t, int64(100), storageSetting.UploadSizeLimitMb)
	require.Equal(t, "uploads/{date}/{filename}", storageSetting.FilepathTemplate)

	ts.Close()
}

func TestInstanceSettingTagsSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	tagsSetting, err := ts.GetInstanceTagsSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, tagsSetting)
	require.Empty(t, tagsSetting.Tags)

	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_TAGS,
		Value: &storepb.InstanceSetting_TagsSetting{
			TagsSetting: &storepb.InstanceTagsSetting{
				Tags: map[string]*storepb.InstanceTagMetadata{
					"bug": {
						BackgroundColor: &colorpb.Color{
							Red:   0.9,
							Green: 0.1,
							Blue:  0.1,
						},
					},
				},
			},
		},
	})
	require.NoError(t, err)

	tagsSetting, err = ts.GetInstanceTagsSetting(ctx)
	require.NoError(t, err)
	require.Contains(t, tagsSetting.Tags, "bug")
	require.InDelta(t, 0.9, tagsSetting.Tags["bug"].GetBackgroundColor().GetRed(), 0.0001)

	ts.Close()
}

func TestInstanceSettingTagsSettingWithoutColor(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_TAGS,
		Value: &storepb.InstanceSetting_TagsSetting{
			TagsSetting: &storepb.InstanceTagsSetting{
				Tags: map[string]*storepb.InstanceTagMetadata{
					"spoiler": {
						BlurContent: true,
					},
				},
			},
		},
	})
	require.NoError(t, err)

	tagsSetting, err := ts.GetInstanceTagsSetting(ctx)
	require.NoError(t, err)
	require.Contains(t, tagsSetting.Tags, "spoiler")
	require.Nil(t, tagsSetting.Tags["spoiler"].GetBackgroundColor())
	require.True(t, tagsSetting.Tags["spoiler"].GetBlurContent())

	ts.Close()
}

func TestInstanceSettingNotificationSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	notificationSetting, err := ts.GetInstanceNotificationSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, notificationSetting)
	require.NotNil(t, notificationSetting.Email)
	require.False(t, notificationSetting.Email.Enabled)

	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: &storepb.InstanceNotificationSetting{
				Email: &storepb.InstanceNotificationSetting_EmailSetting{
					Enabled:      true,
					SmtpHost:     "smtp.example.com",
					SmtpPort:     587,
					SmtpUsername: "bot@example.com",
					SmtpPassword: "secret",
					FromEmail:    "bot@example.com",
					FromName:     "Memos Bot",
					ReplyTo:      "support@example.com",
					UseTls:       true,
				},
			},
		},
	})
	require.NoError(t, err)

	notificationSetting, err = ts.GetInstanceNotificationSetting(ctx)
	require.NoError(t, err)
	require.True(t, notificationSetting.Email.Enabled)
	require.Equal(t, "smtp.example.com", notificationSetting.Email.SmtpHost)
	require.Equal(t, int32(587), notificationSetting.Email.SmtpPort)
	require.Equal(t, "bot@example.com", notificationSetting.Email.FromEmail)

	ts.Close()
}

func TestInstanceSettingListAll(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Count initial settings
	initialList, err := ts.ListInstanceSettings(ctx, &store.FindInstanceSetting{})
	require.NoError(t, err)
	initialCount := len(initialList)

	// Create multiple settings
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{},
		},
	})
	require.NoError(t, err)

	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{
			StorageSetting: &storepb.InstanceStorageSetting{},
		},
	})
	require.NoError(t, err)

	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: &storepb.InstanceNotificationSetting{},
		},
	})
	require.NoError(t, err)

	// List all - should have 3 more than initial
	list, err := ts.ListInstanceSettings(ctx, &store.FindInstanceSetting{})
	require.NoError(t, err)
	require.Equal(t, initialCount+3, len(list))

	ts.Close()
}

func TestInstanceSettingEdgeCases(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Case 1: General Setting with special characters and Unicode
	specialScript := `<script>alert("你好"); var x = 'test\'s';</script>`
	specialStyle := `body { font-family: "Noto Sans SC", sans-serif; content: "\u2764"; }`
	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{
				AdditionalScript: specialScript,
				AdditionalStyle:  specialStyle,
			},
		},
	})
	require.NoError(t, err)

	generalSetting, err := ts.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, specialScript, generalSetting.AdditionalScript)
	require.Equal(t, specialStyle, generalSetting.AdditionalStyle)

	// Case 2: Memo Related Setting with Unicode reactions
	unicodeReactions := []string{"🐱", "🐶", "🦊", "🦄"}
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_MEMO_RELATED,
		Value: &storepb.InstanceSetting_MemoRelatedSetting{
			MemoRelatedSetting: &storepb.InstanceMemoRelatedSetting{
				ContentLengthLimit: 1000,
				Reactions:          unicodeReactions,
			},
		},
	})
	require.NoError(t, err)

	memoSetting, err := ts.GetInstanceMemoRelatedSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, unicodeReactions, memoSetting.Reactions)

	ts.Close()
}

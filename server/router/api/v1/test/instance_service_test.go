package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestGetInstanceProfile(t *testing.T) {
	ctx := context.Background()

	t.Run("GetInstanceProfile returns instance profile", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetInstanceProfile directly
		req := &v1pb.GetInstanceProfileRequest{}
		resp, err := ts.Service.GetInstanceProfile(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify the response contains expected data
		require.Equal(t, "test-1.0.0", resp.Version)
		require.True(t, resp.Demo)
		require.Equal(t, "http://localhost:8080", resp.InstanceUrl)

		// Instance should not be initialized since no admin users are created
		require.Nil(t, resp.Admin)
	})

	t.Run("GetInstanceProfile with initialized instance", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user in the store
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		require.NotNil(t, hostUser)

		// Call GetInstanceProfile directly
		req := &v1pb.GetInstanceProfileRequest{}
		resp, err := ts.Service.GetInstanceProfile(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify the response contains expected data with initialized flag
		require.Equal(t, "test-1.0.0", resp.Version)
		require.True(t, resp.Demo)
		require.Equal(t, "http://localhost:8080", resp.InstanceUrl)

		// Instance should be initialized since an admin user exists
		require.NotNil(t, resp.Admin)
		require.Equal(t, hostUser.Username, resp.Admin.Username)
	})
}

func TestGetInstanceProfile_Concurrency(t *testing.T) {
	ctx := context.Background()

	t.Run("Concurrent access to service", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Make concurrent requests
		numGoroutines := 10
		results := make(chan *v1pb.InstanceProfile, numGoroutines)
		errors := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func() {
				req := &v1pb.GetInstanceProfileRequest{}
				resp, err := ts.Service.GetInstanceProfile(ctx, req)
				if err != nil {
					errors <- err
					return
				}
				results <- resp
			}()
		}

		// Collect all results
		for i := 0; i < numGoroutines; i++ {
			select {
			case err := <-errors:
				t.Fatalf("Goroutine returned error: %v", err)
			case resp := <-results:
				require.NotNil(t, resp)
				require.Equal(t, "test-1.0.0", resp.Version)
				require.True(t, resp.Demo)
				require.Equal(t, "http://localhost:8080", resp.InstanceUrl)
				require.NotNil(t, resp.Admin)
			}
		}
	})
}

func TestGetInstanceSetting(t *testing.T) {
	ctx := context.Background()

	t.Run("GetInstanceSetting - general setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetInstanceSetting for general setting
		req := &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/GENERAL",
		}
		resp, err := ts.Service.GetInstanceSetting(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/GENERAL", resp.Name)

		// The general setting should have a general_setting field
		generalSetting := resp.GetGeneralSetting()
		require.NotNil(t, generalSetting)

		// General setting should have default values
		require.False(t, generalSetting.DisallowUserRegistration)
		require.False(t, generalSetting.DisallowPasswordAuth)
		require.Empty(t, generalSetting.AdditionalScript)
	})

	t.Run("GetInstanceSetting - storage setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user for storage setting access
		hostUser, err := ts.CreateHostUser(ctx, "testhost")
		require.NoError(t, err)

		// Add user to context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Call GetInstanceSetting for storage setting
		req := &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/STORAGE",
		}
		resp, err := ts.Service.GetInstanceSetting(userCtx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/STORAGE", resp.Name)

		// The storage setting should have a storage_setting field
		storageSetting := resp.GetStorageSetting()
		require.NotNil(t, storageSetting)
	})

	t.Run("GetInstanceSetting - memo related setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetInstanceSetting for memo related setting
		req := &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/MEMO_RELATED",
		}
		resp, err := ts.Service.GetInstanceSetting(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/MEMO_RELATED", resp.Name)

		// The memo related setting should have a memo_related_setting field
		memoRelatedSetting := resp.GetMemoRelatedSetting()
		require.NotNil(t, memoRelatedSetting)
	})

	t.Run("GetInstanceSetting - tags setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/TAGS",
		}
		resp, err := ts.Service.GetInstanceSetting(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/TAGS", resp.Name)
		require.NotNil(t, resp.GetTagsSetting())
		require.Empty(t, resp.GetTagsSetting().GetTags())
	})

	t.Run("GetInstanceSetting - notification setting requires admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		req := &v1pb.GetInstanceSettingRequest{Name: "instance/settings/NOTIFICATION"}

		// Unauthenticated request must be rejected.
		_, err = ts.Service.GetInstanceSetting(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")

		// Non-admin request must be rejected.
		_, err = ts.Service.GetInstanceSetting(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		// Admin request succeeds and does NOT expose SmtpPassword.
		resp, err := ts.Service.GetInstanceSetting(adminCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/NOTIFICATION", resp.Name)
		require.NotNil(t, resp.GetNotificationSetting())
		require.Empty(t, resp.GetNotificationSetting().GetEmail().GetSmtpPassword(),
			"SmtpPassword must never be returned in responses")
	})

	t.Run("GetInstanceSetting - AI setting requires admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		req := &v1pb.GetInstanceSettingRequest{Name: "instance/settings/AI"}

		_, err = ts.Service.GetInstanceSetting(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")

		_, err = ts.Service.GetInstanceSetting(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		resp, err := ts.Service.GetInstanceSetting(adminCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.GetAiSetting())
		require.Empty(t, resp.GetAiSetting().GetProviders())
	})

	t.Run("GetInstanceSetting - invalid setting name", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetInstanceSetting with invalid name
		req := &v1pb.GetInstanceSettingRequest{
			Name: "invalid/setting/name",
		}
		_, err := ts.Service.GetInstanceSetting(ctx, req)

		// Should return an error
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid instance setting name")
	})
}

func TestUpdateInstanceSetting(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateInstanceSetting - AI setting requires admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		setting := &v1pb.InstanceSetting{
			Name: "instance/settings/AI",
			Value: &v1pb.InstanceSetting_AiSetting{
				AiSetting: &v1pb.InstanceSetting_AISetting{
					Providers: []*v1pb.InstanceSetting_AIProviderConfig{
						{
							Id:           "openai-main",
							Title:        "OpenAI",
							Type:         v1pb.InstanceSetting_OPENAI,
							ApiKey:       "sk-test",
							Models:       []string{"gpt-4o-transcribe"},
							DefaultModel: "gpt-4o-transcribe",
						},
					},
				},
			},
		}

		_, err = ts.Service.UpdateInstanceSetting(ctx, &v1pb.UpdateInstanceSettingRequest{Setting: setting})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")

		_, err = ts.Service.UpdateInstanceSetting(userCtx, &v1pb.UpdateInstanceSettingRequest{Setting: setting})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("UpdateInstanceSetting - tags setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		resp, err := ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/TAGS",
				Value: &v1pb.InstanceSetting_TagsSetting_{
					TagsSetting: &v1pb.InstanceSetting_TagsSetting{
						Tags: map[string]*v1pb.InstanceSetting_TagMetadata{
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
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"tags"}},
		})
		require.NoError(t, err)
		require.NotNil(t, resp.GetTagsSetting())
		require.Contains(t, resp.GetTagsSetting().GetTags(), "bug")
	})

	t.Run("UpdateInstanceSetting - invalid tags color", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		_, err = ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/TAGS",
				Value: &v1pb.InstanceSetting_TagsSetting_{
					TagsSetting: &v1pb.InstanceSetting_TagsSetting{
						Tags: map[string]*v1pb.InstanceSetting_TagMetadata{
							"bug": {
								BackgroundColor: &colorpb.Color{
									Red:   1.2,
									Green: 0.1,
									Blue:  0.1,
								},
							},
						},
					},
				},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid instance setting")
	})

	t.Run("UpdateInstanceSetting - tags setting without color", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		resp, err := ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/TAGS",
				Value: &v1pb.InstanceSetting_TagsSetting_{
					TagsSetting: &v1pb.InstanceSetting_TagsSetting{
						Tags: map[string]*v1pb.InstanceSetting_TagMetadata{
							"spoiler": {
								BlurContent: true,
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp.GetTagsSetting())
		require.Contains(t, resp.GetTagsSetting().GetTags(), "spoiler")
		require.Nil(t, resp.GetTagsSetting().GetTags()["spoiler"].GetBackgroundColor())
		require.True(t, resp.GetTagsSetting().GetTags()["spoiler"].GetBlurContent())
	})

	t.Run("UpdateInstanceSetting - notification setting password is write-only", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Save notification setting with a password.
		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/NOTIFICATION",
				Value: &v1pb.InstanceSetting_NotificationSetting_{
					NotificationSetting: &v1pb.InstanceSetting_NotificationSetting{
						Email: &v1pb.InstanceSetting_NotificationSetting_EmailSetting{
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
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"notification_setting"}},
		})
		require.NoError(t, err)
		require.True(t, resp.GetNotificationSetting().GetEmail().GetEnabled())
		require.Equal(t, "smtp.example.com", resp.GetNotificationSetting().GetEmail().GetSmtpHost())
		// Password must not be returned even in the update response.
		require.Empty(t, resp.GetNotificationSetting().GetEmail().GetSmtpPassword(),
			"SmtpPassword must never be returned in responses")
	})

	t.Run("UpdateInstanceSetting - empty password preserves existing credential", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		notificationSetting := &v1pb.InstanceSetting{
			Name: "instance/settings/NOTIFICATION",
			Value: &v1pb.InstanceSetting_NotificationSetting_{
				NotificationSetting: &v1pb.InstanceSetting_NotificationSetting{
					Email: &v1pb.InstanceSetting_NotificationSetting_EmailSetting{
						Enabled:      true,
						SmtpHost:     "smtp.example.com",
						SmtpPort:     587,
						SmtpUsername: "bot@example.com",
						SmtpPassword: "original-password",
						FromEmail:    "bot@example.com",
					},
				},
			},
		}

		// First save with a real password.
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: notificationSetting,
		})
		require.NoError(t, err)

		// Second update with an empty password (simulating a UI that doesn't re-send the secret).
		notificationSetting.GetNotificationSetting().GetEmail().SmtpPassword = ""
		notificationSetting.GetNotificationSetting().GetEmail().SmtpHost = "smtp2.example.com"
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: notificationSetting,
		})
		require.NoError(t, err)

		// The stored setting should have preserved the original password.
		stored, err := ts.Store.GetInstanceNotificationSetting(ctx)
		require.NoError(t, err)
		require.Equal(t, "original-password", stored.GetEmail().GetSmtpPassword(),
			"existing SmtpPassword must be preserved when an empty value is sent")
		require.Equal(t, "smtp2.example.com", stored.GetEmail().GetSmtpHost())
	})

	t.Run("UpdateInstanceSetting - S3 secret is write-only and preserved on empty", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Save storage setting with a real secret.
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &v1pb.InstanceSetting_StorageSetting_{
					StorageSetting: &v1pb.InstanceSetting_StorageSetting{
						S3Config: &v1pb.InstanceSetting_StorageSetting_S3Config{
							AccessKeyId:     "AKID",
							AccessKeySecret: "super-secret",
							Endpoint:        "s3.example.com",
							Region:          "us-east-1",
							Bucket:          "memos",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		// Read back: secret must not be returned.
		resp, err := ts.Service.GetInstanceSetting(adminCtx, &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/STORAGE",
		})
		require.NoError(t, err)
		require.Empty(t, resp.GetStorageSetting().GetS3Config().GetAccessKeySecret(),
			"AccessKeySecret must never be returned in responses")

		// Update with empty secret; original must be preserved in the store.
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &v1pb.InstanceSetting_StorageSetting_{
					StorageSetting: &v1pb.InstanceSetting_StorageSetting{
						S3Config: &v1pb.InstanceSetting_StorageSetting_S3Config{
							AccessKeyId:     "AKID",
							AccessKeySecret: "", // omitted / not changed
							Endpoint:        "s3-v2.example.com",
							Region:          "us-east-1",
							Bucket:          "memos",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		stored, err := ts.Store.GetInstanceStorageSetting(ctx)
		require.NoError(t, err)
		require.Equal(t, "super-secret", stored.GetS3Config().GetAccessKeySecret(),
			"existing AccessKeySecret must be preserved when an empty value is sent")
		require.Equal(t, "s3-v2.example.com", stored.GetS3Config().GetEndpoint())
	})

	t.Run("UpdateInstanceSetting - AI provider keys are write-only and preserved on empty", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &v1pb.InstanceSetting_AiSetting{
					AiSetting: &v1pb.InstanceSetting_AISetting{
						Providers: []*v1pb.InstanceSetting_AIProviderConfig{
							{
								Id:           "openai-main",
								Title:        "OpenAI",
								Type:         v1pb.InstanceSetting_OPENAI,
								ApiKey:       "sk-original",
								Models:       []string{"gpt-5.4", "gpt-5.4-mini"},
								DefaultModel: "gpt-5.4",
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := ts.Service.GetInstanceSetting(adminCtx, &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/AI",
		})
		require.NoError(t, err)
		require.Len(t, resp.GetAiSetting().GetProviders(), 1)
		provider := resp.GetAiSetting().GetProviders()[0]
		require.Empty(t, provider.GetApiKey(), "AI provider API key must never be returned in responses")
		require.True(t, provider.GetApiKeySet())
		require.Equal(t, "sk-o...inal", provider.GetApiKeyHint())
		require.Equal(t, "https://api.openai.com/v1", provider.GetEndpoint())

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &v1pb.InstanceSetting_AiSetting{
					AiSetting: &v1pb.InstanceSetting_AISetting{
						Providers: []*v1pb.InstanceSetting_AIProviderConfig{
							{
								Id:           "openai-main",
								Title:        "OpenAI primary",
								Type:         v1pb.InstanceSetting_OPENAI,
								ApiKey:       "",
								Models:       []string{"gpt-5.4-mini", "gpt-5.4-mini", "gpt-5.4"},
								DefaultModel: "",
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		stored, err := ts.Store.GetInstanceAISetting(ctx)
		require.NoError(t, err)
		require.Len(t, stored.GetProviders(), 1)
		require.Equal(t, "sk-original", stored.GetProviders()[0].GetApiKey(),
			"existing AI provider API key must be preserved when an empty value is sent")
		require.Equal(t, "OpenAI primary", stored.GetProviders()[0].GetTitle())
		require.Equal(t, []string{"gpt-5.4-mini", "gpt-5.4"}, stored.GetProviders()[0].GetModels())
		require.Equal(t, "gpt-5.4-mini", stored.GetProviders()[0].GetDefaultModel())
	})

	t.Run("UpdateInstanceSetting - Anthropic provider gets default endpoint", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &v1pb.InstanceSetting_AiSetting{
					AiSetting: &v1pb.InstanceSetting_AISetting{
						Providers: []*v1pb.InstanceSetting_AIProviderConfig{
							{
								Id:           "anthropic-main",
								Title:        "Anthropic",
								Type:         v1pb.InstanceSetting_ANTHROPIC,
								ApiKey:       "sk-ant-test",
								Models:       []string{"claude-sonnet-4-5"},
								DefaultModel: "claude-sonnet-4-5",
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		stored, err := ts.Store.GetInstanceAISetting(ctx)
		require.NoError(t, err)
		require.Len(t, stored.GetProviders(), 1)
		require.Equal(t, "https://api.anthropic.com/v1", stored.GetProviders()[0].GetEndpoint())
	})
}

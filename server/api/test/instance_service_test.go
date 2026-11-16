package test

import (
	"context"
	"strings"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestGetInstanceProfile(t *testing.T) {
	ctx := context.Background()

	t.Run("GetInstanceProfile returns instance profile", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetInstanceProfile directly
		req := &apipb.GetInstanceProfileRequest{}
		resp, err := ts.Service.GetInstanceProfile(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify the response contains expected data
		require.Equal(t, "test-1.0.0", resp.Version)
		require.Equal(t, "test-commit", resp.Commit)
		require.True(t, resp.Demo)
		require.Equal(t, "http://localhost:8080", resp.InstanceUrl)
		require.Equal(t, apipb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC, resp.AccessMode)

		// Instance should not be initialized since no users exist at all.
		require.Nil(t, resp.Admin)
		require.True(t, resp.NeedsSetup)
	})

	t.Run("GetInstanceProfile with initialized instance", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user in the store
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		require.NotNil(t, hostUser)

		// Call GetInstanceProfile as the signed-in admin
		req := &apipb.GetInstanceProfileRequest{}
		resp, err := ts.Service.GetInstanceProfile(ts.CreateUserContext(ctx, hostUser.ID), req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify the response contains expected data with initialized flag
		require.Equal(t, "test-1.0.0", resp.Version)
		require.Equal(t, "test-commit", resp.Commit)
		require.True(t, resp.Demo)
		require.Equal(t, "http://localhost:8080", resp.InstanceUrl)

		// Instance should be initialized since an admin user exists
		require.NotNil(t, resp.Admin)
		require.Equal(t, hostUser.Username, resp.Admin.Username)
		require.False(t, resp.NeedsSetup)
	})

	t.Run("GetInstanceProfile hides the admin from anonymous callers", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// The endpoint is public so the sign-in page can render, but an
		// unauthenticated visitor must not learn the admin's username.
		resp, err := ts.Service.GetInstanceProfile(ctx, &apipb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Nil(t, resp.Admin)
		require.False(t, resp.NeedsSetup)

		// Any signed-in user, not only the admin, may see it.
		regularUser, err := ts.CreateRegularUser(ctx, "alice")
		require.NoError(t, err)
		resp, err = ts.Service.GetInstanceProfile(ts.CreateUserContext(ctx, regularUser.ID), &apipb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.NotNil(t, resp.Admin)
		require.Equal(t, hostUser.Username, resp.Admin.Username)
	})

	t.Run("GetInstanceProfile with users but no admin", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a regular user but no admin. This mirrors an instance that has
		// lost all of its admins: admin is nil, but the instance is NOT a fresh
		// install and must not be flagged for first-run setup.
		regularUser, err := ts.CreateRegularUser(ctx, "alice")
		require.NoError(t, err)
		require.NotNil(t, regularUser)

		req := &apipb.GetInstanceProfileRequest{}
		resp, err := ts.Service.GetInstanceProfile(ts.CreateUserContext(ctx, regularUser.ID), req)
		require.NoError(t, err)
		require.NotNil(t, resp)

		// No admin to display, but setup is already done because a user exists.
		require.Nil(t, resp.Admin)
		require.False(t, resp.NeedsSetup)
	})
}

func TestGetInstanceProfile_Concurrency(t *testing.T) {
	ctx := context.Background()

	t.Run("Concurrent access to service", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Make concurrent requests
		numGoroutines := 10
		results := make(chan *apipb.InstanceProfile, numGoroutines)
		errors := make(chan error, numGoroutines)

		for range numGoroutines {
			go func() {
				req := &apipb.GetInstanceProfileRequest{}
				resp, err := ts.Service.GetInstanceProfile(userCtx, req)
				if err != nil {
					errors <- err
					return
				}
				results <- resp
			}()
		}

		// Collect all results
		for range numGoroutines {
			select {
			case err := <-errors:
				t.Fatalf("Goroutine returned error: %v", err)
			case resp := <-results:
				require.NotNil(t, resp)
				require.Equal(t, "test-1.0.0", resp.Version)
				require.Equal(t, "test-commit", resp.Commit)
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
		req := &apipb.GetInstanceSettingRequest{
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
		req := &apipb.GetInstanceSettingRequest{
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

	t.Run("GetInstanceSetting - retired reaction setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.GetInstanceSetting(ctx, &apipb.GetInstanceSettingRequest{
			Name: "instance/settings/MEMO_RELATED",
		})
		require.Error(t, err)
	})

	t.Run("GetInstanceSetting - tags setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &apipb.GetInstanceSettingRequest{
			Name: "instance/settings/TAGS",
		}
		resp, err := ts.Service.GetInstanceSetting(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/TAGS", resp.Name)
		require.NotNil(t, resp.GetTagsSetting())
		require.Empty(t, resp.GetTagsSetting().GetTags())
	})

	t.Run("GetInstanceSetting - access setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		resp, err := ts.Service.GetInstanceSetting(ctx, &apipb.GetInstanceSettingRequest{
			Name: "instance/settings/ACCESS",
		})

		require.NoError(t, err)
		require.Equal(t, "instance/settings/ACCESS", resp.Name)
		require.Equal(t, apipb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC, resp.GetAccessSetting().GetAccessMode())
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

		req := &apipb.GetInstanceSettingRequest{Name: "instance/settings/NOTIFICATION"}

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

	t.Run("GetInstanceSetting - AI setting requires authenticated user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		req := &apipb.GetInstanceSettingRequest{Name: "instance/settings/AI"}

		_, err = ts.Service.GetInstanceSetting(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")

		resp, err := ts.Service.GetInstanceSetting(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.GetAiSetting())
		require.Empty(t, resp.GetAiSetting().GetProviders())

		resp, err = ts.Service.GetInstanceSetting(adminCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.GetAiSetting())
		require.Empty(t, resp.GetAiSetting().GetProviders())
	})

	t.Run("GetInstanceSetting - invalid setting name", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetInstanceSetting with invalid name
		req := &apipb.GetInstanceSettingRequest{
			Name: "invalid/setting/name",
		}
		_, err := ts.Service.GetInstanceSetting(ctx, req)

		// Should return an error
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid instance setting name")
	})
}

func TestBatchGetInstanceSettings(t *testing.T) {
	ctx := context.Background()

	t.Run("BatchGetInstanceSettings - returns settings in request order", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		resp, err := ts.Service.BatchGetInstanceSettings(ctx, &apipb.BatchGetInstanceSettingsRequest{
			Names: []string{
				"instance/settings/TAGS",
				"instance/settings/GENERAL",
				"instance/settings/ACCESS",
			},
		})

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.InstanceSettings, 3)
		require.Equal(t, "instance/settings/TAGS", resp.InstanceSettings[0].Name)
		require.NotNil(t, resp.InstanceSettings[0].GetTagsSetting())
		require.Equal(t, "instance/settings/GENERAL", resp.InstanceSettings[1].Name)
		require.NotNil(t, resp.InstanceSettings[1].GetGeneralSetting())
		require.Equal(t, "instance/settings/ACCESS", resp.InstanceSettings[2].Name)
		require.NotNil(t, resp.InstanceSettings[2].GetAccessSetting())
	})

	t.Run("BatchGetInstanceSettings - admin-only setting requires admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		regularUser, err := ts.CreateRegularUser(ctx, "batch-user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		_, err = ts.Service.BatchGetInstanceSettings(userCtx, &apipb.BatchGetInstanceSettingsRequest{
			Names: []string{"instance/settings/GENERAL", "instance/settings/NOTIFICATION"},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		admin, err := ts.CreateHostUser(ctx, "batch-admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		resp, err := ts.Service.BatchGetInstanceSettings(adminCtx, &apipb.BatchGetInstanceSettingsRequest{
			Names: []string{"instance/settings/GENERAL", "instance/settings/NOTIFICATION"},
		})
		require.NoError(t, err)
		require.Len(t, resp.InstanceSettings, 2)
		require.NotNil(t, resp.InstanceSettings[1].GetNotificationSetting())
	})

	t.Run("BatchGetInstanceSettings - invalid setting name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.BatchGetInstanceSettings(ctx, &apipb.BatchGetInstanceSettingsRequest{
			Names: []string{"instance/settings/GENERAL", "invalid/setting/name"},
		})

		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid instance setting name")
	})
}

func TestTestInstanceEmailSettingAuthorization(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "email-test-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	regularUser, err := ts.CreateRegularUser(ctx, "email-test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, regularUser.ID)

	req := &apipb.TestInstanceEmailSettingRequest{}

	_, err = ts.Service.TestInstanceEmailSetting(ctx, req)
	require.Error(t, err)
	require.Contains(t, err.Error(), "not authenticated")

	_, err = ts.Service.TestInstanceEmailSetting(userCtx, req)
	require.Error(t, err)
	require.Contains(t, err.Error(), "permission denied")

	_, err = ts.Service.TestInstanceEmailSetting(adminCtx, req)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid notification email setting")
}

func TestTestInstanceEmailSettingRequiresPasswordWhenSMTPIdentityChanges(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "email-test-identity-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: &storepb.InstanceNotificationSetting{
				Email: &storepb.InstanceNotificationSetting_EmailSetting{
					Enabled:      true,
					SmtpHost:     "smtp.example.com",
					SmtpPort:     587,
					SmtpUsername: "bot@example.com",
					SmtpPassword: "stored-password",
					FromEmail:    "bot@example.com",
					UseTls:       true,
				},
			},
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.TestInstanceEmailSetting(adminCtx, &apipb.TestInstanceEmailSettingRequest{
		Email: &apipb.InstanceSetting_NotificationSetting_EmailSetting{
			Enabled:      true,
			SmtpHost:     "attacker.example.com",
			SmtpPort:     587,
			SmtpUsername: "bot@example.com",
			SmtpPassword: "",
			FromEmail:    "bot@example.com",
			UseTls:       true,
		},
		RecipientEmail: admin.Email,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "smtp password is required")
}

func TestUpdateInstanceSetting(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateInstanceSetting - notification email validation", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		admin, err := ts.CreateHostUser(ctx, "notification-admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		update := func(email *apipb.InstanceSetting_NotificationSetting_EmailSetting) error {
			_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
				InstanceSetting: &apipb.InstanceSetting{
					Name: "instance/settings/NOTIFICATION",
					Value: &apipb.InstanceSetting_NotificationSetting_{
						NotificationSetting: &apipb.InstanceSetting_NotificationSetting{Email: email},
					},
				},
			})
			return err
		}
		valid := func() *apipb.InstanceSetting_NotificationSetting_EmailSetting {
			return &apipb.InstanceSetting_NotificationSetting_EmailSetting{
				Enabled:      true,
				SmtpHost:     "smtp.example.com",
				SmtpPort:     587,
				SmtpPassword: "password",
				FromEmail:    "bot@example.com",
				UseTls:       true,
			}
		}

		bothEncryptions := valid()
		bothEncryptions.UseSsl = true
		err = update(bothEncryptions)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
		require.Contains(t, err.Error(), "cannot enable both use_tls and use_ssl")

		for name, mutate := range map[string]func(*apipb.InstanceSetting_NotificationSetting_EmailSetting){
			"host": func(e *apipb.InstanceSetting_NotificationSetting_EmailSetting) { e.SmtpHost = " " },
			"port": func(e *apipb.InstanceSetting_NotificationSetting_EmailSetting) { e.SmtpPort = 0 },
			"from": func(e *apipb.InstanceSetting_NotificationSetting_EmailSetting) { e.FromEmail = "" },
		} {
			email := valid()
			mutate(email)
			err := update(email)
			require.Equal(t, codes.InvalidArgument, status.Code(err), "missing %s", name)
			require.Contains(t, err.Error(), "requires smtp_host", "missing %s", name)
		}

		require.NoError(t, update(valid()))
		// Disabled email may be saved incomplete.
		require.NoError(t, update(&apipb.InstanceSetting_NotificationSetting_EmailSetting{Enabled: false, SmtpPassword: "password"}))
	})

	t.Run("UpdateInstanceSetting - access setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		admin, err := ts.CreateHostUser(ctx, "access-admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/ACCESS",
				Value: &apipb.InstanceSetting_AccessSetting_{
					AccessSetting: &apipb.InstanceSetting_AccessSetting{
						AccessMode: apipb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE,
					},
				},
			},
		})
		require.NoError(t, err)
		require.Equal(t, apipb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, resp.GetAccessSetting().GetAccessMode())

		profile, err := ts.Service.GetInstanceProfile(ctx, &apipb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.Equal(t, apipb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, profile.AccessMode)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/ACCESS",
				Value: &apipb.InstanceSetting_AccessSetting_{
					AccessSetting: &apipb.InstanceSetting_AccessSetting{},
				},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "access_mode must be PRIVATE or PUBLIC")

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/ACCESS",
				Value: &apipb.InstanceSetting_GeneralSetting_{
					GeneralSetting: &apipb.InstanceSetting_GeneralSetting{},
				},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "access setting is required")
	})

	t.Run("UpdateInstanceSetting - AI setting requires admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		setting := &apipb.InstanceSetting{
			Name: "instance/settings/AI",
			Value: &apipb.InstanceSetting_AiSetting{
				AiSetting: &apipb.InstanceSetting_AISetting{
					Providers: []*apipb.InstanceSetting_AIProviderConfig{
						{
							Id:     "openai-main",
							Title:  "OpenAI",
							Type:   apipb.InstanceSetting_OPENAI,
							ApiKey: "sk-test",
						},
					},
				},
			},
		}

		_, err = ts.Service.UpdateInstanceSetting(ctx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: setting})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")

		_, err = ts.Service.UpdateInstanceSetting(userCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: setting})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("UpdateInstanceSetting - tags setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		resp, err := ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/TAGS",
				Value: &apipb.InstanceSetting_TagsSetting_{
					TagsSetting: &apipb.InstanceSetting_TagsSetting{
						Tags: map[string]*apipb.InstanceSetting_TagMetadata{
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

		_, err = ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/TAGS",
				Value: &apipb.InstanceSetting_TagsSetting_{
					TagsSetting: &apipb.InstanceSetting_TagsSetting{
						Tags: map[string]*apipb.InstanceSetting_TagMetadata{
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

		resp, err := ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/TAGS",
				Value: &apipb.InstanceSetting_TagsSetting_{
					TagsSetting: &apipb.InstanceSetting_TagsSetting{
						Tags: map[string]*apipb.InstanceSetting_TagMetadata{
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
		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/NOTIFICATION",
				Value: &apipb.InstanceSetting_NotificationSetting_{
					NotificationSetting: &apipb.InstanceSetting_NotificationSetting{
						Email: &apipb.InstanceSetting_NotificationSetting_EmailSetting{
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

		notificationSetting := &apipb.InstanceSetting{
			Name: "instance/settings/NOTIFICATION",
			Value: &apipb.InstanceSetting_NotificationSetting_{
				NotificationSetting: &apipb.InstanceSetting_NotificationSetting{
					Email: &apipb.InstanceSetting_NotificationSetting_EmailSetting{
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
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: notificationSetting,
		})
		require.NoError(t, err)

		// Second update with an empty password (simulating a UI that doesn't re-send the secret).
		notificationSetting.GetNotificationSetting().GetEmail().SmtpPassword = ""
		notificationSetting.GetNotificationSetting().GetEmail().FromName = "Updated Bot"
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: notificationSetting,
		})
		require.NoError(t, err)

		// The stored setting should have preserved the original password.
		stored, err := ts.Store.GetInstanceNotificationSetting(ctx)
		require.NoError(t, err)
		require.Equal(t, "original-password", stored.GetEmail().GetSmtpPassword(),
			"existing SmtpPassword must be preserved when an empty value is sent")
		require.Equal(t, "Updated Bot", stored.GetEmail().GetFromName())
	})

	t.Run("UpdateInstanceSetting - empty password rejected when SMTP identity changes", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		notificationSetting := &apipb.InstanceSetting{
			Name: "instance/settings/NOTIFICATION",
			Value: &apipb.InstanceSetting_NotificationSetting_{
				NotificationSetting: &apipb.InstanceSetting_NotificationSetting{
					Email: &apipb.InstanceSetting_NotificationSetting_EmailSetting{
						Enabled:      true,
						SmtpHost:     "smtp.example.com",
						SmtpPort:     587,
						SmtpUsername: "bot@example.com",
						SmtpPassword: "original-password",
						FromEmail:    "bot@example.com",
						UseTls:       true,
					},
				},
			},
		}

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: notificationSetting,
		})
		require.NoError(t, err)

		notificationSetting.GetNotificationSetting().GetEmail().SmtpPassword = ""
		notificationSetting.GetNotificationSetting().GetEmail().SmtpHost = "smtp2.example.com"
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: notificationSetting,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "smtp password is required")
	})

	t.Run("UpdateInstanceSetting - S3 secret is write-only and preserved on empty", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Save storage setting with a real secret.
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &apipb.InstanceSetting_StorageSetting_{
					StorageSetting: &apipb.InstanceSetting_StorageSetting{
						S3Config: &apipb.InstanceSetting_StorageSetting_S3Config{
							AccessKeyId:           "AKID",
							AccessKeySecret:       "super-secret",
							Endpoint:              "s3.example.com",
							Region:                "us-east-1",
							Bucket:                "memos",
							InsecureSkipTlsVerify: true,
						},
					},
				},
			},
		})
		require.NoError(t, err)

		// Read back: secret must not be returned.
		resp, err := ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{
			Name: "instance/settings/STORAGE",
		})
		require.NoError(t, err)
		require.Empty(t, resp.GetStorageSetting().GetS3Config().GetAccessKeySecret(),
			"AccessKeySecret must never be returned in responses")
		require.True(t, resp.GetStorageSetting().GetS3Config().GetInsecureSkipTlsVerify(),
			"insecure_skip_tls_verify must round-trip through the API")
		var defaultStorage *apipb.InstanceSetting_Storage
		for _, configuredStorage := range resp.GetStorageSetting().GetStorages() {
			if configuredStorage.GetId() == resp.GetStorageSetting().GetDefaultStorageId() {
				defaultStorage = configuredStorage
			}
		}
		require.NotNil(t, defaultStorage)
		require.Empty(t, defaultStorage.GetS3Config().GetAccessKeySecret(),
			"AccessKeySecret must be write-only in named storage responses")

		// Update with empty secret; original must be preserved in the store.
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &apipb.InstanceSetting_StorageSetting_{
					StorageSetting: &apipb.InstanceSetting_StorageSetting{
						S3Config: &apipb.InstanceSetting_StorageSetting_S3Config{
							AccessKeyId:           "AKID",
							AccessKeySecret:       "", // omitted / not changed
							Endpoint:              "s3-v2.example.com",
							Region:                "us-east-1",
							Bucket:                "memos",
							InsecureSkipTlsVerify: true,
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
		require.True(t, stored.GetS3Config().GetInsecureSkipTlsVerify())
		var s3StorageCount int
		var previousStorageFound bool
		for _, configuredStorage := range stored.GetStorages() {
			if configuredStorage.GetType() == storepb.StorageType_STORAGE_TYPE_S3 {
				s3StorageCount++
			}
			if configuredStorage.GetS3Config().GetEndpoint() == "s3.example.com" {
				previousStorageFound = true
			}
		}
		require.Equal(t, 2, s3StorageCount, "changing the S3 namespace must preserve the previous storage")
		require.True(t, previousStorageFound)
	})

	t.Run("UpdateInstanceSetting - AI provider keys are write-only and preserved on empty", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{
					AiSetting: &apipb.InstanceSetting_AISetting{
						Providers: []*apipb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   apipb.InstanceSetting_OPENAI,
								ApiKey: "sk-original",
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{
			Name: "instance/settings/AI",
		})
		require.NoError(t, err)
		require.Len(t, resp.GetAiSetting().GetProviders(), 1)
		provider := resp.GetAiSetting().GetProviders()[0]
		require.Empty(t, provider.GetApiKey(), "AI provider API key must never be returned in responses")
		require.True(t, provider.GetApiKeySet())
		require.Equal(t, "sk-o...inal", provider.GetApiKeyHint())
		require.Equal(t, "https://api.openai.com/v1", provider.GetEndpoint())

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{
					AiSetting: &apipb.InstanceSetting_AISetting{
						Providers: []*apipb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI primary",
								Type:   apipb.InstanceSetting_OPENAI,
								ApiKey: "",
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
	})

	t.Run("UpdateInstanceSetting - transcription provider_id must reference an existing provider", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{
					AiSetting: &apipb.InstanceSetting_AISetting{
						Providers: []*apipb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   apipb.InstanceSetting_OPENAI,
								ApiKey: "sk-test",
							},
						},
						Transcription: &apipb.InstanceSetting_TranscriptionConfig{
							ProviderId: "does-not-exist",
						},
					},
				},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription provider_id")
	})

	t.Run("UpdateInstanceSetting - transcription strings are length-capped", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		base := &apipb.InstanceSetting{
			Name: "instance/settings/AI",
			Value: &apipb.InstanceSetting_AiSetting{
				AiSetting: &apipb.InstanceSetting_AISetting{
					Providers: []*apipb.InstanceSetting_AIProviderConfig{
						{
							Id:     "openai-main",
							Title:  "OpenAI",
							Type:   apipb.InstanceSetting_OPENAI,
							ApiKey: "sk-test",
						},
					},
				},
			},
		}

		oversizedModel := strings.Repeat("a", 257)
		base.GetAiSetting().Transcription = &apipb.InstanceSetting_TranscriptionConfig{
			ProviderId: "openai-main",
			Model:      oversizedModel,
		}
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: base})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription model")

		oversizedLanguage := strings.Repeat("a", 33)
		base.GetAiSetting().Transcription = &apipb.InstanceSetting_TranscriptionConfig{
			ProviderId: "openai-main",
			Language:   oversizedLanguage,
		}
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: base})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription language")

		oversizedPrompt := strings.Repeat("a", 4097)
		base.GetAiSetting().Transcription = &apipb.InstanceSetting_TranscriptionConfig{
			ProviderId: "openai-main",
			Prompt:     oversizedPrompt,
		}
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: base})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription prompt")
	})

	t.Run("UpdateInstanceSetting - transcription is preserved when omitted on update", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{
					AiSetting: &apipb.InstanceSetting_AISetting{
						Providers: []*apipb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   apipb.InstanceSetting_OPENAI,
								ApiKey: "sk-test",
							},
						},
						Transcription: &apipb.InstanceSetting_TranscriptionConfig{
							ProviderId: "openai-main",
							Model:      "whisper-1",
							Language:   "en",
							Prompt:     "names: Alice",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{
					AiSetting: &apipb.InstanceSetting_AISetting{
						Providers: []*apipb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   apipb.InstanceSetting_OPENAI,
								ApiKey: "",
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		stored, err := ts.Store.GetInstanceAISetting(ctx)
		require.NoError(t, err)
		require.NotNil(t, stored.GetTranscription())
		require.Equal(t, "openai-main", stored.GetTranscription().GetProviderId())
		require.Equal(t, "whisper-1", stored.GetTranscription().GetModel())
		require.Equal(t, "en", stored.GetTranscription().GetLanguage())
		require.Equal(t, "names: Alice", stored.GetTranscription().GetPrompt())
	})
}

func TestUpdateInstanceSettingValidatesStorages(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	hostUser, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

	update := func(storages []*apipb.InstanceSetting_Storage, defaultID string) error {
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &apipb.InstanceSetting_StorageSetting_{StorageSetting: &apipb.InstanceSetting_StorageSetting{
					Storages:         storages,
					DefaultStorageId: defaultID,
				}},
			},
		})
		return err
	}
	local := &apipb.InstanceSetting_Storage{Id: "local", Type: apipb.InstanceSetting_LOCAL}
	archive := &apipb.InstanceSetting_Storage{
		Id:   "archive",
		Type: apipb.InstanceSetting_S3,
		Config: &apipb.InstanceSetting_Storage_S3Config_{S3Config: &apipb.InstanceSetting_Storage_S3Config{
			AccessKeyId: "AKID", AccessKeySecret: "secret", Endpoint: "https://s3.example.com", Bucket: "memos",
		}},
	}

	// A non-default S3 storage without a region would fail on first use.
	err = update([]*apipb.InstanceSetting_Storage{local, archive}, "local")
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Contains(t, err.Error(), "storage archive region is required")

	archive.GetS3Config().Region = "us-east-1"
	require.NoError(t, update([]*apipb.InstanceSetting_Storage{local, archive}, "local"))
}

func TestUpdateInstanceSettingUpdateMask(t *testing.T) {
	ctx := context.Background()

	setup := func(t *testing.T) (*TestService, context.Context) {
		ts := NewTestService(t)
		t.Cleanup(ts.Cleanup)
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		return ts, ts.CreateUserContext(ctx, admin.ID)
	}
	general := func(setting *apipb.InstanceSetting_GeneralSetting) *apipb.InstanceSetting {
		return &apipb.InstanceSetting{
			Name:  "instance/settings/GENERAL",
			Value: &apipb.InstanceSetting_GeneralSetting_{GeneralSetting: setting},
		}
	}
	seedGeneral := func(t *testing.T, ts *TestService, adminCtx context.Context) {
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: general(&apipb.InstanceSetting_GeneralSetting{
				AdditionalStyle:    "body { color: red; }",
				WeekStartDayOffset: 1,
				CustomProfile:      &apipb.InstanceSetting_GeneralSetting_CustomProfile{Title: "Seeded", Description: "Kept"},
			}),
		})
		require.NoError(t, err)
	}

	t.Run("masked fields change and the rest are kept", func(t *testing.T) {
		ts, adminCtx := setup(t)
		seedGeneral(t, ts, adminCtx)

		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: general(&apipb.InstanceSetting_GeneralSetting{
				DisallowChangeNickname: true,
				AdditionalStyle:        "ignored because unmasked",
				CustomProfile:          &apipb.InstanceSetting_GeneralSetting_CustomProfile{Title: "Renamed"},
			}),
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{
				"general_setting.disallow_change_nickname",
				"general_setting.custom_profile.title",
			}},
		})
		require.NoError(t, err)
		got := resp.GetGeneralSetting()
		require.True(t, got.GetDisallowChangeNickname())
		require.Equal(t, "body { color: red; }", got.GetAdditionalStyle())
		require.Equal(t, int32(1), got.GetWeekStartDayOffset())
		require.Equal(t, "Renamed", got.GetCustomProfile().GetTitle())
		require.Equal(t, "Kept", got.GetCustomProfile().GetDescription())

		stored, err := ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: "instance/settings/GENERAL"})
		require.NoError(t, err)
		require.Equal(t, "body { color: red; }", stored.GetGeneralSetting().GetAdditionalStyle())
		require.True(t, stored.GetGeneralSetting().GetDisallowChangeNickname())
	})

	t.Run("a message path replaces the whole message", func(t *testing.T) {
		ts, adminCtx := setup(t)
		seedGeneral(t, ts, adminCtx)

		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: general(&apipb.InstanceSetting_GeneralSetting{
				CustomProfile: &apipb.InstanceSetting_GeneralSetting_CustomProfile{Title: "Only title"},
			}),
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"general_setting.custom_profile"}},
		})
		require.NoError(t, err)
		require.Equal(t, "Only title", resp.GetGeneralSetting().GetCustomProfile().GetTitle())
		require.Empty(t, resp.GetGeneralSetting().GetCustomProfile().GetDescription())
		require.Equal(t, "body { color: red; }", resp.GetGeneralSetting().GetAdditionalStyle())
	})

	t.Run("paths may be relative to the setting value", func(t *testing.T) {
		ts, adminCtx := setup(t)
		seedGeneral(t, ts, adminCtx)

		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: general(&apipb.InstanceSetting_GeneralSetting{WeekStartDayOffset: 6}),
			UpdateMask:      &fieldmaskpb.FieldMask{Paths: []string{"week_start_day_offset"}},
		})
		require.NoError(t, err)
		require.Equal(t, int32(6), resp.GetGeneralSetting().GetWeekStartDayOffset())
		require.Equal(t, "body { color: red; }", resp.GetGeneralSetting().GetAdditionalStyle())
	})

	t.Run("a REST PATCH body keeps unsent fields", func(t *testing.T) {
		ts, adminCtx := setup(t)
		seedGeneral(t, ts, adminCtx)

		// The REST gateway decodes the body and, when no mask is sent, derives
		// one from the body keys, including "name".
		body := `{"name":"instance/settings/GENERAL","generalSetting":{"disallowChangeNickname":true}}`
		setting := &apipb.InstanceSetting{}
		require.NoError(t, protojson.Unmarshal([]byte(body), setting))
		mask, err := runtime.FieldMaskFromRequestBody(strings.NewReader(body), setting)
		require.NoError(t, err)
		require.Contains(t, mask.GetPaths(), "name")

		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: setting,
			UpdateMask:      mask,
		})
		require.NoError(t, err)
		require.True(t, resp.GetGeneralSetting().GetDisallowChangeNickname())
		require.Equal(t, "body { color: red; }", resp.GetGeneralSetting().GetAdditionalStyle())
		require.Equal(t, "instance/settings/GENERAL", resp.GetName())
	})

	t.Run("no mask replaces the whole setting", func(t *testing.T) {
		ts, adminCtx := setup(t)
		seedGeneral(t, ts, adminCtx)

		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: general(&apipb.InstanceSetting_GeneralSetting{DisallowChangeNickname: true}),
		})
		require.NoError(t, err)
		require.True(t, resp.GetGeneralSetting().GetDisallowChangeNickname())
		require.Empty(t, resp.GetGeneralSetting().GetAdditionalStyle())
	})

	t.Run("invalid paths are rejected", func(t *testing.T) {
		ts, adminCtx := setup(t)
		for _, path := range []string{
			"general_setting.no_such_field",
			"no_such_field",
			"storage_setting.default_storage_id",
			"general_setting.custom_profile.title.extra",
		} {
			_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
				InstanceSetting: general(&apipb.InstanceSetting_GeneralSetting{}),
				UpdateMask:      &fieldmaskpb.FieldMask{Paths: []string{path}},
			})
			require.Equal(t, codes.InvalidArgument, status.Code(err), path)
		}
	})

	t.Run("a value for another setting is rejected", func(t *testing.T) {
		ts, adminCtx := setup(t)
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name:  "instance/settings/GENERAL",
				Value: &apipb.InstanceSetting_TagsSetting_{TagsSetting: &apipb.InstanceSetting_TagsSetting{}},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"general_setting.additional_style"}},
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("smtp password is kept on a masked update", func(t *testing.T) {
		ts, adminCtx := setup(t)
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/NOTIFICATION",
				Value: &apipb.InstanceSetting_NotificationSetting_{NotificationSetting: &apipb.InstanceSetting_NotificationSetting{
					Email: &apipb.InstanceSetting_NotificationSetting_EmailSetting{
						Enabled:      true,
						SmtpHost:     "smtp.example.com",
						SmtpPort:     587,
						SmtpUsername: "bot",
						SmtpPassword: "stored-password",
						FromEmail:    "bot@example.com",
						UseTls:       true,
					},
				}},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/NOTIFICATION",
				Value: &apipb.InstanceSetting_NotificationSetting_{NotificationSetting: &apipb.InstanceSetting_NotificationSetting{
					Email: &apipb.InstanceSetting_NotificationSetting_EmailSetting{FromName: "Memos Bot"},
				}},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"notification_setting.email.from_name"}},
		})
		require.NoError(t, err)

		stored, err := ts.Store.GetInstanceNotificationSetting(ctx)
		require.NoError(t, err)
		require.Equal(t, "stored-password", stored.GetEmail().GetSmtpPassword())
		require.Equal(t, "Memos Bot", stored.GetEmail().GetFromName())
		require.Equal(t, "smtp.example.com", stored.GetEmail().GetSmtpHost())
	})
}

func TestUpdateInstanceSettingUpdateMaskStorage(t *testing.T) {
	ctx := context.Background()
	const secret = "archive-secret"

	// setup stores LOCAL as the default and an S3 "archive" storage, the way
	// the settings page saves them.
	setup := func(t *testing.T) (*TestService, context.Context, string) {
		ts := NewTestService(t)
		t.Cleanup(ts.Cleanup)
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		resp, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &apipb.InstanceSetting_StorageSetting_{StorageSetting: &apipb.InstanceSetting_StorageSetting{
					Storages: []*apipb.InstanceSetting_Storage{
						{Id: "local", Type: apipb.InstanceSetting_LOCAL},
						{Id: "archive", Type: apipb.InstanceSetting_S3, Config: &apipb.InstanceSetting_Storage_S3Config_{
							S3Config: &apipb.InstanceSetting_Storage_S3Config{
								AccessKeyId: "AKID", AccessKeySecret: secret, Endpoint: "https://s3.example.com", Region: "us-east-1", Bucket: "memos",
							},
						}},
					},
					DefaultStorageId: "local",
				}},
			},
		})
		require.NoError(t, err)
		var archiveID string
		for _, storage := range resp.GetStorageSetting().GetStorages() {
			if storage.GetType() == apipb.InstanceSetting_S3 {
				archiveID = storage.GetId()
			}
		}
		require.NotEmpty(t, archiveID)
		return ts, adminCtx, archiveID
	}
	update := func(t *testing.T, ts *TestService, adminCtx context.Context, setting *apipb.InstanceSetting_StorageSetting, paths ...string) *storepb.InstanceStorageSetting {
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name:  "instance/settings/STORAGE",
				Value: &apipb.InstanceSetting_StorageSetting_{StorageSetting: setting},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: paths},
		})
		require.NoError(t, err)
		stored, err := ts.Store.GetInstanceStorageSetting(ctx)
		require.NoError(t, err)
		return stored
	}
	s3Storage := func(t *testing.T, setting *storepb.InstanceStorageSetting, bucket string) *storepb.Storage {
		for _, storage := range setting.GetStorages() {
			if storage.GetS3Config().GetBucket() == bucket {
				return storage
			}
		}
		require.Failf(t, "storage not found", "no S3 storage for bucket %q in %v", bucket, setting.GetStorages())
		return nil
	}

	t.Run("default_storage_id", func(t *testing.T) {
		ts, adminCtx, archiveID := setup(t)
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_StorageSetting{DefaultStorageId: archiveID}, "storage_setting.default_storage_id")
		require.Equal(t, archiveID, stored.GetDefaultStorageId())
		require.Equal(t, storepb.InstanceStorageSetting_S3, stored.GetStorageType())
		require.Equal(t, secret, s3Storage(t, stored, "memos").GetS3Config().GetAccessKeySecret())
		require.Len(t, stored.GetStorages(), 2)
	})

	t.Run("storages list", func(t *testing.T) {
		ts, adminCtx, archiveID := setup(t)
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_StorageSetting{Storages: []*apipb.InstanceSetting_Storage{
			{Id: "local", Type: apipb.InstanceSetting_LOCAL},
			{Id: archiveID, Type: apipb.InstanceSetting_S3, Name: "Renamed", Config: &apipb.InstanceSetting_Storage_S3Config_{
				S3Config: &apipb.InstanceSetting_Storage_S3Config{
					AccessKeyId: "AKID", Endpoint: "https://s3.example.com", Region: "us-east-1", Bucket: "memos",
				},
			}},
		}}, "storage_setting.storages")
		require.Equal(t, "local", stored.GetDefaultStorageId())
		archive := s3Storage(t, stored, "memos")
		require.Equal(t, "Renamed", archive.GetName())
		require.Equal(t, secret, archive.GetS3Config().GetAccessKeySecret())
	})

	t.Run("legacy storage_type", func(t *testing.T) {
		ts, adminCtx, archiveID := setup(t)
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_StorageSetting{
			StorageType: apipb.InstanceSetting_StorageSetting_S3,
		}, "storage_setting.storage_type")
		require.Equal(t, storepb.InstanceStorageSetting_S3, stored.GetStorageType())
		require.Equal(t, archiveID, stored.GetDefaultStorageId())
		require.Equal(t, secret, s3Storage(t, stored, "memos").GetS3Config().GetAccessKeySecret())
		require.Len(t, stored.GetStorages(), 2)
	})

	t.Run("legacy s3_config field", func(t *testing.T) {
		ts, adminCtx, _ := setup(t)
		update(t, ts, adminCtx, &apipb.InstanceSetting_StorageSetting{StorageType: apipb.InstanceSetting_StorageSetting_S3}, "storage_type")
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_StorageSetting{
			S3Config: &apipb.InstanceSetting_StorageSetting_S3Config{Bucket: "memos-new"},
		}, "storage_setting.s3_config.bucket")
		moved := s3Storage(t, stored, "memos-new")
		require.Equal(t, moved.GetId(), stored.GetDefaultStorageId())
		require.Equal(t, "memos-new", stored.GetS3Config().GetBucket())
		require.Equal(t, secret, moved.GetS3Config().GetAccessKeySecret())
		// The old bucket stays registered for attachments stored there.
		require.Equal(t, secret, s3Storage(t, stored, "memos").GetS3Config().GetAccessKeySecret())
	})

	t.Run("legacy and current fields together are rejected", func(t *testing.T) {
		ts, adminCtx, archiveID := setup(t)
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/STORAGE",
				Value: &apipb.InstanceSetting_StorageSetting_{StorageSetting: &apipb.InstanceSetting_StorageSetting{
					StorageType:      apipb.InstanceSetting_StorageSetting_S3,
					DefaultStorageId: archiveID,
				}},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"storage_type", "default_storage_id"}},
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
}

func TestUpdateInstanceSettingUpdateMaskTranscription(t *testing.T) {
	ctx := context.Background()

	// setup stores one provider with a transcription config.
	setup := func(t *testing.T) (*TestService, context.Context) {
		ts := NewTestService(t)
		t.Cleanup(ts.Cleanup)
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{AiSetting: &apipb.InstanceSetting_AISetting{
					Providers: []*apipb.InstanceSetting_AIProviderConfig{{
						Id: "openai-main", Title: "OpenAI", Type: apipb.InstanceSetting_OPENAI, ApiKey: "sk-test-1234567890",
					}},
					Transcription: &apipb.InstanceSetting_TranscriptionConfig{ProviderId: "openai-main", Model: "whisper-1"},
				}},
			},
		})
		require.NoError(t, err)
		return ts, adminCtx
	}
	update := func(t *testing.T, ts *TestService, adminCtx context.Context, setting *apipb.InstanceSetting_AISetting, paths ...string) *storepb.InstanceAISetting {
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
			InstanceSetting: &apipb.InstanceSetting{
				Name:  "instance/settings/AI",
				Value: &apipb.InstanceSetting_AiSetting{AiSetting: setting},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: paths},
		})
		require.NoError(t, err)
		stored, err := ts.Store.GetInstanceAISetting(ctx)
		require.NoError(t, err)
		return stored
	}

	t.Run("masked and unset clears it", func(t *testing.T) {
		ts, adminCtx := setup(t)
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_AISetting{}, "ai_setting.transcription")
		require.Empty(t, stored.GetTranscription().GetProviderId())
		require.Empty(t, stored.GetTranscription().GetModel())
		require.Len(t, stored.GetProviders(), 1)
		require.Equal(t, "sk-test-1234567890", stored.GetProviders()[0].GetApiKey())
	})

	t.Run("not masked keeps it", func(t *testing.T) {
		ts, adminCtx := setup(t)
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_AISetting{Providers: []*apipb.InstanceSetting_AIProviderConfig{{
			Id: "openai-main", Title: "Renamed", Type: apipb.InstanceSetting_OPENAI,
		}}}, "ai_setting.providers")
		require.Equal(t, "Renamed", stored.GetProviders()[0].GetTitle())
		require.Equal(t, "openai-main", stored.GetTranscription().GetProviderId())
		require.Equal(t, "whisper-1", stored.GetTranscription().GetModel())
	})

	t.Run("a masked subfield changes only that field", func(t *testing.T) {
		ts, adminCtx := setup(t)
		stored := update(t, ts, adminCtx, &apipb.InstanceSetting_AISetting{
			Transcription: &apipb.InstanceSetting_TranscriptionConfig{Language: "en"},
		}, "ai_setting.transcription.language")
		require.Equal(t, "openai-main", stored.GetTranscription().GetProviderId())
		require.Equal(t, "whisper-1", stored.GetTranscription().GetModel())
		require.Equal(t, "en", stored.GetTranscription().GetLanguage())
	})
}

func TestConfigurationStateIsNotExposed(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	hostUser, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

	_, err = ts.Store.RunConfigurationTransaction(ctx, func(context.Context, *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		return &storepb.InstanceConfigurationState{ConfigDigest: "digest"}, nil
	})
	require.NoError(t, err)

	const name = "instance/settings/CONFIGURATION_STATE"
	_, err = ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: name})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.BatchGetInstanceSettings(adminCtx, &apipb.BatchGetInstanceSettingsRequest{Names: []string{name}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: &apipb.InstanceSetting{Name: name}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Contains(t, err.Error(), "state record and cannot be written")

	state, err := ts.Store.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.Equal(t, "digest", state.ConfigDigest, "the API did not overwrite the record")
}

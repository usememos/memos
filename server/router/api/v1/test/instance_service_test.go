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

	t.Run("GetInstanceSetting - notification setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.GetInstanceSettingRequest{
			Name: "instance/settings/NOTIFICATION",
		}
		resp, err := ts.Service.GetInstanceSetting(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "instance/settings/NOTIFICATION", resp.Name)
		require.NotNil(t, resp.GetNotificationSetting())
		require.NotNil(t, resp.GetNotificationSetting().GetEmail())
		require.False(t, resp.GetNotificationSetting().GetEmail().GetEnabled())
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

	t.Run("UpdateInstanceSetting - notification setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		resp, err := ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, hostUser.ID), &v1pb.UpdateInstanceSettingRequest{
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
		require.NotNil(t, resp.GetNotificationSetting())
		require.NotNil(t, resp.GetNotificationSetting().GetEmail())
		require.True(t, resp.GetNotificationSetting().GetEmail().GetEnabled())
		require.Equal(t, "smtp.example.com", resp.GetNotificationSetting().GetEmail().GetSmtpHost())
	})
}

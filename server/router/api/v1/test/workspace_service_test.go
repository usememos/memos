package v1

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestGetWorkspaceProfile(t *testing.T) {
	ctx := context.Background()

	t.Run("GetWorkspaceProfile returns workspace profile", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetWorkspaceProfile directly
		req := &v1pb.GetWorkspaceProfileRequest{}
		resp, err := ts.Service.GetWorkspaceProfile(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify the response contains expected data
		require.Equal(t, "test-1.0.0", resp.Version)
		require.Equal(t, "dev", resp.Mode)
		require.Equal(t, "http://localhost:8080", resp.InstanceUrl)

		// Owner should be empty since no users are created
		require.Empty(t, resp.Owner)
	})

	t.Run("GetWorkspaceProfile with owner", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user in the store
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		require.NotNil(t, hostUser)

		// Call GetWorkspaceProfile directly
		req := &v1pb.GetWorkspaceProfileRequest{}
		resp, err := ts.Service.GetWorkspaceProfile(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify the response contains expected data including owner
		require.Equal(t, "test-1.0.0", resp.Version)
		require.Equal(t, "dev", resp.Mode)
		require.Equal(t, "http://localhost:8080", resp.InstanceUrl)

		// User name should be "users/{id}" format where id is the user's ID
		expectedOwnerName := fmt.Sprintf("users/%d", hostUser.ID)
		require.Equal(t, expectedOwnerName, resp.Owner)
	})
}

func TestGetWorkspaceProfile_Concurrency(t *testing.T) {
	ctx := context.Background()

	t.Run("Concurrent access to service", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		expectedOwnerName := fmt.Sprintf("users/%d", hostUser.ID)

		// Make concurrent requests
		numGoroutines := 10
		results := make(chan *v1pb.WorkspaceProfile, numGoroutines)
		errors := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func() {
				req := &v1pb.GetWorkspaceProfileRequest{}
				resp, err := ts.Service.GetWorkspaceProfile(ctx, req)
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
				require.Equal(t, "dev", resp.Mode)
				require.Equal(t, "http://localhost:8080", resp.InstanceUrl)
				require.Equal(t, expectedOwnerName, resp.Owner)
			}
		}
	})
}

func TestGetWorkspaceSetting(t *testing.T) {
	ctx := context.Background()

	t.Run("GetWorkspaceSetting - general setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetWorkspaceSetting for general setting
		req := &v1pb.GetWorkspaceSettingRequest{
			Name: "workspace/settings/GENERAL",
		}
		resp, err := ts.Service.GetWorkspaceSetting(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "workspace/settings/GENERAL", resp.Name)

		// The general setting should have a general_setting field
		generalSetting := resp.GetGeneralSetting()
		require.NotNil(t, generalSetting)

		// General setting should have default values
		require.False(t, generalSetting.DisallowUserRegistration)
		require.False(t, generalSetting.DisallowPasswordAuth)
		require.Empty(t, generalSetting.AdditionalScript)
	})

	t.Run("GetWorkspaceSetting - storage setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user for storage setting access
		hostUser, err := ts.CreateHostUser(ctx, "testhost")
		require.NoError(t, err)

		// Add user to context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Call GetWorkspaceSetting for storage setting
		req := &v1pb.GetWorkspaceSettingRequest{
			Name: "workspace/settings/STORAGE",
		}
		resp, err := ts.Service.GetWorkspaceSetting(userCtx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "workspace/settings/STORAGE", resp.Name)

		// The storage setting should have a storage_setting field
		storageSetting := resp.GetStorageSetting()
		require.NotNil(t, storageSetting)
	})

	t.Run("GetWorkspaceSetting - memo related setting", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetWorkspaceSetting for memo related setting
		req := &v1pb.GetWorkspaceSettingRequest{
			Name: "workspace/settings/MEMO_RELATED",
		}
		resp, err := ts.Service.GetWorkspaceSetting(ctx, req)

		// Verify response
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "workspace/settings/MEMO_RELATED", resp.Name)

		// The memo related setting should have a memo_related_setting field
		memoRelatedSetting := resp.GetMemoRelatedSetting()
		require.NotNil(t, memoRelatedSetting)
	})

	t.Run("GetWorkspaceSetting - invalid setting name", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Call GetWorkspaceSetting with invalid name
		req := &v1pb.GetWorkspaceSettingRequest{
			Name: "invalid/setting/name",
		}
		_, err := ts.Service.GetWorkspaceSetting(ctx, req)

		// Should return an error
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid workspace setting name")
	})
}

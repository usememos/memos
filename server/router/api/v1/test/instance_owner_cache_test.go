package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestInstanceOwnerCache(t *testing.T) {
	ctx := context.Background()

	t.Run("Instance becomes initialized after first admin user is created", func(t *testing.T) {
		// Create test service
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Verify instance is not initialized initially
		profile1, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.False(t, profile1.Initialized, "Instance should not be initialized before first admin user")

		// Create the first admin user
		user, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		require.NotNil(t, user)

		// Verify instance is now initialized
		profile2, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.True(t, profile2.Initialized, "Instance should be initialized after first admin user is created")
	})

	t.Run("ClearInstanceOwnerCache works correctly", func(t *testing.T) {
		// Create test service
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create admin user
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Verify initialized
		profile1, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.True(t, profile1.Initialized)

		// Clear cache
		ts.Service.ClearInstanceOwnerCache()

		// Should still be initialized (cache is refilled from DB)
		profile2, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.True(t, profile2.Initialized)
	})
}

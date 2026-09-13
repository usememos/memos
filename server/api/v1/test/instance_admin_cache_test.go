package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestInstanceAdminRetrieval(t *testing.T) {
	ctx := context.Background()

	t.Run("Instance becomes initialized after first admin user is created", func(t *testing.T) {
		// Create test service
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Verify instance is not initialized initially
		profile1, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.Nil(t, profile1.Admin, "Instance should not be initialized before first admin user")

		// Create the first admin user
		user, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		require.NotNil(t, user)

		// Verify instance is now initialized
		profile2, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.NotNil(t, profile2.Admin, "Instance should be initialized after first admin user is created")
		require.Equal(t, user.Username, profile2.Admin.Username)
	})

	t.Run("Admin retrieval is cached by Store layer", func(t *testing.T) {
		// Create test service
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create admin user
		user, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Multiple calls should return consistent admin user (from cache)
		for i := 0; i < 5; i++ {
			profile, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
			require.NoError(t, err)
			require.NotNil(t, profile.Admin)
			require.Equal(t, user.Username, profile.Admin.Username)
		}
	})
}

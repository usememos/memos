package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestUserEmailVisibility(t *testing.T) {
	ctx := context.Background()

	t.Run("GetUser redacts email for anonymous callers", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "targetuser")
		require.NoError(t, err)

		got, err := ts.Service.GetUser(ctx, &apiv1.GetUserRequest{
			Name: "users/targetuser",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, user.Username, got.Username)
		require.Empty(t, got.Email)
	})

	t.Run("GetUser redacts email for other regular users", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		targetUser, err := ts.CreateRegularUser(ctx, "targetuser")
		require.NoError(t, err)
		viewer, err := ts.CreateRegularUser(ctx, "vieweruser")
		require.NoError(t, err)

		viewerCtx := ts.CreateUserContext(ctx, viewer.ID)
		got, err := ts.Service.GetUser(viewerCtx, &apiv1.GetUserRequest{
			Name: "users/targetuser",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, targetUser.Username, got.Username)
		require.Empty(t, got.Email)
	})

	t.Run("GetUser returns email for the same user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "selfuser")
		require.NoError(t, err)

		userCtx := ts.CreateUserContext(ctx, user.ID)
		got, err := ts.Service.GetUser(userCtx, &apiv1.GetUserRequest{
			Name: "users/selfuser",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, user.Email, got.Email)
	})

	t.Run("GetUser returns email for admins", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		targetUser, err := ts.CreateRegularUser(ctx, "targetuser")
		require.NoError(t, err)
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		got, err := ts.Service.GetUser(adminCtx, &apiv1.GetUserRequest{
			Name: "users/targetuser",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, targetUser.Email, got.Email)
	})

	t.Run("GetCurrentUser returns email for the authenticated user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "currentuser")
		require.NoError(t, err)

		userCtx := ts.CreateUserContext(ctx, user.ID)
		got, err := ts.Service.GetCurrentUser(userCtx, &apiv1.GetCurrentUserRequest{})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.NotNil(t, got.User)
		require.Equal(t, user.Email, got.User.Email)
	})

	t.Run("GetInstanceProfile redacts admin email for anonymous callers", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		got, err := ts.Service.GetInstanceProfile(ctx, &apiv1.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.NotNil(t, got.Admin)
		require.Equal(t, admin.Username, got.Admin.Username)
		require.Empty(t, got.Admin.Email)
	})
}

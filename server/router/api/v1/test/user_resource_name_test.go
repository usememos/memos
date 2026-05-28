package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	apiv1server "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestUserResourceName(t *testing.T) {
	ctx := context.Background()

	t.Run("GetUser returns username-based canonical name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		got, err := ts.Service.GetUser(ctx, &apiv1.GetUserRequest{
			Name: "users/testuser",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, "users/testuser", got.Name)
		require.Equal(t, user.Username, got.Username)
	})

	t.Run("CreateUser returns username-based canonical name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		created, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "password123",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, "users/newuser", created.Name)
	})

	t.Run("Mixed-case username remains usable after auth", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "Gnammi")
		require.NoError(t, err)

		userCtx := ts.CreateUserContext(ctx, user.ID)
		currentUser, err := ts.Service.GetCurrentUser(userCtx, &apiv1.GetCurrentUserRequest{})
		require.NoError(t, err)
		require.NotNil(t, currentUser.GetUser())
		require.Equal(t, "users/Gnammi", currentUser.GetUser().Name)

		settings, err := ts.Service.ListUserSettings(userCtx, &apiv1.ListUserSettingsRequest{
			Parent: currentUser.GetUser().Name,
		})
		require.NoError(t, err)
		require.NotNil(t, settings)

		shortcuts, err := ts.Service.ListShortcuts(userCtx, &apiv1.ListShortcutsRequest{
			Parent: currentUser.GetUser().Name,
		})
		require.NoError(t, err)
		require.NotNil(t, shortcuts)
	})

	t.Run("BatchGetUsers preserves mixed-case usernames", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "Gnammi")
		require.NoError(t, err)

		resp, err := ts.Service.BatchGetUsers(ctx, &apiv1.BatchGetUsersRequest{
			Usernames: []string{user.Username},
		})
		require.NoError(t, err)
		require.Len(t, resp.Users, 1)
		require.Equal(t, "users/Gnammi", resp.Users[0].Name)
	})

	t.Run("CreateUser rejects all-numeric usernames", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "123",
				Email:    "123@example.com",
				Password: "password123",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid username")
	})

	t.Run("GetUser returns not found for numeric user resource names", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		_, err = ts.Service.GetUser(ctx, &apiv1.GetUserRequest{
			Name: "users/1",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not found")
	})

	t.Run("legacy invalid username remains addressable for get update and delete", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		legacyUser, err := ts.CreateRegularUser(ctx, "legacy_user")
		require.NoError(t, err)

		got, err := ts.Service.GetUser(ctx, &apiv1.GetUserRequest{
			Name: "users/legacy_user",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, "users/legacy_user", got.Name)

		authCtx := ts.CreateUserContext(apiv1server.WithHeaderCarrier(ctx), legacyUser.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:        apiv1server.BuildUserName(legacyUser.Username),
				DisplayName: "Legacy User",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"display_name"}},
		})
		require.NoError(t, err)
		require.Equal(t, "Legacy User", updated.DisplayName)

		_, err = ts.Service.DeleteUser(authCtx, &apiv1.DeleteUserRequest{
			Name: apiv1server.BuildUserName(legacyUser.Username),
		})
		require.NoError(t, err)

		deleted, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &legacyUser.ID})
		require.NoError(t, err)
		require.Nil(t, deleted)
	})

	t.Run("email-like legacy username can be renamed to a valid username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		legacyUser, err := ts.CreateRegularUser(ctx, "alice@example.com")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(apiv1server.WithHeaderCarrier(ctx), legacyUser.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:     apiv1server.BuildUserName(legacyUser.Username),
				Username: "alice",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"username"}},
		})
		require.NoError(t, err)
		require.Equal(t, "users/alice", updated.Name)
		require.Equal(t, "alice", updated.Username)

		renamed, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &legacyUser.ID})
		require.NoError(t, err)
		require.NotNil(t, renamed)
		require.Equal(t, "alice", renamed.Username)
	})

	t.Run("email-like legacy username can be deleted", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		legacyUser, err := ts.CreateRegularUser(ctx, "bob@example.com")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(apiv1server.WithHeaderCarrier(ctx), legacyUser.ID)
		_, err = ts.Service.DeleteUser(authCtx, &apiv1.DeleteUserRequest{
			Name: apiv1server.BuildUserName(legacyUser.Username),
		})
		require.NoError(t, err)

		deleted, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &legacyUser.ID})
		require.NoError(t, err)
		require.Nil(t, deleted)
	})
}

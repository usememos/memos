package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/server/api"
	"github.com/usememos/memos/store"
)

func TestUserResourceName(t *testing.T) {
	ctx := context.Background()

	t.Run("GetUser returns username-based canonical name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		got, err := ts.Service.GetUser(ctx, &apipb.GetUserRequest{
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

		created, err := ts.Service.CreateUser(ctx, &apipb.CreateUserRequest{
			User: &apipb.User{
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
		currentUser, err := ts.Service.GetCurrentUser(userCtx, &apipb.GetCurrentUserRequest{})
		require.NoError(t, err)
		require.NotNil(t, currentUser.GetUser())
		require.Equal(t, "users/Gnammi", currentUser.GetUser().Name)

		settings, err := ts.Service.ListUserSettings(userCtx, &apipb.ListUserSettingsRequest{
			Parent: currentUser.GetUser().Name,
		})
		require.NoError(t, err)
		require.NotNil(t, settings)

		memoViews, err := ts.Service.ListMemoViews(userCtx, &apipb.ListMemoViewsRequest{
			Parent: currentUser.GetUser().Name,
		})
		require.NoError(t, err)
		require.NotNil(t, memoViews)
	})

	t.Run("BatchGetUsers preserves mixed-case usernames", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "Gnammi")
		require.NoError(t, err)

		resp, err := ts.Service.BatchGetUsers(ctx, &apipb.BatchGetUsersRequest{
			Names: []string{"users/" + user.Username},
		})
		require.NoError(t, err)
		require.Len(t, resp.Users, 1)
		require.Equal(t, "users/Gnammi", resp.Users[0].Name)
	})

	t.Run("CreateUser accepts all-numeric usernames", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		created, err := ts.Service.CreateUser(ctx, &apipb.CreateUserRequest{
			User: &apipb.User{
				Username: "123",
				Email:    "123@example.com",
				Password: "password123",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "users/123", created.Name)
	})

	t.Run("GetUser does not interpret a numeric username as an internal ID", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		_, err = ts.Service.GetUser(ctx, &apipb.GetUserRequest{
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

		got, err := ts.Service.GetUser(ctx, &apipb.GetUserRequest{
			Name: "users/legacy_user",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, "users/legacy_user", got.Name)

		authCtx := ts.CreateUserContext(api.WithHeaderCarrier(ctx), legacyUser.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apipb.UpdateUserRequest{
			User: &apipb.User{
				Name:        api.BuildUserName(legacyUser.Username),
				DisplayName: "Legacy User",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"display_name"}},
		})
		require.NoError(t, err)
		require.Equal(t, "Legacy User", updated.DisplayName)

		_, err = ts.Service.DeleteUser(authCtx, &apipb.DeleteUserRequest{
			Name: api.BuildUserName(legacyUser.Username),
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

		authCtx := ts.CreateUserContext(api.WithHeaderCarrier(ctx), legacyUser.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apipb.UpdateUserRequest{
			User: &apipb.User{
				Name:     api.BuildUserName(legacyUser.Username),
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

		authCtx := ts.CreateUserContext(api.WithHeaderCarrier(ctx), legacyUser.ID)
		_, err = ts.Service.DeleteUser(authCtx, &apipb.DeleteUserRequest{
			Name: api.BuildUserName(legacyUser.Username),
		})
		require.NoError(t, err)

		deleted, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &legacyUser.ID})
		require.NoError(t, err)
		require.Nil(t, deleted)
	})
}

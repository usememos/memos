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

func TestUserServiceWithEmailLikeUsername(t *testing.T) {
	ctx := context.Background()

	t.Run("GetUser accepts email-like username in resource name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice@example.com")
		require.NoError(t, err)

		got, err := ts.Service.GetUser(ctx, &apiv1.GetUserRequest{
			Name: "users/alice@example.com",
		})
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, user.Username, got.Username)
		require.Equal(t, "users/alice@example.com", got.Name)
	})

	t.Run("ListUserSettings accepts email-like username in parent", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice@example.com")
		require.NoError(t, err)

		userCtx := ts.CreateUserContext(ctx, user.ID)
		resp, err := ts.Service.ListUserSettings(userCtx, &apiv1.ListUserSettingsRequest{
			Parent: "users/alice@example.com",
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotEmpty(t, resp.Settings)
	})

	t.Run("UpdateUser can change non-username fields for email-like username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice@example.com")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(ctx, user.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:        "users/alice@example.com",
				DisplayName: "Alice Example",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"display_name"}},
		})
		require.NoError(t, err)
		require.Equal(t, "Alice Example", updated.DisplayName)
		require.Equal(t, "users/alice@example.com", updated.Name)
	})

	t.Run("UpdateUser can rename email-like username to valid username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "bob@example.com")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(ctx, user.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:     "users/bob@example.com",
				Username: "bob",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"username"}},
		})
		require.NoError(t, err)
		require.Equal(t, "bob", updated.Username)
		require.Equal(t, apiv1server.BuildUserName("bob"), updated.Name)

		stored, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
		require.NoError(t, err)
		require.NotNil(t, stored)
		require.Equal(t, "bob", stored.Username)
	})

	t.Run("UpdateUser can archive email-like username account", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "dave@example.com")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(ctx, user.ID)
		updated, err := ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:  "users/dave@example.com",
				State: apiv1.State_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.NoError(t, err)
		require.Equal(t, apiv1.State_ARCHIVED, updated.State)

		stored, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
		require.NoError(t, err)
		require.NotNil(t, stored)
		require.Equal(t, store.Archived, stored.RowStatus)
	})

	t.Run("DeleteUser can remove email-like username account", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "carol@example.com")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(apiv1server.WithHeaderCarrier(ctx), user.ID)
		_, err = ts.Service.DeleteUser(authCtx, &apiv1.DeleteUserRequest{
			Name: "users/carol@example.com",
		})
		require.NoError(t, err)

		deleted, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
		require.NoError(t, err)
		require.Nil(t, deleted)
	})
}

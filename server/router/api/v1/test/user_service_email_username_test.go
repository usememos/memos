package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	apiv1server "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestUserServiceWithEmailLikeUsername(t *testing.T) {
	ctx := context.Background()

	t.Run("SignIn accepts email-like legacy username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user := createLegacyPasswordUser(ctx, t, ts, "signin@example.com", "password123")

		signInCtx := apiv1server.WithHeaderCarrier(ctx)
		resp, err := ts.Service.SignIn(signInCtx, &apiv1.SignInRequest{
			Credentials: &apiv1.SignInRequest_PasswordCredentials_{
				PasswordCredentials: &apiv1.SignInRequest_PasswordCredentials{
					Username: user.Username,
					Password: "password123",
				},
			},
		})
		require.NoError(t, err)
		require.Equal(t, user.Username, resp.User.Username)
		require.NotEmpty(t, resp.AccessToken)
	})

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

	t.Run("BatchGetUsers accepts email-like legacy username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "batch@example.com")
		require.NoError(t, err)

		resp, err := ts.Service.BatchGetUsers(ctx, &apiv1.BatchGetUsersRequest{
			Usernames: []string{" batch@example.com ", "missing@example.com", "batch@example.com"},
		})
		require.NoError(t, err)
		require.Len(t, resp.Users, 1)
		require.Equal(t, user.Username, resp.Users[0].Username)
		require.Equal(t, "users/batch@example.com", resp.Users[0].Name)
	})

	t.Run("BatchGetUsers accepts underscore legacy username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "legacy_batch")
		require.NoError(t, err)

		resp, err := ts.Service.BatchGetUsers(ctx, &apiv1.BatchGetUsersRequest{
			Usernames: []string{"legacy_batch"},
		})
		require.NoError(t, err)
		require.Len(t, resp.Users, 1)
		require.Equal(t, user.Username, resp.Users[0].Username)
		require.Equal(t, "users/legacy_batch", resp.Users[0].Name)
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

	t.Run("UpdateUser rejects writing invalid username values", func(t *testing.T) {
		for _, username := range []string{"alice@example.com", "legacy_user"} {
			t.Run(username, func(t *testing.T) {
				ts := NewTestService(t)
				defer ts.Cleanup()

				user, err := ts.CreateRegularUser(ctx, "rename@example.com")
				require.NoError(t, err)

				authCtx := ts.CreateUserContext(ctx, user.ID)
				_, err = ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
					User: &apiv1.User{
						Name:     "users/rename@example.com",
						Username: username,
					},
					UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"username"}},
				})
				require.Error(t, err)
				require.Contains(t, err.Error(), "invalid username")

				stored, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
				require.NoError(t, err)
				require.NotNil(t, stored)
				require.Equal(t, "rename@example.com", stored.Username)
			})
		}
	})

	t.Run("admin cannot rename user to invalid username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "admin-rename-target")
		require.NoError(t, err)
		admin, err := ts.CreateHostUser(ctx, "rename-admin")
		require.NoError(t, err)

		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		_, err = ts.Service.UpdateUser(adminCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:     apiv1server.BuildUserName(user.Username),
				Username: "admin@example.com",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"username"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid username")

		stored, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
		require.NoError(t, err)
		require.NotNil(t, stored)
		require.Equal(t, "admin-rename-target", stored.Username)
	})

	t.Run("UpdateUser can archive email-like username account", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "dave@example.com")
		require.NoError(t, err)
		admin, err := ts.CreateHostUser(ctx, "email-admin")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(ctx, admin.ID)
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

func createLegacyPasswordUser(ctx context.Context, t *testing.T, ts *TestService, username, password string) *store.User {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)

	user, err := ts.Store.CreateUser(ctx, &store.User{
		Username:     username,
		Role:         store.RoleUser,
		Email:        username,
		PasswordHash: string(passwordHash),
	})
	require.NoError(t, err)
	return user
}

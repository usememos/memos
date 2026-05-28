package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1server "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestCreateUserRegistration(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateUser success when registration enabled", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// User registration is enabled by default, no need to set it explicitly

		// Create user without authentication - should succeed
		_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "password123",
			},
		})
		require.NoError(t, err)
	})

	t.Run("CreateUser blocked when registration disabled", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user first so we're not in first-user setup mode
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Disable user registration
		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{
				GeneralSetting: &storepb.InstanceGeneralSetting{
					DisallowUserRegistration: true,
				},
			},
		})
		require.NoError(t, err)

		// Try to create user without authentication - should fail
		_, err = ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "password123",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not allowed")
	})

	t.Run("CreateUser succeeds for superuser even when registration disabled", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		hostCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Disable user registration
		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{
				GeneralSetting: &storepb.InstanceGeneralSetting{
					DisallowUserRegistration: true,
				},
			},
		})
		require.NoError(t, err)

		// Host user can create users even when registration is disabled - should succeed
		_, err = ts.Service.CreateUser(hostCtx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "password123",
			},
		})
		require.NoError(t, err)
	})

	t.Run("CreateUser regular user cannot create users when registration disabled", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create regular user
		regularUser, err := ts.CreateRegularUser(ctx, "regularuser")
		require.NoError(t, err)
		regularUserCtx := ts.CreateUserContext(ctx, regularUser.ID)

		// Disable user registration
		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{
				GeneralSetting: &storepb.InstanceGeneralSetting{
					DisallowUserRegistration: true,
				},
			},
		})
		require.NoError(t, err)

		// Regular user tries to create user when registration is disabled - should fail
		_, err = ts.Service.CreateUser(regularUserCtx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "password123",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not allowed")
	})

	t.Run("CreateUser host can assign roles", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		hostCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Host user can create user with specific role - should succeed
		createdUser, err := ts.Service.CreateUser(hostCtx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newadmin",
				Email:    "newadmin@example.com",
				Password: "password123",
				Role:     apiv1.User_ADMIN,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "users/newadmin", createdUser.Name)
		require.NotNil(t, createdUser)
		require.Equal(t, apiv1.User_ADMIN, createdUser.Role)
	})

	t.Run("CreateUser unauthenticated user can only create regular user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user first so we're not in first-user setup mode
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// User registration is enabled by default

		// Unauthenticated user tries to create admin user - role should be ignored
		createdUser, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "wannabeadmin",
				Email:    "wannabeadmin@example.com",
				Password: "password123",
				Role:     apiv1.User_ADMIN, // This should be ignored
			},
		})
		require.NoError(t, err)
		require.NotNil(t, createdUser)
		require.Equal(t, "users/wannabeadmin", createdUser.Name)
		require.Equal(t, apiv1.User_USER, createdUser.Role, "Unauthenticated users can only create USER role")
	})

	t.Run("CreateUser blocked when password auth disabled for self signup", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{
				GeneralSetting: &storepb.InstanceGeneralSetting{
					DisallowPasswordAuth: true,
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "password123",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "password signup is not allowed")
	})

	t.Run("CreateUser rejects empty password", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "newuser",
				Email:    "newuser@example.com",
				Password: "",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "password must not be empty")
	})

	t.Run("CreateUser rejects invalid writable usernames", func(t *testing.T) {
		for _, username := range []string{"alice@example.com", "legacy_user", "123"} {
			t.Run(username, func(t *testing.T) {
				ts := NewTestService(t)
				defer ts.Cleanup()

				_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
					User: &apiv1.User{
						Username: username,
						Email:    "newuser@example.com",
						Password: "password123",
					},
				})
				require.Error(t, err)
				require.Contains(t, err.Error(), "invalid username")
			})
		}
	})

	t.Run("CreateUser validate only rejects invalid writable username", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{
				Username: "alice@example.com",
				Email:    "newuser@example.com",
				Password: "password123",
			},
			ValidateOnly: true,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid username")
	})

	t.Run("UpdateUser rejects empty password", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(ctx, user.ID)
		_, err = ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:     apiv1server.BuildUserName(user.Username),
				Password: "",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"password"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "password must not be empty")
	})

	t.Run("UpdateUser rejects missing user message", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "missing-message")
		require.NoError(t, err)

		authCtx := ts.CreateUserContext(ctx, user.ID)
		_, err = ts.Service.UpdateUser(authCtx, &apiv1.UpdateUserRequest{
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"display_name"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "user is required")
	})

	t.Run("CreateUser concurrent first setup creates one admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		const workers = 12
		var wg sync.WaitGroup
		for i := range workers {
			wg.Go(func() {
				_, _ = ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
					User: &apiv1.User{
						Username: fmt.Sprintf("setup-user-%d", i),
						Email:    "setup-user@example.com",
						Password: "password123",
					},
				})
			})
		}
		wg.Wait()

		users, err := ts.Store.ListUsers(ctx, &store.FindUser{})
		require.NoError(t, err)
		adminCount := 0
		for _, user := range users {
			if user.Role == store.RoleAdmin {
				adminCount++
			}
		}
		require.Equal(t, 1, adminCount)
	})

	t.Run("UpdateUser state requires admin", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "state-user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		_, err = ts.Service.UpdateUser(userCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:  apiv1server.BuildUserName(user.Username),
				State: apiv1.State_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		admin, err := ts.CreateHostUser(ctx, "state-admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		updated, err := ts.Service.UpdateUser(adminCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:  apiv1server.BuildUserName(user.Username),
				State: apiv1.State_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.NoError(t, err)
		require.Equal(t, apiv1.State_ARCHIVED, updated.State)
	})

	t.Run("archived user context is rejected", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "archived-access-user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		archived := store.Archived
		_, err = ts.Store.UpdateUser(ctx, &store.UpdateUser{
			ID:        user.ID,
			RowStatus: &archived,
		})
		require.NoError(t, err)

		_, err = ts.Service.GetCurrentUser(userCtx, &apiv1.GetCurrentUserRequest{})
		require.Error(t, err)

		_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content: "should not be created",
			},
		})
		require.Error(t, err)

		_, err = ts.Service.UpdateUser(userCtx, &apiv1.UpdateUserRequest{
			User: &apiv1.User{
				Name:  apiv1server.BuildUserName(user.Username),
				State: apiv1.State_NORMAL,
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.Error(t, err)
	})
}

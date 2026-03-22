package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
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
		require.Equal(t, apiv1.User_USER, createdUser.Role, "Unauthenticated users can only create USER role")
	})
}

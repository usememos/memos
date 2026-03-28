package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
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

	t.Run("GetUser rejects numeric user resource names", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		_, err = ts.Service.GetUser(ctx, &apiv1.GetUserRequest{
			Name: "users/1",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid user name")
	})
}

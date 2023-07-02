package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/store"
	"golang.org/x/crypto/bcrypt"
)

func TestUserStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	users, err := ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Equal(t, 1, len(users))
	require.Equal(t, store.Host, users[0].Role)
	require.Equal(t, user, users[0])
	userPatchNickname := "test_nickname_2"
	userPatch := &store.UpdateUser{
		ID:       user.ID,
		Nickname: &userPatchNickname,
	}
	user, err = ts.UpdateUser(ctx, userPatch)
	require.NoError(t, err)
	require.Equal(t, userPatchNickname, user.Nickname)
	err = ts.DeleteUser(ctx, &api.UserDelete{
		ID: user.ID,
	})
	require.NoError(t, err)
	users, err = ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Equal(t, 0, len(users))
}

func createTestingHostUser(ctx context.Context, ts *store.Store) (*store.User, error) {
	userCreate := &store.User{
		Username: "test",
		Role:     store.Host,
		Email:    "test@test.com",
		Nickname: "test_nickname",
		OpenID:   "test_open_id",
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test_password"), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	userCreate.PasswordHash = string(passwordHash)
	user, err := ts.CreateUserV1(ctx, userCreate)
	return user, err
}

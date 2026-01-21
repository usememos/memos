package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/store"
)

func TestUserStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	users, err := ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Equal(t, 1, len(users))
	require.Equal(t, store.RoleAdmin, users[0].Role)
	require.Equal(t, user, users[0])
	userPatchNickname := "test_nickname_2"
	userPatch := &store.UpdateUser{
		ID:       user.ID,
		Nickname: &userPatchNickname,
	}
	user, err = ts.UpdateUser(ctx, userPatch)
	require.NoError(t, err)
	require.Equal(t, userPatchNickname, user.Nickname)
	err = ts.DeleteUser(ctx, &store.DeleteUser{
		ID: user.ID,
	})
	require.NoError(t, err)
	users, err = ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Equal(t, 0, len(users))
	ts.Close()
}

func TestUserGetByID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Get user by ID
	found, err := ts.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, user.ID, found.ID)
	require.Equal(t, user.Username, found.Username)

	// Get non-existent user
	nonExistentID := int32(99999)
	notFound, err := ts.GetUser(ctx, &store.FindUser{ID: &nonExistentID})
	require.NoError(t, err)
	require.Nil(t, notFound)

	// Get system bot
	systemBotID := store.SystemBotID
	systemBot, err := ts.GetUser(ctx, &store.FindUser{ID: &systemBotID})
	require.NoError(t, err)
	require.NotNil(t, systemBot)
	require.Equal(t, store.SystemBotID, systemBot.ID)
	require.Equal(t, "system_bot", systemBot.Username)

	ts.Close()
}

func TestUserGetByUsername(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Get user by username
	found, err := ts.GetUser(ctx, &store.FindUser{Username: &user.Username})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, user.Username, found.Username)

	// Get non-existent username
	nonExistent := "nonexistent"
	notFound, err := ts.GetUser(ctx, &store.FindUser{Username: &nonExistent})
	require.NoError(t, err)
	require.Nil(t, notFound)

	ts.Close()
}

func TestUserListByRole(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create users with different roles
	_, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = createTestingUserWithRole(ctx, ts, "admin_user", store.RoleAdmin)
	require.NoError(t, err)

	regularUser, err := createTestingUserWithRole(ctx, ts, "regular_user", store.RoleUser)
	require.NoError(t, err)

	// List all users
	allUsers, err := ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Equal(t, 3, len(allUsers))

	// List only ADMIN users
	adminRole := store.RoleAdmin
	adminOnlyUsers, err := ts.ListUsers(ctx, &store.FindUser{Role: &adminRole})
	require.NoError(t, err)
	require.Equal(t, 2, len(adminOnlyUsers))

	// List only USER role users
	userRole := store.RoleUser
	regularUsers, err := ts.ListUsers(ctx, &store.FindUser{Role: &userRole})
	require.NoError(t, err)
	require.Equal(t, 1, len(regularUsers))
	require.Equal(t, regularUser.ID, regularUsers[0].ID)

	ts.Close()
}

func TestUserUpdateRowStatus(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	require.Equal(t, store.Normal, user.RowStatus)

	// Archive user
	archivedStatus := store.Archived
	updated, err := ts.UpdateUser(ctx, &store.UpdateUser{
		ID:        user.ID,
		RowStatus: &archivedStatus,
	})
	require.NoError(t, err)
	require.Equal(t, store.Archived, updated.RowStatus)

	// Verify by fetching
	fetched, err := ts.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Equal(t, store.Archived, fetched.RowStatus)

	// Restore to normal
	normalStatus := store.Normal
	restored, err := ts.UpdateUser(ctx, &store.UpdateUser{
		ID:        user.ID,
		RowStatus: &normalStatus,
	})
	require.NoError(t, err)
	require.Equal(t, store.Normal, restored.RowStatus)

	ts.Close()
}

func TestUserUpdateAllFields(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Update all fields
	newUsername := "updated_username"
	newEmail := "updated@test.com"
	newNickname := "Updated Nickname"
	newAvatarURL := "https://example.com/avatar.png"
	newDescription := "Updated description"
	newRole := store.RoleAdmin
	newPasswordHash := "new_password_hash"

	updated, err := ts.UpdateUser(ctx, &store.UpdateUser{
		ID:           user.ID,
		Username:     &newUsername,
		Email:        &newEmail,
		Nickname:     &newNickname,
		AvatarURL:    &newAvatarURL,
		Description:  &newDescription,
		Role:         &newRole,
		PasswordHash: &newPasswordHash,
	})
	require.NoError(t, err)
	require.Equal(t, newUsername, updated.Username)
	require.Equal(t, newEmail, updated.Email)
	require.Equal(t, newNickname, updated.Nickname)
	require.Equal(t, newAvatarURL, updated.AvatarURL)
	require.Equal(t, newDescription, updated.Description)
	require.Equal(t, newRole, updated.Role)
	require.Equal(t, newPasswordHash, updated.PasswordHash)

	// Verify by fetching again
	fetched, err := ts.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Equal(t, newUsername, fetched.Username)

	ts.Close()
}

func TestUserListWithLimit(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create 5 users
	for i := 0; i < 5; i++ {
		role := store.RoleUser
		if i == 0 {
			role = store.RoleAdmin
		}
		_, err := createTestingUserWithRole(ctx, ts, fmt.Sprintf("user%d", i), role)
		require.NoError(t, err)
	}

	// List with limit
	limit := 3
	users, err := ts.ListUsers(ctx, &store.FindUser{Limit: &limit})
	require.NoError(t, err)
	require.Equal(t, 3, len(users))

	ts.Close()
}

func createTestingHostUser(ctx context.Context, ts *store.Store) (*store.User, error) {
	return createTestingUserWithRole(ctx, ts, "test", store.RoleAdmin)
}

func createTestingUserWithRole(ctx context.Context, ts *store.Store, username string, role store.Role) (*store.User, error) {
	userCreate := &store.User{
		Username:    username,
		Role:        role,
		Email:       username + "@test.com",
		Nickname:    username + "_nickname",
		Description: username + "_description",
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test_password"), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	userCreate.PasswordHash = string(passwordHash)
	user, err := ts.CreateUser(ctx, userCreate)
	return user, err
}

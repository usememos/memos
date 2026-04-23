package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestUserIdentityCreateAndGet(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	provider := "idp-uid-1"
	externUID := "jane@example.com"
	created, err := ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  provider,
		ExternUID: externUID,
	})
	require.NoError(t, err)
	require.NotZero(t, created.ID)
	require.NotZero(t, created.CreatedTs)
	require.Equal(t, user.ID, created.UserID)
	require.Equal(t, provider, created.Provider)
	require.Equal(t, externUID, created.ExternUID)

	got, err := ts.GetUserIdentity(ctx, &store.FindUserIdentity{
		Provider:  &provider,
		ExternUID: &externUID,
	})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, created.ID, got.ID)
	require.Equal(t, user.ID, got.UserID)

	// Miss returns (nil, nil).
	missingProvider := "idp-uid-missing"
	notFound, err := ts.GetUserIdentity(ctx, &store.FindUserIdentity{
		Provider:  &missingProvider,
		ExternUID: &externUID,
	})
	require.NoError(t, err)
	require.Nil(t, notFound)
}

func TestUserIdentityListByUserID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-A",
		ExternUID: "sub-a-1",
	})
	require.NoError(t, err)
	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-B",
		ExternUID: "sub-b-1",
	})
	require.NoError(t, err)

	list, err := ts.ListUserIdentities(ctx, &store.FindUserIdentity{
		UserID: &user.ID,
	})
	require.NoError(t, err)
	require.Len(t, list, 2)
}

func TestUserIdentityUniqueConflict(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	userA, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	userB, err := createTestingUserWithRole(ctx, ts, "conflict_user", store.RoleUser)
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    userA.ID,
		Provider:  "idp-A",
		ExternUID: "sub-1",
	})
	require.NoError(t, err)

	// Second insert with the same (provider, extern_uid) must fail regardless of user_id.
	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    userB.ID,
		Provider:  "idp-A",
		ExternUID: "sub-1",
	})
	require.Error(t, err)
}

func TestUserIdentitySameExternUIDDifferentProviders(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-A",
		ExternUID: "sub-1",
	})
	require.NoError(t, err)
	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-B",
		ExternUID: "sub-1",
	})
	require.NoError(t, err)

	externUID := "sub-1"
	list, err := ts.ListUserIdentities(ctx, &store.FindUserIdentity{
		ExternUID: &externUID,
	})
	require.NoError(t, err)
	require.Len(t, list, 2)
}

func TestUserIdentitySameUserSameProviderConflicts(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-A",
		ExternUID: "sub-1",
	})
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-A",
		ExternUID: "sub-2",
	})
	require.Error(t, err)
}

func TestUserIdentityDeleteByUserAndProvider(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-A",
		ExternUID: "sub-a-1",
	})
	require.NoError(t, err)
	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "idp-B",
		ExternUID: "sub-b-1",
	})
	require.NoError(t, err)

	provider := "idp-A"
	err = ts.DeleteUserIdentities(ctx, &store.DeleteUserIdentity{
		UserID:   &user.ID,
		Provider: &provider,
	})
	require.NoError(t, err)

	list, err := ts.ListUserIdentities(ctx, &store.FindUserIdentity{
		UserID: &user.ID,
	})
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "idp-B", list[0].Provider)
}

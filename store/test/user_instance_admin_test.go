package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestUserMutationsRetainAnInstanceAdmin(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	admin, err := createTestingUserWithRole(ctx, ts, "only-admin", store.RoleAdmin)
	require.NoError(t, err)
	member, err := createTestingUserWithRole(ctx, ts, "member", store.RoleUser)
	require.NoError(t, err)

	archived := store.Archived
	userRole := store.RoleUser
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: admin.ID, RowStatus: &archived})
	require.ErrorIs(t, err, store.ErrLastInstanceAdmin, "archive the last admin")
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: admin.ID, Role: &userRole})
	require.ErrorIs(t, err, store.ErrLastInstanceAdmin, "demote the last admin")
	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: admin.ID})
	require.ErrorIs(t, err, store.ErrLastInstanceAdmin, "delete the last admin")

	// Mutations that keep the admin, or touch other users, are unaffected.
	nickname := "still admin"
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: admin.ID, Nickname: &nickname})
	require.NoError(t, err)
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: member.ID, RowStatus: &archived})
	require.NoError(t, err)

	// An archived admin does not count as the remaining admin.
	archivedAdmin, err := createTestingUserWithRole(ctx, ts, "archived-admin", store.RoleAdmin)
	require.NoError(t, err)
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: archivedAdmin.ID, RowStatus: &archived})
	require.NoError(t, err)
	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: admin.ID})
	require.ErrorIs(t, err, store.ErrLastInstanceAdmin)

	// With a second active admin, the first may step down.
	_, err = createTestingUserWithRole(ctx, ts, "successor-admin", store.RoleAdmin)
	require.NoError(t, err)
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: admin.ID, Role: &userRole})
	require.NoError(t, err)
}

// TestLastAdminCheckWaitsForConcurrentAdminRemoval demotes one admin while
// another admin's demotion is still uncommitted. The check must wait for that
// transaction and then refuse, so the instance keeps exactly one active admin.
func TestLastAdminCheckWaitsForConcurrentAdminRemoval(t *testing.T) {
	driver := getDriverFromEnv()
	if driver == "sqlite" {
		t.Skip("SQLite transactions begin IMMEDIATE and serialize competing writes without row locks")
	}

	setupCtx := context.Background()
	ts := NewTestingStore(setupCtx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	ctx, cancel := context.WithTimeout(setupCtx, 10*time.Second)
	defer cancel()

	first, err := createTestingUserWithRole(ctx, ts, "concurrent-admin-first", store.RoleAdmin)
	require.NoError(t, err)
	second, err := createTestingUserWithRole(ctx, ts, "concurrent-admin-second", store.RoleAdmin)
	require.NoError(t, err)

	blocker, err := ts.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	blockerOpen := true
	defer func() {
		if blockerOpen {
			_ = blocker.Rollback()
		}
	}()
	demoteFirst := "UPDATE user SET role = 'USER' WHERE id = ?"
	if driver == "postgres" {
		demoteFirst = `UPDATE "user" SET role = 'USER' WHERE id = $1`
	}
	_, err = blocker.ExecContext(ctx, demoteFirst, first.ID)
	require.NoError(t, err)

	demoteDone := make(chan error, 1)
	go func() {
		_, demoteErr := ts.UpdateUser(ctx, &store.UpdateUser{ID: second.ID, Role: new(store.RoleUser)})
		demoteDone <- demoteErr
	}()
	select {
	case demoteErr := <-demoteDone:
		require.FailNowf(t, "demotion did not wait", "returned %v while the other admin's demotion was uncommitted", demoteErr)
	case <-time.After(300 * time.Millisecond):
	}

	require.NoError(t, blocker.Commit())
	blockerOpen = false
	select {
	case demoteErr := <-demoteDone:
		require.ErrorIs(t, demoteErr, store.ErrLastInstanceAdmin)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for the demotion")
	}

	admins, err := ts.ListUsers(ctx, &store.FindUser{Role: new(store.RoleAdmin), RowStatus: new(store.Normal)})
	require.NoError(t, err)
	require.Len(t, admins, 1)
	require.Equal(t, second.ID, admins[0].ID)
}

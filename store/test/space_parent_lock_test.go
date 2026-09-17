package test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// TestSQLiteRelationshipWriteSerializesWithParentDelete confirms how SQLite
// keeps a relationship write from outliving a deleted parent. The store opens
// every transaction IMMEDIATE, so a transaction that has read the parent holds
// the write lock until it ends: a concurrent delete waits instead of committing
// underneath it (with DEFERRED transactions the delete would commit and the
// later insert would fail with SQLITE_BUSY at once). Once the transaction ends
// the delete proceeds, and a fresh relationship write for the deleted parent
// fails on its own read.
func TestSQLiteRelationshipWriteSerializesWithParentDelete(t *testing.T) {
	if getDriverFromEnv() != "sqlite" {
		t.Skip("this test confirms SQLite's IMMEDIATE transaction serialization")
	}

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	owner, err := ts.CreateUser(ctx, &store.User{Username: "sqlite-stale-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	target, err := ts.CreateUser(ctx, &store.User{Username: "sqlite-stale-target", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "sqlite-stale-space", Title: "SQLite Stale Parent"}, owner.ID)
	require.NoError(t, err)

	writer, err := ts.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	writerOpen := true
	defer func() {
		if writerOpen {
			_ = writer.Rollback()
		}
	}()
	var storedUserID int32
	require.NoError(t, writer.QueryRowContext(ctx, "SELECT id FROM user WHERE id = ?", target.ID).Scan(&storedUserID))

	deleteDone := make(chan error, 1)
	go func() {
		_, deleteErr := ts.DeleteUser(context.Background(), &store.DeleteUser{ID: target.ID})
		deleteDone <- deleteErr
	}()
	select {
	case deleteErr := <-deleteDone:
		require.FailNowf(t, "user deletion did not wait", "deletion finished while a transaction that read the user was open: %v", deleteErr)
	case <-time.After(300 * time.Millisecond):
	}

	// The transaction that read the parent may still write it: the delete has
	// not happened yet, and it will clean this row up when it does.
	_, err = writer.ExecContext(ctx, `INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, 'INVITED', 'USER')`, space.ID, target.ID)
	require.NoError(t, err)
	require.NoError(t, writer.Commit())
	writerOpen = false

	select {
	case deleteErr := <-deleteDone:
		require.NoError(t, deleteErr)
	case <-time.After(15 * time.Second):
		require.FailNow(t, "timed out waiting for user deletion after the transaction ended")
	}

	// After the delete, a relationship write for the parent fails on its own read.
	_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{SpaceID: space.ID, UserID: target.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.ErrorIs(t, err, store.ErrSpaceMemberNotActive)

	var relationshipCount int
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM space_member WHERE space_id = ? AND user_id = ?", space.ID, target.ID,
	).Scan(&relationshipCount))
	require.Zero(t, relationshipCount)
}

func TestSpaceInvitationWaitsForConcurrentUserDelete(t *testing.T) {
	driver := getDriverFromEnv()
	if driver == "sqlite" || driver == "d1" {
		t.Skip("SQLite transactions begin IMMEDIATE and serialize competing writes without row locks; D1 has no row locks")
	}

	setupCtx := context.Background()
	ts := NewTestingStore(setupCtx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	ctx, cancel := context.WithTimeout(setupCtx, 10*time.Second)
	defer cancel()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "user-delete-lock-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	target, err := ts.CreateUser(ctx, &store.User{Username: "user-delete-lock-target", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "user-delete-lock-space", Title: "User Delete Lock"}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "user-delete-lock-memo", CreatorID: target.ID, Content: "lock", Visibility: store.Public})
	require.NoError(t, err)

	blocker, err := ts.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	blockerOpen := true
	defer func() {
		if blockerOpen {
			_ = blocker.Rollback()
		}
	}()
	require.NoError(t, lockMemoRow(ctx, blocker, driver, memo.ID))

	deleteDone := make(chan error, 1)
	go func() {
		_, deleteErr := ts.DeleteUser(ctx, &store.DeleteUser{ID: target.ID})
		deleteDone <- deleteErr
	}()
	waitForLockedParentRow(ctx, t, ts.GetDriver().GetDB(), driver, "user", target.ID)

	inviteCtx, inviteCancel := context.WithTimeout(ctx, 300*time.Millisecond)
	started := time.Now()
	_, inviteErr := ts.CreateSpaceInvitation(inviteCtx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  target.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	inviteCancel()
	require.Error(t, inviteErr)
	require.GreaterOrEqual(t, time.Since(started), 250*time.Millisecond, "invitation creation must wait for the deleting user's row lock")

	require.NoError(t, blocker.Commit())
	blockerOpen = false
	select {
	case deleteErr := <-deleteDone:
		require.NoError(t, deleteErr)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for user deletion")
	}

	var relationshipCount int
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, relationshipCountQuery(driver, "user_id"), target.ID).Scan(&relationshipCount))
	require.Zero(t, relationshipCount, "deleting a user must not leave a concurrent invitation behind")
}

func TestSpaceInvitationWaitsForConcurrentSpaceDelete(t *testing.T) {
	driver := getDriverFromEnv()
	if driver == "sqlite" || driver == "d1" {
		t.Skip("SQLite transactions begin IMMEDIATE and serialize competing writes without row locks; D1 has no row locks")
	}

	setupCtx := context.Background()
	ts := NewTestingStore(setupCtx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	ctx, cancel := context.WithTimeout(setupCtx, 10*time.Second)
	defer cancel()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "space-delete-lock-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	target, err := ts.CreateUser(ctx, &store.User{Username: "space-delete-lock-target", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "space-delete-lock-space", Title: "Space Delete Lock"}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "space-delete-lock-memo", CreatorID: owner.ID, Content: "lock", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)

	blocker, err := ts.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	blockerOpen := true
	defer func() {
		if blockerOpen {
			_ = blocker.Rollback()
		}
	}()
	require.NoError(t, lockMemoRow(ctx, blocker, driver, memo.ID))

	deleteDone := make(chan error, 1)
	go func() {
		_, deleteErr := ts.DeleteSpace(ctx, &store.DeleteSpace{ID: space.ID, ActorUserID: owner.ID})
		deleteDone <- deleteErr
	}()
	waitForLockedParentRow(ctx, t, ts.GetDriver().GetDB(), driver, "space", space.ID)

	inviteCtx, inviteCancel := context.WithTimeout(ctx, 300*time.Millisecond)
	started := time.Now()
	_, inviteErr := ts.CreateSpaceInvitation(inviteCtx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  target.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	inviteCancel()
	require.Error(t, inviteErr)
	require.GreaterOrEqual(t, time.Since(started), 250*time.Millisecond, "invitation creation must wait for the deleting Space's row lock")

	require.NoError(t, blocker.Commit())
	blockerOpen = false
	select {
	case deleteErr := <-deleteDone:
		require.NoError(t, deleteErr)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for Space deletion")
	}

	var relationshipCount int
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, relationshipCountQuery(driver, "space_id"), space.ID).Scan(&relationshipCount))
	require.Zero(t, relationshipCount, "deleting a Space must not leave a concurrent invitation behind")
}

func lockMemoRow(ctx context.Context, tx *sql.Tx, driver string, memoID int32) error {
	query := "SELECT id FROM memo WHERE id = ? FOR UPDATE"
	if driver == "postgres" {
		query = "SELECT id FROM memo WHERE id = $1 FOR UPDATE"
	}
	var storedMemoID int32
	return tx.QueryRowContext(ctx, query, memoID).Scan(&storedMemoID)
}

func waitForLockedParentRow(ctx context.Context, t *testing.T, db *sql.DB, driver, table string, id int32) {
	t.Helper()
	query := "SELECT id FROM " + table + " WHERE id = ? FOR UPDATE NOWAIT"
	if driver == "postgres" {
		if table == "user" {
			table = `"user"`
		}
		query = "SELECT id FROM " + table + " WHERE id = $1 FOR UPDATE NOWAIT"
	}
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		probe, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		var storedID int32
		err = probe.QueryRowContext(ctx, query, id).Scan(&storedID)
		_ = probe.Rollback()
		if err != nil {
			return
		}
		select {
		case <-ticker.C:
		case <-ctx.Done():
			require.FailNow(t, "timed out waiting for parent row lock")
		}
	}
}

func relationshipCountQuery(driver, column string) string {
	if driver == "postgres" {
		return "SELECT COUNT(*) FROM space_member WHERE " + column + " = $1"
	}
	return "SELECT COUNT(*) FROM space_member WHERE " + column + " = ?"
}

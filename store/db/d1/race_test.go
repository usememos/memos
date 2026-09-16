package d1

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/d1/d1test"
)

// raceTransport wraps a transport and runs action once, right before the
// first request whose SQL contains trigger reaches the database. Driver
// methods validate with reads and then commit a batch, so an action fired on
// the batch changes the database in exactly the window a concurrent writer
// would, and the guards must catch it.
type raceTransport struct {
	transport
	trigger string
	action  func()
	fired   bool
}

func (t *raceTransport) exec(ctx context.Context, stmt statement) (*result, error) {
	t.fire(stmt.SQL)
	return t.transport.exec(ctx, stmt)
}

func (t *raceTransport) batch(ctx context.Context, stmts []statement) ([]*result, error) {
	sqls := make([]string, 0, len(stmts))
	for _, stmt := range stmts {
		sqls = append(sqls, stmt.SQL)
	}
	t.fire(strings.Join(sqls, "\n"))
	return t.transport.batch(ctx, stmts)
}

func (t *raceTransport) fire(sql string) {
	if t.fired || !strings.Contains(sql, t.trigger) {
		return
	}
	t.fired = true
	t.action()
}

// raceDB is a schema-initialized driver whose transport can be interposed,
// plus a second, independent handle on the same database for the
// interposing action to use.
type raceDB struct {
	*DB
	other *DB
	ctx   context.Context
}

func newRaceDB(t *testing.T, dsn func(*d1test.Server) string) *raceDB {
	t.Helper()
	server := d1test.New(t)
	open := func() *DB {
		driver, err := NewDB(&profile.Profile{Driver: "d1", DSN: dsn(server)})
		require.NoError(t, err)
		db, ok := driver.(*DB)
		require.True(t, ok)
		t.Cleanup(func() { require.NoError(t, db.Close()) })
		return db
	}
	db := &raceDB{DB: open(), other: open(), ctx: context.Background()}

	schema, err := os.ReadFile(filepath.Join("..", "..", "migration", "d1", "LATEST.sql"))
	require.NoError(t, err)
	tx, err := db.GetDB().Begin()
	require.NoError(t, err)
	_, err = tx.ExecContext(db.ctx, string(schema))
	require.NoError(t, err)
	require.NoError(t, tx.Commit())
	return db
}

// interpose installs action to run before the first request containing
// trigger. Requests made by other bypass it.
func (db *raceDB) interpose(t *testing.T, trigger string, action func()) {
	t.Helper()
	require.NoError(t, db.db.Close())
	wrapped := &raceTransport{transport: db.transport, trigger: trigger, action: action}
	db.transport = wrapped
	db.db = openSQLDB(wrapped)
	t.Cleanup(func() { require.True(t, wrapped.fired, "the interposed action never ran") })
}

func (db *raceDB) user(t *testing.T, username string) *store.User {
	t.Helper()
	user, err := db.other.CreateUser(db.ctx, &store.User{Username: username, Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	return user
}

func (db *raceDB) memo(t *testing.T, uid string, creator *store.User) *store.Memo {
	t.Helper()
	memo, err := db.other.CreateMemo(db.ctx, &store.Memo{UID: uid, CreatorID: creator.ID, Content: "original", Visibility: store.Private})
	require.NoError(t, err)
	return memo
}

func (db *raceDB) attachment(t *testing.T, uid string, creator *store.User, memo *store.Memo) *store.Attachment {
	t.Helper()
	attachment, err := db.other.CreateAttachment(db.ctx, &store.Attachment{UID: uid, CreatorID: creator.ID, Filename: uid + ".png", Type: "image/png", MemoID: &memo.ID})
	require.NoError(t, err)
	return attachment
}

func (db *raceDB) archive(t *testing.T, memo *store.Memo) {
	t.Helper()
	archived := store.Archived
	require.NoError(t, db.other.UpdateMemo(db.ctx, &store.UpdateMemo{ID: memo.ID, RowStatus: &archived}))
}

func (db *raceDB) memoContent(t *testing.T, memo *store.Memo) string {
	t.Helper()
	var content string
	require.NoError(t, db.other.GetDB().QueryRowContext(db.ctx, "SELECT content FROM memo WHERE id = ?", memo.ID).Scan(&content))
	return content
}

func (db *raceDB) count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	require.NoError(t, db.other.GetDB().QueryRowContext(db.ctx, query, args...).Scan(&n))
	return n
}

func forEachAccessMode(t *testing.T, run func(t *testing.T, db *raceDB)) {
	t.Helper()
	for mode, dsn := range accessModes {
		t.Run(mode, func(t *testing.T) {
			run(t, newRaceDB(t, dsn))
		})
	}
}

func TestPolicyInsertsReportGeneratedValues(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)
		policy := &store.MemoWritePolicy{ActorUserID: user.ID, CreatingShare: true}

		share, err := db.CreateMemoShare(db.ctx, &store.MemoShare{UID: "s1", MemoID: memo.ID, CreatorID: user.ID, Policy: policy})
		require.NoError(t, err)
		require.NotZero(t, share.ID)
		require.NotZero(t, share.CreatedTs)

		attachment, err := db.CreateAttachment(db.ctx, &store.Attachment{UID: "a1", CreatorID: user.ID, MemoID: &memo.ID, Policy: &store.MemoWritePolicy{ActorUserID: user.ID}})
		require.NoError(t, err)
		require.NotZero(t, attachment.ID)
		require.NotZero(t, attachment.CreatedTs)
		require.NotZero(t, attachment.UpdatedTs)
	})
}

func TestShareCreateAbortsWhenMemoJoinsSpaceAudience(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		space, err := db.other.CreateSpace(db.ctx, &store.Space{UID: "space", Title: "Space"}, user.ID)
		require.NoError(t, err)
		memo := db.memo(t, "m1", user)

		// The memo is moved to the SPACE audience after the share was
		// validated against a private memo; the insert must not land.
		db.interpose(t, "INSERT INTO memo_share", func() {
			visibility := store.SpaceAudience
			require.NoError(t, db.other.UpdateMemo(db.ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &visibility, SpaceID: &space.ID}))
		})
		_, err = db.CreateMemoShare(db.ctx, &store.MemoShare{UID: "s1", MemoID: memo.ID, CreatorID: user.ID, Policy: &store.MemoWritePolicy{ActorUserID: user.ID, CreatingShare: true}})
		require.ErrorIs(t, err, store.ErrMemoMutationConflict)
		require.Equal(t, 0, db.count(t, "SELECT COUNT(*) FROM memo_share"))
	})
}

func TestUpdateMemoAbortsWhenMemoChanges(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)

		db.interpose(t, "UPDATE memo SET", func() { db.archive(t, memo) })
		content := "edited"
		err := db.UpdateMemo(db.ctx, &store.UpdateMemo{ID: memo.ID, Content: &content, Policy: &store.MemoWritePolicy{ActorUserID: user.ID}})
		require.ErrorIs(t, err, store.ErrMemoMutationConflict)
		require.Equal(t, "original", db.memoContent(t, memo))
	})
}

func TestMemoMutationAbortsWhenMemoChanges(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)

		db.interpose(t, "UPDATE memo SET", func() { db.archive(t, memo) })
		content := "edited"
		err := db.ApplyMemoMutation(db.ctx, &store.MemoMutation{
			MemoID:              memo.ID,
			MemoCreatorID:       user.ID,
			ExpectedMemoContent: "original",
			MemoUpdate:          &store.UpdateMemo{ID: memo.ID, Content: &content},
			Policy:              &store.MemoWritePolicy{ActorUserID: user.ID},
		})
		require.ErrorIs(t, err, store.ErrMemoMutationConflict)
		require.Equal(t, "original", db.memoContent(t, memo))
	})
}

func TestAttachmentCreateAbortsWhenMemoChanges(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)

		db.interpose(t, "INSERT INTO attachment", func() { db.archive(t, memo) })
		_, err := db.CreateAttachment(db.ctx, &store.Attachment{UID: "a1", CreatorID: user.ID, MemoID: &memo.ID, Policy: &store.MemoWritePolicy{ActorUserID: user.ID}})
		require.ErrorIs(t, err, store.ErrMemoMutationConflict)
		require.Equal(t, 0, db.count(t, "SELECT COUNT(*) FROM attachment"))
	})
}

func TestAttachmentUpdateAbortsWhenBindingChanges(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)
		attachment := db.attachment(t, "a1", user, memo)

		// The attachment is unbound from the memo the actor was authorized
		// against before the update commits.
		db.interpose(t, "UPDATE attachment SET", func() {
			_, err := db.other.GetDB().ExecContext(db.ctx, "UPDATE attachment SET memo_id = NULL WHERE id = ?", attachment.ID)
			require.NoError(t, err)
		})
		filename := "renamed.png"
		err := db.UpdateAttachment(db.ctx, &store.UpdateAttachment{ID: attachment.ID, Filename: &filename, Policy: &store.MemoWritePolicy{ActorUserID: user.ID}})
		require.ErrorIs(t, err, store.ErrMemoPermissionDenied)
		require.Equal(t, 0, db.count(t, "SELECT COUNT(*) FROM attachment WHERE filename = ?", filename))
	})
}

func TestAttachmentDeleteAbortsWhenMemoContentChanges(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)
		attachment := db.attachment(t, "a1", user, memo)

		db.interpose(t, "DELETE FROM attachment", func() {
			content := "edited"
			require.NoError(t, db.other.UpdateMemo(db.ctx, &store.UpdateMemo{ID: memo.ID, Content: &content}))
		})
		policy := &store.AttachmentDeletionPolicy{ActorUserID: user.ID, ExpectedMemoContents: map[int32]string{memo.ID: "original"}}
		err := db.DeleteAttachmentsWithPolicy(db.ctx, policy, []int32{attachment.ID})
		require.ErrorIs(t, err, store.ErrMemoMutationConflict)
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM attachment WHERE id = ?", attachment.ID))
	})
}

func TestMemoDeleteAbortsWhenAttachmentSetIsSwapped(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		memo := db.memo(t, "m1", user)
		attachment := db.attachment(t, "a1", user, memo)

		// One attachment is replaced by another: the count the deletion read
		// still matches, the set does not.
		db.interpose(t, "DELETE FROM memo WHERE", func() {
			require.NoError(t, db.other.DeleteAttachment(db.ctx, &store.DeleteAttachment{ID: attachment.ID}))
			db.attachment(t, "a2", user, memo)
		})
		_, err := db.DeleteMemoWithPolicy(db.ctx, &store.DeleteMemoWithPolicy{MemoID: memo.ID, ActorUserID: user.ID})
		require.ErrorIs(t, err, store.ErrMemoMutationConflict)
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM memo WHERE id = ?", memo.ID))
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM attachment WHERE memo_id = ? AND uid = 'a2'", memo.ID))
	})
}

func TestUserDeleteAbortsWhenMemoSetIsSwapped(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "bob")
		memo := db.memo(t, "m1", user)

		db.interpose(t, "DELETE FROM user WHERE", func() {
			require.NoError(t, db.other.DeleteMemo(db.ctx, &store.DeleteMemo{ID: memo.ID}))
			db.memo(t, "m2", user)
		})
		_, err := db.DeleteUser(db.ctx, &store.DeleteUser{ID: user.ID})
		require.ErrorIs(t, err, errUserDeleteConflict)
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM user WHERE id = ?", user.ID))
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM memo WHERE creator_id = ?", user.ID))
	})
}

func TestSpaceDeleteAbortsWhenMemoSetIsSwapped(t *testing.T) {
	forEachAccessMode(t, func(t *testing.T, db *raceDB) {
		user := db.user(t, "alice")
		space, err := db.other.CreateSpace(db.ctx, &store.Space{UID: "space", Title: "Space"}, user.ID)
		require.NoError(t, err)
		visibility := store.SpaceAudience
		memo, err := db.other.CreateMemo(db.ctx, &store.Memo{UID: "m1", CreatorID: user.ID, Content: "original", Visibility: visibility, SpaceID: &space.ID})
		require.NoError(t, err)

		db.interpose(t, "DELETE FROM space WHERE", func() {
			require.NoError(t, db.other.DeleteMemo(db.ctx, &store.DeleteMemo{ID: memo.ID}))
			_, err := db.other.CreateMemo(db.ctx, &store.Memo{UID: "m2", CreatorID: user.ID, Content: "later", Visibility: visibility, SpaceID: &space.ID})
			require.NoError(t, err)
		})
		_, err = db.DeleteSpace(db.ctx, &store.DeleteSpace{ID: space.ID, ActorUserID: user.ID})
		require.ErrorIs(t, err, errSpaceDeleteConflict)
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM space WHERE id = ?", space.ID))
		require.Equal(t, 1, db.count(t, "SELECT COUNT(*) FROM memo WHERE space_id = ?", space.ID))
	})
}

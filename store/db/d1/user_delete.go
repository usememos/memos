package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// errUserDeleteConflict reports that the user's memos or attachments changed
// between the validation reads and the batch. The caller can simply retry.
var errUserDeleteConflict = errors.New("user contents changed during deletion")

// userDeleteTargets holds the rows read before the delete batch: the memos
// and attachments to remove, and the setting keys reported to the caller.
type userDeleteTargets struct {
	memoIDs     []int32
	attachments []*store.Attachment
	settingKeys []storepb.UserSetting_Key
}

// userRequireNoMembership fails with ErrUserHasSpaceMembership while the user
// still holds a membership that is not a pending invitation.
func userRequireNoMembership(ctx context.Context, q querier, userID int32) error {
	var count int
	if err := q.QueryRowContext(ctx, "SELECT COUNT(*) FROM space_member WHERE user_id = ? AND status <> 'INVITED'", userID).Scan(&count); err != nil {
		return errors.Wrap(err, "failed to check user space memberships")
	}
	if count != 0 {
		return store.ErrUserHasSpaceMembership
	}
	return nil
}

func userCollectDeleteTargets(ctx context.Context, q querier, userID int32) (*userDeleteTargets, error) {
	targets := &userDeleteTargets{}
	memoIDs, err := listMemoIDs(ctx, q, "SELECT id FROM memo WHERE creator_id = ? ORDER BY id", userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list user memos")
	}
	targets.memoIDs = memoIDs

	// Attachments owned by the user and attachments bound to the user's memos
	// overlap; seen keeps each once.
	seen := make(map[int32]struct{})
	targets.attachments = make([]*store.Attachment, 0)
	if err := scanAttachmentSnapshots(ctx, q, "SELECT "+attachmentSnapshotColumns+" FROM attachment WHERE creator_id = ? ORDER BY id", []any{userID}, seen, &targets.attachments); err != nil {
		return nil, errors.Wrap(err, "failed to list user attachments")
	}
	for _, ids := range chunk(memoIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		if err := scanAttachmentSnapshots(ctx, q, "SELECT "+attachmentSnapshotColumns+" FROM attachment WHERE memo_id IN "+clause+" ORDER BY id", args, seen, &targets.attachments); err != nil {
			return nil, errors.Wrap(err, "failed to list user memo attachments")
		}
	}

	keys, err := userListSettingKeys(ctx, q, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list user setting keys")
	}
	targets.settingKeys = keys
	return targets, nil
}

func userListSettingKeys(ctx context.Context, q querier, userID int32) ([]storepb.UserSetting_Key, error) {
	rows, err := q.QueryContext(ctx, "SELECT key FROM user_setting WHERE user_id = ?", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := make([]storepb.UserSetting_Key, 0)
	for rows.Next() {
		var keyString string
		if err := rows.Scan(&keyString); err != nil {
			return nil, err
		}
		keys = append(keys, storepb.UserSetting_Key(storepb.UserSetting_Key_value[keyString]))
	}
	return keys, rows.Err()
}

// DeleteUser removes a user together with the memos, attachments, reactions, shares, inbox messages, identities, and settings they own.
func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) (*store.DeleteUserResult, error) {
	var userID int32
	err := d.db.QueryRowContext(ctx, "SELECT id FROM user WHERE id = ?", delete.ID).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return &store.DeleteUserResult{}, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to read user")
	}
	validate := func() error { return userRequireNoMembership(ctx, d.db, delete.ID) }
	if err := validate(); err != nil {
		return nil, err
	}
	targets, err := userCollectDeleteTargets(ctx, d.db, delete.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect delete user targets")
	}
	if store.GetDeleteUserFailpoint(ctx) == store.DeleteUserFailpointBeforeCommit {
		return nil, errors.New("delete user failpoint before commit")
	}

	b := newBatch()
	b.guard("NOT EXISTS (SELECT 1 FROM space_member WHERE user_id = ? AND status <> 'INVITED')", delete.ID)
	// The memo and attachment sets were read outside the batch; abort when
	// they changed so nothing authored by the user survives its deletion.
	b.guardIDSet("memo WHERE creator_id = ?", []any{delete.ID}, targets.memoIDs)
	b.guardIDSet("attachment WHERE creator_id = ? OR memo_id IN (SELECT id FROM memo WHERE creator_id = ?)", []any{delete.ID, delete.ID}, attachmentIDs(targets.attachments))
	b.add("DELETE FROM space_member WHERE user_id = ? AND status = 'INVITED'", delete.ID)
	addMemoSetDeletes(b, targets.memoIDs, attachmentIDs(targets.attachments))
	b.add("DELETE FROM reaction WHERE creator_id = ?", delete.ID)
	b.add("DELETE FROM memo_share WHERE creator_id = ?", delete.ID)
	// Inbox rows are removed by their participant columns directly; there is
	// no reason to pre-read ids the caller never sees.
	b.add("DELETE FROM inbox WHERE sender_id = ? OR receiver_id = ?", delete.ID, delete.ID)
	b.add("DELETE FROM user_identity WHERE user_id = ?", delete.ID)
	b.add("DELETE FROM user_setting WHERE user_id = ?", delete.ID)
	b.add("DELETE FROM user WHERE id = ?", delete.ID)
	if _, err := b.commit(ctx, d); err != nil {
		if isGuardFailure(err) {
			return nil, spaceRecheck(validate, errUserDeleteConflict)
		}
		return nil, errors.Wrap(err, "failed to delete user")
	}
	return &store.DeleteUserResult{
		Attachments:     targets.attachments,
		UserSettingKeys: targets.settingKeys,
	}, nil
}

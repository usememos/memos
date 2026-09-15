package d1

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

const shareColumns = "id, uid, memo_id, creator_id, created_ts, expires_ts"

// CreateMemoShare inserts a share grant, checking the memo write policy when one is set.
func (d *DB) CreateMemoShare(ctx context.Context, create *store.MemoShare) (*store.MemoShare, error) {
	columns, values, args := []string{"uid", "memo_id", "creator_id"}, []string{"?", "?", "?"}, []any{create.UID, create.MemoID, create.CreatorID}
	if create.ExpiresTs != nil {
		columns, values, args = append(columns, "expires_ts"), append(values, "?"), append(args, *create.ExpiresTs)
	}
	if create.Policy == nil {
		stmt := "INSERT INTO memo_share (" + strings.Join(columns, ", ") + ") VALUES (" + strings.Join(values, ", ") + ") RETURNING id, created_ts"
		if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs); err != nil {
			return nil, err
		}
		return create, nil
	}
	if err := validateMemoWritePolicy(ctx, d.db, create.MemoID, create.Policy, nil); err != nil {
		return nil, err
	}
	// The validated memo and actor are re-asserted by the insert itself:
	// selecting from the memo row and requiring the actor to still be active
	// makes a stale validation yield no row instead of a share.
	args = append(args, create.MemoID, create.Policy.ActorUserID)
	stmt := "INSERT INTO memo_share (" + strings.Join(columns, ", ") + ") SELECT " + strings.Join(values, ", ") +
		" FROM memo WHERE memo.id = ? AND " + activeUserCondition + " RETURNING id, created_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoMutationConflict
		}
		return nil, err
	}
	return create, nil
}

// shareFindWhere renders the filter clauses of a share lookup.
func shareFindWhere(find *store.FindMemoShare) ([]string, []any) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "uid = ?"), append(args, *find.UID)
	}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, *find.MemoID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = ?"), append(args, *find.CreatorID)
	}
	return where, args
}

// shareScanner is satisfied by *sql.Row and *sql.Rows.
type shareScanner interface {
	Scan(dest ...any) error
}

// shareScan reads one row selected with shareColumns.
func shareScan(scanner shareScanner) (*store.MemoShare, error) {
	share := &store.MemoShare{}
	if err := scanner.Scan(
		&share.ID,
		&share.UID,
		&share.MemoID,
		&share.CreatorID,
		&share.CreatedTs,
		&share.ExpiresTs,
	); err != nil {
		return nil, err
	}
	return share, nil
}

// ListMemoShares returns the share grants matching find.
func (d *DB) ListMemoShares(ctx context.Context, find *store.FindMemoShare) ([]*store.MemoShare, error) {
	where, args := shareFindWhere(find)
	rows, err := d.db.QueryContext(ctx, "SELECT "+shareColumns+" FROM memo_share WHERE "+strings.Join(where, " AND ")+" ORDER BY id ASC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.MemoShare{}
	for rows.Next() {
		share, err := shareScan(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, share)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// GetMemoShare returns the first share grant matching find, or nil.
func (d *DB) GetMemoShare(ctx context.Context, find *store.FindMemoShare) (*store.MemoShare, error) {
	where, args := shareFindWhere(find)
	share, err := shareScan(d.db.QueryRowContext(ctx, "SELECT "+shareColumns+" FROM memo_share WHERE "+strings.Join(where, " AND ")+" LIMIT 1", args...))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return share, nil
}

// DeleteMemoShare removes share grants, requiring exactly one revoked row when a policy is set.
func (d *DB) DeleteMemoShare(ctx context.Context, delete *store.DeleteMemoShare) error {
	where, args := []string{"1 = 1"}, []any{}
	if delete.ID != nil {
		where, args = append(where, "id = ?"), append(args, *delete.ID)
	}
	if delete.UID != nil {
		where, args = append(where, "uid = ?"), append(args, *delete.UID)
	}
	if delete.Policy == nil {
		_, err := d.execOne(ctx, "DELETE FROM memo_share WHERE "+strings.Join(where, " AND "), args...)
		return err
	}
	if err := validateMemoWritePolicy(ctx, d.db, *delete.MemoID, delete.Policy, nil); err != nil {
		return err
	}
	// One conditional statement: the share must still belong to the validated
	// memo, and exactly one row must go, or the revocation is reported as a
	// conflict.
	where, args = append(where, "memo_id = ?"), append(args, *delete.MemoID)
	result, err := d.execOne(ctx, "DELETE FROM memo_share WHERE "+strings.Join(where, " AND "), args...)
	if err != nil {
		return err
	}
	if result.Changes != 1 {
		return store.ErrMemoMutationConflict
	}
	return nil
}

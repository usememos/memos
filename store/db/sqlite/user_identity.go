package sqlite

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUserIdentity(ctx context.Context, create *store.UserIdentity) (*store.UserIdentity, error) {
	stmt := "INSERT INTO `user_identity` (`user_id`, `provider`, `extern_uid`) VALUES (?, ?, ?) RETURNING `id`, `created_ts`, `updated_ts`"
	if err := d.db.QueryRowContext(ctx, stmt, create.UserID, create.Provider, create.ExternUID).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListUserIdentities(ctx context.Context, find *store.FindUserIdentity) ([]*store.UserIdentity, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.UserID != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *find.UserID)
	}
	if find.Provider != nil {
		where, args = append(where, "`provider` = ?"), append(args, *find.Provider)
	}
	if find.ExternUID != nil {
		where, args = append(where, "`extern_uid` = ?"), append(args, *find.ExternUID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			user_id,
			provider,
			extern_uid,
			created_ts,
			updated_ts
		FROM user_identity
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY id ASC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.UserIdentity{}
	for rows.Next() {
		ui := &store.UserIdentity{}
		if err := rows.Scan(
			&ui.ID,
			&ui.UserID,
			&ui.Provider,
			&ui.ExternUID,
			&ui.CreatedTs,
			&ui.UpdatedTs,
		); err != nil {
			return nil, err
		}
		list = append(list, ui)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) DeleteUserIdentities(ctx context.Context, delete *store.DeleteUserIdentity) error {
	where, args := []string{"1 = 1"}, []any{}

	if delete.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *delete.ID)
	}
	if delete.UserID != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *delete.UserID)
	}
	if delete.Provider != nil {
		where, args = append(where, "`provider` = ?"), append(args, *delete.Provider)
	}

	if _, err := d.db.ExecContext(ctx, "DELETE FROM `user_identity` WHERE "+strings.Join(where, " AND "), args...); err != nil {
		return err
	}
	return nil
}

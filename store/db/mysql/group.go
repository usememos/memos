package mysql

import (
	"context"
	"strings"

	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateGroup(ctx context.Context, create *store.Group) (*store.Group, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	stmt := `
		INSERT INTO groups (
			name,
			description,
			creator_id,
			visibility
		)
		VALUES (?, ?, ?, ?)
	`
	result, err := tx.ExecContext(
		ctx,
		stmt,
		create.Name,
		create.Description,
		create.CreatorID,
		create.Visibility,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to insert group")
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get last insert id")
	}
	create.ID = int32(rawID)

	memberStmt := `
		INSERT INTO group_members (
			group_id,
			user_id,
			role
		)
		VALUES (?, ?, 'OWNER')
	`
	if _, err := tx.ExecContext(ctx, memberStmt, create.ID, create.CreatorID); err != nil {
		return nil, errors.Wrap(err, "failed to insert owner member")
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit transaction")
	}

	group, err := d.GetGroup(ctx, &store.FindGroup{ID: &create.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get group")
	}
	return group, nil
}

func (d *DB) ListGroups(ctx context.Context, find *store.FindGroup) ([]*store.Group, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}
	if find.Name != nil {
		where, args = append(where, "name = ?"), append(args, *find.Name)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = ?"), append(args, *find.CreatorID)
	}

	query := "SELECT id, name, description, creator_id, visibility, UNIX_TIMESTAMP(created_ts) FROM groups WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query groups")
	}
	defer rows.Close()

	var list []*store.Group
	for rows.Next() {
		var group store.Group
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&group.Description,
			&group.CreatorID,
			&group.Visibility,
			&group.CreatedTs,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan group")
		}
		list = append(list, &group)
	}

	return list, nil
}

func (d *DB) UpdateGroup(ctx context.Context, update *store.UpdateGroup) (*store.Group, error) {
	set, args := []string{}, []any{}
	if update.Name != nil {
		set, args = append(set, "name = ?"), append(args, *update.Name)
	}
	if update.Description != nil {
		set, args = append(set, "description = ?"), append(args, *update.Description)
	}
	if update.Visibility != nil {
		set, args = append(set, "visibility = ?"), append(args, *update.Visibility)
	}

	if len(set) == 0 {
		return d.GetGroup(ctx, &store.FindGroup{ID: &update.ID})
	}

	args = append(args, update.ID)
	query := "UPDATE groups SET " + strings.Join(set, ", ") + " WHERE id = ?"
	if _, err := d.db.ExecContext(ctx, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to execute update group query")
	}

	return d.GetGroup(ctx, &store.FindGroup{ID: &update.ID})
}

func (d *DB) DeleteGroup(ctx context.Context, id int32) error {
	if _, err := d.db.ExecContext(ctx, "UPDATE memo SET group_id = NULL WHERE group_id = ?", id); err != nil {
		return errors.Wrap(err, "failed to unset group_id in memo")
	}
	if _, err := d.db.ExecContext(ctx, "DELETE FROM group_members WHERE group_id = ?", id); err != nil {
		return errors.Wrap(err, "failed to delete group members")
	}
	if _, err := d.db.ExecContext(ctx, "DELETE FROM groups WHERE id = ?", id); err != nil {
		return errors.Wrap(err, "failed to delete group")
	}
	return nil
}

func (d *DB) GetGroup(ctx context.Context, find *store.FindGroup) (*store.Group, error) {
	list, err := d.ListGroups(ctx, find)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list groups in GetGroup")
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) CreateGroupMember(ctx context.Context, create *store.GroupMember) (*store.GroupMember, error) {
	stmt := `
		INSERT INTO group_members (
			group_id,
			user_id,
			role
		)
		VALUES (?, ?, ?)
	`
	if _, err := d.db.ExecContext(ctx, stmt, create.GroupID, create.UserID, create.Role); err != nil {
		return nil, errors.Wrap(err, "failed to insert group member")
	}
	return create, nil
}

func (d *DB) ListGroupMembers(ctx context.Context, find *store.FindGroupMember) ([]*store.GroupMember, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.GroupID != nil {
		where, args = append(where, "group_id = ?"), append(args, *find.GroupID)
	}
	if find.UserID != nil {
		where, args = append(where, "user_id = ?"), append(args, *find.UserID)
	}

	query := "SELECT group_id, user_id, role FROM group_members WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query group members")
	}
	defer rows.Close()

	var list []*store.GroupMember
	for rows.Next() {
		var member store.GroupMember
		if err := rows.Scan(
			&member.GroupID,
			&member.UserID,
			&member.Role,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan group member")
		}
		list = append(list, &member)
	}

	return list, nil
}

func (d *DB) UpdateGroupMember(ctx context.Context, update *store.GroupMember) (*store.GroupMember, error) {
	query := "UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?"
	if _, err := d.db.ExecContext(ctx, query, update.Role, update.GroupID, update.UserID); err != nil {
		return nil, errors.Wrap(err, "failed to update group member")
	}
	return update, nil
}

func (d *DB) DeleteGroupMember(ctx context.Context, delete *store.GroupMember) error {
	if delete.GroupID == 0 || delete.UserID == 0 {
		return errors.New("missing group_id or user_id")
	}
	query := "DELETE FROM group_members WHERE group_id = ? AND user_id = ?"
	if _, err := d.db.ExecContext(ctx, query, delete.GroupID, delete.UserID); err != nil {
		return errors.Wrap(err, "failed to delete group member")
	}
	return nil
}

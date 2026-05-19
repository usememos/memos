package postgres

import (
	"context"
	"strings"

	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateGroup(ctx context.Context, create *store.Group) (*store.Group, error) {
	fields := []string{"name", "description", "creator_id", "visibility"}
	args := []any{create.Name, create.Description, create.CreatorID, create.Visibility}
	stmt := "INSERT INTO groups (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListGroups(ctx context.Context, find *store.FindGroup) ([]*store.Group, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.Name != nil {
		where, args = append(where, "name = "+placeholder(len(args)+1)), append(args, *find.Name)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = "+placeholder(len(args)+1)), append(args, *find.CreatorID)
	}

	query := "SELECT id, name, description, creator_id, visibility, created_ts FROM groups WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		list = append(list, &group)
	}

	return list, nil
}

func (d *DB) UpdateGroup(ctx context.Context, update *store.UpdateGroup) (*store.Group, error) {
	set, args := []string{}, []any{}
	if update.Name != nil {
		set, args = append(set, "name = "+placeholder(len(args)+1)), append(args, *update.Name)
	}
	if update.Description != nil {
		set, args = append(set, "description = "+placeholder(len(args)+1)), append(args, *update.Description)
	}
	if update.Visibility != nil {
		set, args = append(set, "visibility = "+placeholder(len(args)+1)), append(args, *update.Visibility)
	}

	if len(set) == 0 {
		return d.GetGroup(ctx, &store.FindGroup{ID: &update.ID})
	}

	stmt := "UPDATE groups SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args)+1)
	args = append(args, update.ID)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return nil, err
	}

	return d.GetGroup(ctx, &store.FindGroup{ID: &update.ID})
}

func (d *DB) DeleteGroup(ctx context.Context, id int32) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM group_members WHERE group_id = "+placeholder(1), id); err != nil {
		return err
	}
	if _, err := d.db.ExecContext(ctx, "DELETE FROM groups WHERE id = "+placeholder(1), id); err != nil {
		return err
	}
	return nil
}

func (d *DB) GetGroup(ctx context.Context, find *store.FindGroup) (*store.Group, error) {
	list, err := d.ListGroups(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) CreateGroupMember(ctx context.Context, create *store.GroupMember) (*store.GroupMember, error) {
	fields := []string{"group_id", "user_id", "role"}
	args := []any{create.GroupID, create.UserID, create.Role}
	stmt := "INSERT INTO group_members (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ")"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListGroupMembers(ctx context.Context, find *store.FindGroupMember) ([]*store.GroupMember, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.GroupID != nil {
		where, args = append(where, "group_id = "+placeholder(len(args)+1)), append(args, *find.GroupID)
	}
	if find.UserID != nil {
		where, args = append(where, "user_id = "+placeholder(len(args)+1)), append(args, *find.UserID)
	}

	query := "SELECT group_id, user_id, role FROM group_members WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		list = append(list, &member)
	}

	return list, nil
}

func (d *DB) UpdateGroupMember(ctx context.Context, update *store.GroupMember) (*store.GroupMember, error) {
	query := "UPDATE group_members SET role = " + placeholder(1) + " WHERE group_id = " + placeholder(2) + " AND user_id = " + placeholder(3)
	if _, err := d.db.ExecContext(ctx, query, update.Role, update.GroupID, update.UserID); err != nil {
		return nil, err
	}
	return update, nil
}

func (d *DB) DeleteGroupMember(ctx context.Context, delete *store.GroupMember) error {
	if delete.GroupID == 0 || delete.UserID == 0 {
		return errors.New("missing group_id or user_id")
	}
	query := "DELETE FROM group_members WHERE group_id = " + placeholder(1) + " AND user_id = " + placeholder(2)
	if _, err := d.db.ExecContext(ctx, query, delete.GroupID, delete.UserID); err != nil {
		return err
	}
	return nil
}

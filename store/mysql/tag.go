package mysql

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *Driver) UpsertTag(ctx context.Context, upsert *store.Tag) (*store.Tag, error) {
	stmt := `
		INSERT INTO tag (name, creator_id)
		VALUES (?, ?)
		ON DUPLICATE KEY UPDATE name = ?
	`
	if _, err := d.db.ExecContext(ctx, stmt, upsert.Name, upsert.CreatorID, upsert.Name); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *Driver) ListTags(ctx context.Context, find *store.FindTag) ([]*store.Tag, error) {
	where, args := []string{"creator_id = ?"}, []any{find.CreatorID}
	query := `
		SELECT
			name,
			creator_id
		FROM tag
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY name ASC
	`
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Tag{}
	for rows.Next() {
		tag := &store.Tag{}
		if err := rows.Scan(
			&tag.Name,
			&tag.CreatorID,
		); err != nil {
			return nil, err
		}

		list = append(list, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *Driver) DeleteTag(ctx context.Context, delete *store.DeleteTag) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

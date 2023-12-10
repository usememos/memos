package postgres

import (
	"context"

	"github.com/Masterminds/squirrel"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertSystemSetting(ctx context.Context, upsert *store.SystemSetting) (*store.SystemSetting, error) {
	qb := squirrel.Insert("system_setting").
		Columns("name", "value", "description").
		Values(upsert.Name, upsert.Value, upsert.Description).
		Suffix("ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description").
		PlaceholderFormat(squirrel.Dollar)

	query, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *DB) ListSystemSettings(ctx context.Context, find *store.FindSystemSetting) ([]*store.SystemSetting, error) {
	qb := squirrel.Select("name", "value", "description").From("system_setting")

	if find.Name != "" {
		qb = qb.Where(squirrel.Eq{"name": find.Name})
	}

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.SystemSetting{}
	for rows.Next() {
		systemSetting := &store.SystemSetting{}
		if err := rows.Scan(&systemSetting.Name, &systemSetting.Value, &systemSetting.Description); err != nil {
			return nil, err
		}
		list = append(list, systemSetting)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

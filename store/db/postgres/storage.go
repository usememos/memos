package postgres

import (
	"context"

	"github.com/Masterminds/squirrel"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateStorage(ctx context.Context, create *store.Storage) (*store.Storage, error) {
	qb := squirrel.Insert("storage").Columns("name", "type", "config")
	values := []any{create.Name, create.Type, create.Config}

	if create.ID != 0 {
		qb = qb.Columns("id")
		values = append(values, create.ID)
	}

	qb = qb.Values(values...).Suffix("RETURNING id")
	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	err = d.db.QueryRowContext(ctx, query, args...).Scan(&create.ID)
	if err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListStorages(ctx context.Context, find *store.FindStorage) ([]*store.Storage, error) {
	qb := squirrel.Select("id", "name", "type", "config").From("storage").OrderBy("id DESC")

	if find.ID != nil {
		qb = qb.Where(squirrel.Eq{"id": *find.ID})
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

	list := []*store.Storage{}
	for rows.Next() {
		storage := &store.Storage{}
		if err := rows.Scan(&storage.ID, &storage.Name, &storage.Type, &storage.Config); err != nil {
			return nil, err
		}
		list = append(list, storage)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) UpdateStorage(ctx context.Context, update *store.UpdateStorage) (*store.Storage, error) {
	qb := squirrel.Update("storage")

	if update.Name != nil {
		qb = qb.Set("name", *update.Name)
	}
	if update.Config != nil {
		qb = qb.Set("config", *update.Config)
	}

	qb = qb.Where(squirrel.Eq{"id": update.ID})

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	storage := &store.Storage{}
	query, args, err = squirrel.Select("id", "name", "type", "config").
		From("storage").
		Where(squirrel.Eq{"id": update.ID}).
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return nil, err
	}

	if err := d.db.QueryRowContext(ctx, query, args...).Scan(&storage.ID, &storage.Name, &storage.Type, &storage.Config); err != nil {
		return nil, err
	}

	return storage, nil
}

func (d *DB) DeleteStorage(ctx context.Context, delete *store.DeleteStorage) error {
	qb := squirrel.Delete("storage").Where(squirrel.Eq{"id": delete.ID})

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	result, err := d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	return nil
}

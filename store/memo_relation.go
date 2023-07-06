package store

import (
	"context"
	"database/sql"
	"strings"
)

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
)

type MemoRelation struct {
	MemoID        int
	RelatedMemoID int
	Type          MemoRelationType
}

type FindMemoRelation struct {
	MemoID        *int
	RelatedMemoID *int
	Type          *MemoRelationType
}

type DeleteMemoRelation struct {
	MemoID        *int
	RelatedMemoID *int
	Type          *MemoRelationType
}

func (s *Store) UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO memo_relation (
			memo_id,
			related_memo_id,
			type
		)
		VALUES (?, ?, ?)
		ON CONFLICT (memo_id, related_memo_id, type) DO UPDATE SET
			type = EXCLUDED.type
		RETURNING memo_id, related_memo_id, type
	`
	memoRelation := &MemoRelation{}
	if err := tx.QueryRowContext(
		ctx,
		query,
		create.MemoID,
		create.RelatedMemoID,
		create.Type,
	).Scan(
		&memoRelation.MemoID,
		&memoRelation.RelatedMemoID,
		&memoRelation.Type,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return memoRelation, nil
}

func (s *Store) ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listMemoRelations(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetMemoRelation(ctx context.Context, find *FindMemoRelation) (*MemoRelation, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listMemoRelations(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return list[0], nil
}

func (s *Store) DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	where, args := []string{"TRUE"}, []any{}
	if delete.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, delete.MemoID)
	}
	if delete.RelatedMemoID != nil {
		where, args = append(where, "related_memo_id = ?"), append(args, delete.RelatedMemoID)
	}
	if delete.Type != nil {
		where, args = append(where, "type = ?"), append(args, delete.Type)
	}

	query := `
		DELETE FROM memo_relation
		WHERE ` + strings.Join(where, " AND ")
	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		// Prevent lint warning.
		return err
	}
	return nil
}

func listMemoRelations(ctx context.Context, tx *sql.Tx, find *FindMemoRelation) ([]*MemoRelation, error) {
	where, args := []string{"TRUE"}, []any{}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, find.MemoID)
	}
	if find.RelatedMemoID != nil {
		where, args = append(where, "related_memo_id = ?"), append(args, find.RelatedMemoID)
	}
	if find.Type != nil {
		where, args = append(where, "type = ?"), append(args, find.Type)
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT
			memo_id,
			related_memo_id,
			type
		FROM memo_relation
		WHERE `+strings.Join(where, " AND "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memoRelationMessages := []*MemoRelation{}
	for rows.Next() {
		memoRelationMessage := &MemoRelation{}
		if err := rows.Scan(
			&memoRelationMessage.MemoID,
			&memoRelationMessage.RelatedMemoID,
			&memoRelationMessage.Type,
		); err != nil {
			return nil, err
		}
		memoRelationMessages = append(memoRelationMessages, memoRelationMessage)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return memoRelationMessages, nil
}

func vacuumMemoRelations(ctx context.Context, tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM memo_relation
		WHERE memo_id NOT IN (SELECT id FROM memo) OR related_memo_id NOT IN (SELECT id FROM memo)
	`); err != nil {
		return err
	}
	return nil
}

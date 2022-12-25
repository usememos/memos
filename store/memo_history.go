package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// memoHistoryRaw is the store model for a MemoHistory.
// Fields have exactly the same meanings as MemoHistory.
type memoHistoryRaw struct {
	ID int

	MemoID    int
	CreatedTs int64

	// Domain specific fields
	Content string
}

func (raw *memoHistoryRaw) toMemoHistory() *api.MemoHistory {
	return &api.MemoHistory{
		ID: raw.ID,

		MemoID:    raw.MemoID,
		CreatedTs: raw.CreatedTs,

		Content: raw.Content,
	}
}

func (s *Store) CreateMemoHistory(ctx context.Context, create *api.MemoHistoryCreate) (*api.MemoHistory, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoHistoryRaw, err := createMemoHistory(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	shortcut := memoHistoryRaw.toMemoHistory()

	return shortcut, nil
}

func (s *Store) FindMemoHistoryList(ctx context.Context, find *api.MemoHistoryFind) ([]*api.MemoHistory, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoHistoryRawList, err := findMemoHistoryList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.MemoHistory{}
	for _, raw := range memoHistoryRawList {
		list = append(list, raw.toMemoHistory())
	}

	return list, nil
}

func (s *Store) FindMemoHistory(ctx context.Context, find *api.MemoHistoryFind) (*api.MemoHistory, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findMemoHistoryList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	memoHistoryRaw := list[0]

	shortcut := memoHistoryRaw.toMemoHistory()

	return shortcut, nil
}

func createMemoHistory(ctx context.Context, tx *sql.Tx, create *api.MemoHistoryCreate) (*memoHistoryRaw, error) {
	query := `
		INSERT INTO memo_history (
			memo_id, 
			content
		)
		VALUES (?, ?)
		RETURNING id, memo_id, content, created_ts
	`
	var memoHistoryRaw memoHistoryRaw
	if err := tx.QueryRowContext(ctx, query, create.MemoID, create.Content).Scan(
		&memoHistoryRaw.ID,
		&memoHistoryRaw.MemoID,
		&memoHistoryRaw.Content,
		&memoHistoryRaw.CreatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoHistoryRaw, nil
}

func findMemoHistoryList(ctx context.Context, tx *sql.Tx, find *api.MemoHistoryFind) ([]*memoHistoryRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "memo_id = ?"), append(args, *v)
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT
			id,
			memo_id,
			content,
			created_ts,
		FROM memo_history
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY created_ts DESC`,
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	memoHistoryRawList := make([]*memoHistoryRaw, 0)
	for rows.Next() {
		var memoHistoryRaw memoHistoryRaw
		if err := rows.Scan(
			&memoHistoryRaw.ID,
			&memoHistoryRaw.MemoID,
			&memoHistoryRaw.Content,
			&memoHistoryRaw.CreatedTs,
		); err != nil {
			return nil, FormatError(err)
		}

		memoHistoryRawList = append(memoHistoryRawList, &memoHistoryRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return memoHistoryRawList, nil
}

func vacuumMemoHistory(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		memo_history 
	WHERE 
		memo_id NOT IN (
			SELECT 
				id 
			FROM 
				memo
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// memoRaw is the store model for an Memo.
// Fields have exactly the same meanings as Memo.
type memoRaw struct {
	ID int

	// Standard fields
	RowStatus api.RowStatus
	CreatorID int
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility api.Visibility
	Pinned     bool
}

// toMemo creates an instance of Memo based on the memoRaw.
// This is intended to be called when we need to compose an Memo relationship.
func (raw *memoRaw) toMemo() *api.Memo {
	return &api.Memo{
		ID: raw.ID,

		// Standard fields
		RowStatus: raw.RowStatus,
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		// Domain specific fields
		Content:    raw.Content,
		Visibility: raw.Visibility,
		DisplayTs:  raw.CreatedTs,
		Pinned:     raw.Pinned,
	}
}

func (s *Store) ComposeMemo(ctx context.Context, memo *api.Memo) (*api.Memo, error) {
	if err := s.ComposeMemoCreator(ctx, memo); err != nil {
		return nil, err
	}
	if err := s.ComposeMemoResourceList(ctx, memo); err != nil {
		return nil, err
	}

	memoDisplayTsOptionKey := api.UserSettingMemoDisplayTsOptionKey
	memoDisplayTsOptionSetting, err := s.FindUserSetting(ctx, &api.UserSettingFind{
		UserID: memo.CreatorID,
		Key:    &memoDisplayTsOptionKey,
	})
	if err != nil {
		return nil, err
	}
	memoDisplayTsOptionValue := "created_ts"
	if memoDisplayTsOptionSetting != nil {
		err = json.Unmarshal([]byte(memoDisplayTsOptionSetting.Value), &memoDisplayTsOptionValue)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal user setting memo display ts option value")
		}
	}
	if memoDisplayTsOptionValue == "updated_ts" {
		memo.DisplayTs = memo.UpdatedTs
	}

	return memo, nil
}

func (s *Store) CreateMemo(ctx context.Context, create *api.MemoCreate) (*api.Memo, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoRaw, err := createMemoRaw(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	s.memoCache.Store(memoRaw.ID, memoRaw)
	memo, err := s.ComposeMemo(ctx, memoRaw.toMemo())
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *Store) PatchMemo(ctx context.Context, patch *api.MemoPatch) (*api.Memo, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoRaw, err := patchMemoRaw(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	s.memoCache.Store(memoRaw.ID, memoRaw)
	memo, err := s.ComposeMemo(ctx, memoRaw.toMemo())
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *Store) FindMemoList(ctx context.Context, find *api.MemoFind) ([]*api.Memo, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoRawList, err := findMemoRawList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Memo{}
	for _, raw := range memoRawList {
		memo, err := s.ComposeMemo(ctx, raw.toMemo())
		if err != nil {
			return nil, err
		}

		list = append(list, memo)
	}

	return list, nil
}

func (s *Store) FindMemo(ctx context.Context, find *api.MemoFind) (*api.Memo, error) {
	if find.ID != nil {
		if memo, ok := s.memoCache.Load(*find.ID); ok {
			memoRaw := memo.(*memoRaw)
			memo, err := s.ComposeMemo(ctx, memoRaw.toMemo())
			if err != nil {
				return nil, err
			}
			return memo, nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findMemoRawList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	memoRaw := list[0]
	s.memoCache.Store(memoRaw.ID, memoRaw)
	memo, err := s.ComposeMemo(ctx, memoRaw.toMemo())
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *Store) DeleteMemo(ctx context.Context, delete *api.MemoDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteMemo(ctx, tx, delete); err != nil {
		return FormatError(err)
	}
	if err := vacuum(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.memoCache.Delete(delete.ID)
	return nil
}

func createMemoRaw(ctx context.Context, tx *sql.Tx, create *api.MemoCreate) (*memoRaw, error) {
	set := []string{"creator_id", "content", "visibility"}
	args := []interface{}{create.CreatorID, create.Content, create.Visibility}
	placeholder := []string{"?", "?", "?"}

	if v := create.CreatedTs; v != nil {
		set, args, placeholder = append(set, "created_ts"), append(args, *v), append(placeholder, "?")
	}

	query := `
		INSERT INTO memo (
			` + strings.Join(set, ", ") + `
		)
		VALUES (` + strings.Join(placeholder, ",") + `)
		RETURNING id, creator_id, created_ts, updated_ts, row_status, content, visibility
	`
	var memoRaw memoRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&memoRaw.ID,
		&memoRaw.CreatorID,
		&memoRaw.CreatedTs,
		&memoRaw.UpdatedTs,
		&memoRaw.RowStatus,
		&memoRaw.Content,
		&memoRaw.Visibility,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoRaw, nil
}

func patchMemoRaw(ctx context.Context, tx *sql.Tx, patch *api.MemoPatch) (*memoRaw, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.CreatedTs; v != nil {
		set, args = append(set, "created_ts = ?"), append(args, *v)
	}
	if v := patch.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := patch.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := patch.Content; v != nil {
		set, args = append(set, "content = ?"), append(args, *v)
	}
	if v := patch.Visibility; v != nil {
		set, args = append(set, "visibility = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	query := `
		UPDATE memo
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, creator_id, created_ts, updated_ts, row_status, content, visibility
	`
	var memoRaw memoRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&memoRaw.ID,
		&memoRaw.CreatorID,
		&memoRaw.CreatedTs,
		&memoRaw.UpdatedTs,
		&memoRaw.RowStatus,
		&memoRaw.Content,
		&memoRaw.Visibility,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoRaw, nil
}

func findMemoRawList(ctx context.Context, tx *sql.Tx, find *api.MemoFind) ([]*memoRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.ID; v != nil {
		where, args = append(where, "memo.id = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "memo.creator_id = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "memo.row_status = ?"), append(args, *v)
	}
	if v := find.Pinned; v != nil {
		where = append(where, "memo_organizer.pinned = 1")
	}
	if v := find.ContentSearch; v != nil {
		where, args = append(where, "memo.content LIKE ?"), append(args, "%"+*v+"%")
	}
	if v := find.VisibilityList; len(v) != 0 {
		list := []string{}
		for _, visibility := range v {
			list = append(list, fmt.Sprintf("$%d", len(args)+1))
			args = append(args, visibility)
		}
		where = append(where, fmt.Sprintf("memo.visibility in (%s)", strings.Join(list, ",")))
	}

	query := `
		SELECT
			memo.id,
			memo.creator_id,
			memo.created_ts,
			memo.updated_ts,
			memo.row_status,
			memo.content,
			memo.visibility,
			memo_organizer.pinned
		FROM memo
		LEFT JOIN memo_organizer ON memo_organizer.memo_id = memo.id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY memo.created_ts DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	memoRawList := make([]*memoRaw, 0)
	for rows.Next() {
		var memoRaw memoRaw
		var pinned sql.NullBool
		if err := rows.Scan(
			&memoRaw.ID,
			&memoRaw.CreatorID,
			&memoRaw.CreatedTs,
			&memoRaw.UpdatedTs,
			&memoRaw.RowStatus,
			&memoRaw.Content,
			&memoRaw.Visibility,
			&pinned,
		); err != nil {
			return nil, FormatError(err)
		}

		if pinned.Valid {
			memoRaw.Pinned = pinned.Bool
		}
		memoRawList = append(memoRawList, &memoRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return memoRawList, nil
}

func deleteMemo(ctx context.Context, tx *sql.Tx, delete *api.MemoDelete) error {
	where, args := []string{"id = ?"}, []interface{}{delete.ID}

	stmt := `DELETE FROM memo WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo not found")}
	}

	return nil
}

func vacuumMemo(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		memo 
	WHERE 
		creator_id NOT IN (
			SELECT 
				id 
			FROM 
				user
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

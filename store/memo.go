package store

import (
	"context"
	"database/sql"
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
	}
}

func (s *Store) composeMemo(ctx context.Context, raw *memoRaw) (*api.Memo, error) {
	memo := raw.toMemo()

	memoOrganizer, err := s.FindMemoOrganizer(ctx, &api.MemoOrganizerFind{
		MemoID: memo.ID,
		UserID: memo.CreatorID,
	})
	if err != nil && common.ErrorCode(err) != common.NotFound {
		return nil, err
	} else if memoOrganizer != nil {
		memo.Pinned = memoOrganizer.Pinned
	}

	err = s.ComposeMemoCreator(ctx, memo)
	if err != nil {
		return nil, err
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

	memo, err := s.composeMemo(ctx, memoRaw)
	if err != nil {
		return nil, err
	}

	if err := s.cache.UpsertCache(api.MemoCache, memo.ID, memo); err != nil {
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

	memo, err := s.composeMemo(ctx, memoRaw)
	if err != nil {
		return nil, err
	}

	if err := s.cache.UpsertCache(api.MemoCache, memo.ID, memo); err != nil {
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
		memo, err := s.composeMemo(ctx, raw)
		if err != nil {
			return nil, err
		}

		list = append(list, memo)
	}

	return list, nil
}

func (s *Store) FindMemo(ctx context.Context, find *api.MemoFind) (*api.Memo, error) {
	if find.ID != nil {
		memo := &api.Memo{}
		has, err := s.cache.FindCache(api.MemoCache, *find.ID, memo)
		if err != nil {
			return nil, err
		}
		if has {
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

	memo, err := s.composeMemo(ctx, list[0])
	if err != nil {
		return nil, err
	}

	if err := s.cache.UpsertCache(api.MemoCache, memo.ID, memo); err != nil {
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

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.cache.DeleteCache(api.MemoCache, delete.ID)

	return nil
}

func createMemoRaw(ctx context.Context, tx *sql.Tx, create *api.MemoCreate) (*memoRaw, error) {
	set := []string{"creator_id", "content", "visibility"}
	args := []interface{}{create.CreatorID, create.Content, create.Visibility}
	placeholder := []string{"?", "?", "?"}

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
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "row_status = ?"), append(args, *v)
	}
	if v := find.Pinned; v != nil {
		where = append(where, "id in (SELECT memo_id FROM memo_organizer WHERE pinned = 1 AND user_id = memo.creator_id)")
	}
	if v := find.ContentSearch; v != nil {
		where, args = append(where, "content LIKE ?"), append(args, "%"+*v+"%")
	}
	if v := find.VisibilityList; len(v) != 0 {
		list := []string{}
		for _, visibility := range v {
			list = append(list, fmt.Sprintf("$%d", len(args)+1))
			args = append(args, visibility)
		}
		where = append(where, fmt.Sprintf("visibility in (%s)", strings.Join(list, ",")))
	}

	pagination := ""
	if find.Limit > 0 {
		pagination = fmt.Sprintf("%s LIMIT %d", pagination, find.Limit)
		if find.Offset > 0 {
			pagination = fmt.Sprintf("%s OFFSET %d", pagination, find.Offset)
		}
	}

	query := `
		SELECT
			id,
			creator_id,
			created_ts,
			updated_ts,
			row_status,
			content,
			visibility
		FROM memo
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC
	` + pagination
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	memoRawList := make([]*memoRaw, 0)
	for rows.Next() {
		var memoRaw memoRaw
		if err := rows.Scan(
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

		memoRawList = append(memoRawList, &memoRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return memoRawList, nil
}

func deleteMemo(ctx context.Context, tx *sql.Tx, delete *api.MemoDelete) error {
	result, err := tx.ExecContext(ctx, `
		DELETE FROM memo WHERE id = ?
	`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo ID not found: %d", delete.ID)}
	}

	return nil
}

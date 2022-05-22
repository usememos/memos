package store

import (
	"database/sql"
	"fmt"
	"memos/api"
	"memos/common"
	"strings"
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
	Content string
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
		Content: raw.Content,
	}
}

func (s *Store) CreateMemo(create *api.MemoCreate) (*api.Memo, error) {
	memoRaw, err := createMemoRaw(s.db, create)
	if err != nil {
		return nil, err
	}

	memo, err := s.composeMemo(memoRaw)
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *Store) PatchMemo(patch *api.MemoPatch) (*api.Memo, error) {
	memoRaw, err := patchMemoRaw(s.db, patch)
	if err != nil {
		return nil, err
	}

	memo, err := s.composeMemo(memoRaw)
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *Store) FindMemoList(find *api.MemoFind) ([]*api.Memo, error) {
	memoRawList, err := findMemoRawList(s.db, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Memo{}
	for _, raw := range memoRawList {
		memo, err := s.composeMemo(raw)
		if err != nil {
			return nil, err
		}

		list = append(list, memo)
	}

	return list, nil
}

func (s *Store) FindMemo(find *api.MemoFind) (*api.Memo, error) {
	list, err := findMemoRawList(s.db, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	memo, err := s.composeMemo(list[0])
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *Store) DeleteMemo(delete *api.MemoDelete) error {
	err := deleteMemo(s.db, delete)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

func createMemoRaw(db *sql.DB, create *api.MemoCreate) (*memoRaw, error) {
	set := []string{"creator_id", "content"}
	placeholder := []string{"?", "?"}
	args := []interface{}{create.CreatorID, create.Content}

	if v := create.CreatedTs; v != nil {
		set, placeholder, args = append(set, "created_ts"), append(placeholder, "?"), append(args, *v)
	}

	row, err := db.Query(`
		INSERT INTO memo (
			`+strings.Join(set, ", ")+`
		)
		VALUES (`+strings.Join(placeholder, ",")+`)
		RETURNING id, creator_id, created_ts, updated_ts, content, row_status
	`,
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	row.Next()
	var memoRaw memoRaw
	if err := row.Scan(
		&memoRaw.ID,
		&memoRaw.CreatorID,
		&memoRaw.CreatedTs,
		&memoRaw.UpdatedTs,
		&memoRaw.Content,
		&memoRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoRaw, nil
}

func patchMemoRaw(db *sql.DB, patch *api.MemoPatch) (*memoRaw, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.Content; v != nil {
		set, args = append(set, "content = ?"), append(args, *v)
	}
	if v := patch.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	row, err := db.Query(`
		UPDATE memo
		SET `+strings.Join(set, ", ")+`
		WHERE id = ?
		RETURNING id, created_ts, updated_ts, content, row_status
	`, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if !row.Next() {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	var memoRaw memoRaw
	if err := row.Scan(
		&memoRaw.ID,
		&memoRaw.CreatedTs,
		&memoRaw.UpdatedTs,
		&memoRaw.Content,
		&memoRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoRaw, nil
}

func findMemoRawList(db *sql.DB, find *api.MemoFind) ([]*memoRaw, error) {
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
		where = append(where, "id in (SELECT memo_id FROM memo_organizer WHERE pinned = 1 AND user_id = memo.creator_id )")
	}

	rows, err := db.Query(`
		SELECT
			id,
			creator_id,
			created_ts,
			updated_ts,
			content,
			row_status
		FROM memo
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY created_ts DESC`,
		args...,
	)
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
			&memoRaw.Content,
			&memoRaw.RowStatus,
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

func deleteMemo(db *sql.DB, delete *api.MemoDelete) error {
	result, err := db.Exec(`DELETE FROM memo WHERE id = ?`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo ID not found: %d", delete.ID)}
	}

	return nil
}

func (s *Store) composeMemo(raw *memoRaw) (*api.Memo, error) {
	memo := raw.toMemo()

	memoOrganizer, err := s.FindMemoOrganizer(&api.MemoOrganizerFind{
		MemoID: memo.ID,
		UserID: memo.CreatorID,
	})
	if err != nil && common.ErrorCode(err) != common.NotFound {
		return nil, err
	} else if memoOrganizer != nil {
		memo.Pinned = memoOrganizer.Pinned
	}

	return memo, nil
}

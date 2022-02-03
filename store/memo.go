package store

import (
	"fmt"
	"memos/api"
	"memos/common"
	"strings"
)

type MemoService struct {
	db *DB
}

func NewMemoService(db *DB) *MemoService {
	return &MemoService{db: db}
}

func (s *MemoService) CreateMemo(create *api.MemoCreate) (*api.Memo, error) {
	memo, err := createMemo(s.db, create)
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *MemoService) PatchMemo(patch *api.MemoPatch) (*api.Memo, error) {
	memo, err := patchMemo(s.db, patch)
	if err != nil {
		return nil, err
	}

	return memo, nil
}

func (s *MemoService) FindMemoList(find *api.MemoFind) ([]*api.Memo, error) {
	list, err := findMemoList(s.db, find)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func (s *MemoService) FindMemo(find *api.MemoFind) (*api.Memo, error) {
	list, err := findMemoList(s.db, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	return list[0], nil
}

func (s *MemoService) DeleteMemo(delete *api.MemoDelete) error {
	err := deleteMemo(s.db, delete)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

func createMemo(db *DB, create *api.MemoCreate) (*api.Memo, error) {
	row, err := db.Db.Query(`
		INSERT INTO memo (
			creator_id,
			content
		)
		VALUES (?, ?)
		RETURNING id, creator_id, created_ts, updated_ts, content, row_status
	`,
		create.CreatorId,
		create.Content,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if !row.Next() {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	var memo api.Memo
	if err := row.Scan(
		&memo.Id,
		&memo.CreatorId,
		&memo.CreatedTs,
		&memo.UpdatedTs,
		&memo.Content,
		&memo.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memo, nil
}

func patchMemo(db *DB, patch *api.MemoPatch) (*api.Memo, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.Content; v != nil {
		set, args = append(set, "content = ?"), append(args, v)
	}
	if v := patch.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, v)
	}

	args = append(args, patch.Id)

	row, err := db.Db.Query(`
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

	var memo api.Memo
	if err := row.Scan(
		&memo.Id,
		&memo.CreatedTs,
		&memo.UpdatedTs,
		&memo.Content,
		&memo.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memo, nil
}

func findMemoList(db *DB, find *api.MemoFind) ([]*api.Memo, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.Id; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.CreatorId; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}

	rows, err := db.Db.Query(`
		SELECT
			id,
			creator_id,
			created_ts,
			updated_ts,
			content,
			row_status
		FROM memo
		WHERE `+strings.Join(where, " AND "),
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	list := make([]*api.Memo, 0)
	for rows.Next() {
		var memo api.Memo
		if err := rows.Scan(
			&memo.Id,
			&memo.CreatorId,
			&memo.CreatedTs,
			&memo.UpdatedTs,
			&memo.Content,
			&memo.RowStatus,
		); err != nil {
			return nil, FormatError(err)
		}

		list = append(list, &memo)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return list, nil
}

func deleteMemo(db *DB, delete *api.MemoDelete) error {
	result, err := db.Db.Exec(`DELETE FROM memo WHERE id = ?`, delete.Id)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo ID not found: %d", delete.Id)}
	}

	return nil
}

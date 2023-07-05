package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/usememos/memos/common"
)

type FindMemoCommentMessage struct {
	ID int

	// Domain specific fields
	ContentSearch  []string
	VisibilityList []Visibility

	MemoID *int

	// Pagination
	Limit            *int
	Offset           *int
	OrderByUpdatedTs bool
}

type MemoCommentMessage struct {
	ID int

	// Standard fields
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility Visibility

	// Info fields
	Email   string
	Website string
	Name    string

	MemoID   int
	ParentID int
}

type DeleteMemoCommentMessage struct {
	ID     int
	MemoID int
}

func (s *Store) DeleteMemoComment(ctx context.Context, delete *DeleteMemoCommentMessage) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	where, args := []string{"id = ?", "memo_id = ?"}, []any{delete.ID, delete.MemoID}
	stmt := `DELETE FROM memo_comment WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}
	if err := s.vacuumImpl(ctx, tx); err != nil {
		return err
	}
	err = tx.Commit()
	return err
}

func (s *Store) CreateCommentMemo(ctx context.Context, create *MemoCommentMessage) (*MemoCommentMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	if create.CreatedTs == 0 {
		create.CreatedTs = time.Now().Unix()
	}

	query := `
		INSERT INTO memo_comment (
			created_ts,
			content,
			email,
		    website,
		    name,
			memo_id,
			parent_id 
		)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		RETURNING id, created_ts, updated_ts
	`
	if err := tx.QueryRowContext(
		ctx,
		query,
		create.CreatedTs,
		create.Content,
		create.Email,
		create.Website,
		create.Name,
		create.MemoID,
		create.ParentID,
	).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}
	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}
	return create, nil
}

func (s *Store) GetMemoComments(ctx context.Context, find *FindMemoCommentMessage) ([]*MemoCommentMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listMemoComments(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo not found")}
	}

	return list, nil
}

func listMemoComments(ctx context.Context, tx *sql.Tx, find *FindMemoCommentMessage) ([]*MemoCommentMessage, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.MemoID; v != nil {
		where, args = append(where, "memo_comment.memo_id = ?"), append(args, *v)
	}

	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			where, args = append(where, "memo_comment.content LIKE ?"), append(args, "%"+s+"%")
		}
	}
	if v := find.VisibilityList; len(v) != 0 {
		list := []string{}
		for _, visibility := range v {
			list = append(list, fmt.Sprintf("$%d", len(args)+1))
			args = append(args, visibility)
		}
		where = append(where, fmt.Sprintf("memo_comment.visibility in (%s)", strings.Join(list, ",")))
	}

	query := `
	SELECT
		memo_comment.id AS id,
		memo_comment.created_ts AS created_ts,
		memo_comment.updated_ts AS updated_ts,
		memo_comment.content AS content,
		memo_comment.visibility AS visibility,
		memo_comment.email AS email, 
		memo_comment.website AS website, 
		memo_comment.name AS name,
		memo_comment.parent_id AS parent_id,
		memo_comment.memo_id AS memo_id
	FROM
		memo_comment 
	WHERE ` + strings.Join(where, " AND ") + `
	`
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	memoCommentMessageList := make([]*MemoCommentMessage, 0)
	for rows.Next() {
		var memoCommentMessage MemoCommentMessage
		if err := rows.Scan(
			&memoCommentMessage.ID,
			&memoCommentMessage.CreatedTs,
			&memoCommentMessage.UpdatedTs,
			&memoCommentMessage.Content,
			&memoCommentMessage.Visibility,
			&memoCommentMessage.Email,
			&memoCommentMessage.Website,
			&memoCommentMessage.Name,
			&memoCommentMessage.ParentID,
			&memoCommentMessage.MemoID,
		); err != nil {
			return nil, FormatError(err)
		}
		memoCommentMessageList = append(memoCommentMessageList, &memoCommentMessage)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return memoCommentMessageList, nil
}

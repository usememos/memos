package store

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/usememos/memos/common"
)

// Visibility is the type of a visibility.
type Visibility string

const (
	// Public is the PUBLIC visibility.
	Public Visibility = "PUBLIC"
	// Protected is the PROTECTED visibility.
	Protected Visibility = "PROTECTED"
	// Private is the PRIVATE visibility.
	Private Visibility = "PRIVATE"
)

func (v Visibility) String() string {
	switch v {
	case Public:
		return "PUBLIC"
	case Protected:
		return "PROTECTED"
	case Private:
		return "PRIVATE"
	}
	return "PRIVATE"
}

type MemoMessage struct {
	ID int

	// Standard fields
	RowStatus RowStatus
	CreatorID int
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility Visibility

	// Composed fields
	Pinned         bool
	ResourceIDList []int
	RelationList   []*MemoRelationMessage
}

type FindMemoMessage struct {
	ID *int

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int

	// Domain specific fields
	Pinned         *bool
	ContentSearch  []string
	VisibilityList []Visibility

	// Pagination
	Limit            *int
	Offset           *int
	OrderByUpdatedTs bool
}

type UpdateMemoMessage struct {
	ID         int
	CreatedTs  *int64
	UpdatedTs  *int64
	RowStatus  *RowStatus
	Content    *string
	Visibility *Visibility
}

type DeleteMemoMessage struct {
	ID int
}

func (s *Store) CreateMemo(ctx context.Context, create *MemoMessage) (*MemoMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	if create.CreatedTs == 0 {
		create.CreatedTs = time.Now().Unix()
	}

	query := `
		INSERT INTO memo (
			creator_id,
			created_ts,
			content,
			visibility
		)
		VALUES (?, ?, ?, ?)
		RETURNING id, created_ts, updated_ts, row_status
	`
	if err := tx.QueryRowContext(
		ctx,
		query,
		create.CreatorID,
		create.CreatedTs,
		create.Content,
		create.Visibility,
	).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}
	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}
	memoMessage := create
	return memoMessage, nil
}

func (s *Store) ListMemos(ctx context.Context, find *FindMemoMessage) ([]*MemoMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listMemos(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetMemo(ctx context.Context, find *FindMemoMessage) (*MemoMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listMemos(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo not found")}
	}

	memoMessage := list[0]
	return memoMessage, nil
}

func (s *Store) UpdateMemo(ctx context.Context, update *UpdateMemoMessage) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	set, args := []string{}, []any{}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "created_ts = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "content = ?"), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "visibility = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	query := `
		UPDATE memo
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
	`
	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return err
	}
	err = tx.Commit()
	return err
}

func (s *Store) DeleteMemo(ctx context.Context, delete *DeleteMemoMessage) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	where, args := []string{"id = ?"}, []any{delete.ID}
	stmt := `DELETE FROM memo WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("idp not found")}
	}
	if err := s.vacuumImpl(ctx, tx); err != nil {
		return err
	}
	err = tx.Commit()
	return err
}

func (s *Store) FindMemosVisibilityList(ctx context.Context, memoIDs []int) ([]Visibility, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	args := make([]any, 0, len(memoIDs))
	list := make([]string, 0, len(memoIDs))
	for _, memoID := range memoIDs {
		args = append(args, memoID)
		list = append(list, "?")
	}

	where := fmt.Sprintf("id in (%s)", strings.Join(list, ","))

	query := `SELECT DISTINCT(visibility) FROM memo WHERE ` + where

	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	visibilityList := make([]Visibility, 0)
	for rows.Next() {
		var visibility Visibility
		if err := rows.Scan(&visibility); err != nil {
			return nil, FormatError(err)
		}
		visibilityList = append(visibilityList, visibility)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return visibilityList, nil
}

func listMemos(ctx context.Context, tx *sql.Tx, find *FindMemoMessage) ([]*MemoMessage, error) {
	where, args := []string{"1 = 1"}, []any{}

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
	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			where, args = append(where, "memo.content LIKE ?"), append(args, "%"+s+"%")
		}
	}
	if v := find.VisibilityList; len(v) != 0 {
		list := []string{}
		for _, visibility := range v {
			list = append(list, fmt.Sprintf("$%d", len(args)+1))
			args = append(args, visibility)
		}
		where = append(where, fmt.Sprintf("memo.visibility in (%s)", strings.Join(list, ",")))
	}
	orders := []string{"pinned DESC"}
	if find.OrderByUpdatedTs {
		orders = append(orders, "updated_ts DESC")
	} else {
		orders = append(orders, "created_ts DESC")
	}

	query := `
	SELECT
		memo.id AS id,
		memo.creator_id AS creator_id,
		memo.created_ts AS created_ts,
		memo.updated_ts AS updated_ts,
		memo.row_status AS row_status,
		memo.content AS content,
		memo.visibility AS visibility,
		CASE WHEN memo_organizer.pinned = 1 THEN 1 ELSE 0 END AS pinned,
		GROUP_CONCAT(memo_resource.resource_id) AS resource_id_list,
		(
				SELECT
						GROUP_CONCAT(related_memo_id || ':' || type)
				FROM
						memo_relation
				WHERE
						memo_relation.memo_id = memo.id
				GROUP BY
						memo_relation.memo_id
		) AS relation_list
	FROM
		memo
	LEFT JOIN
		memo_organizer ON memo.id = memo_organizer.memo_id
	LEFT JOIN
		memo_resource ON memo.id = memo_resource.memo_id
	WHERE ` + strings.Join(where, " AND ") + `
	GROUP BY memo.id
	ORDER BY ` + strings.Join(orders, ", ") + `
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

	memoMessageList := make([]*MemoMessage, 0)
	for rows.Next() {
		var memoMessage MemoMessage
		var memoResourceIDList sql.NullString
		var memoRelationList sql.NullString
		if err := rows.Scan(
			&memoMessage.ID,
			&memoMessage.CreatorID,
			&memoMessage.CreatedTs,
			&memoMessage.UpdatedTs,
			&memoMessage.RowStatus,
			&memoMessage.Content,
			&memoMessage.Visibility,
			&memoMessage.Pinned,
			&memoResourceIDList,
			&memoRelationList,
		); err != nil {
			return nil, FormatError(err)
		}

		if memoResourceIDList.Valid {
			idStringList := strings.Split(memoResourceIDList.String, ",")
			memoMessage.ResourceIDList = make([]int, 0, len(idStringList))
			for _, idString := range idStringList {
				id, err := strconv.Atoi(idString)
				if err != nil {
					return nil, FormatError(err)
				}
				memoMessage.ResourceIDList = append(memoMessage.ResourceIDList, id)
			}
		}
		if memoRelationList.Valid {
			memoMessage.RelationList = make([]*MemoRelationMessage, 0)
			relatedMemoTypeList := strings.Split(memoRelationList.String, ",")
			for _, relatedMemoType := range relatedMemoTypeList {
				relatedMemoTypeList := strings.Split(relatedMemoType, ":")
				if len(relatedMemoTypeList) != 2 {
					return nil, &common.Error{Code: common.Invalid, Err: fmt.Errorf("invalid relation format")}
				}
				relatedMemoID, err := strconv.Atoi(relatedMemoTypeList[0])
				if err != nil {
					return nil, FormatError(err)
				}
				memoMessage.RelationList = append(memoMessage.RelationList, &MemoRelationMessage{
					MemoID:        memoMessage.ID,
					RelatedMemoID: relatedMemoID,
					Type:          MemoRelationType(relatedMemoTypeList[1]),
				})
			}
		}
		memoMessageList = append(memoMessageList, &memoMessage)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return memoMessageList, nil
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

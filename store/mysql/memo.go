package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

func (d *Driver) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	ts := time.Now().Unix()
	if create.CreatedTs == 0 {
		create.CreatedTs = ts
	}
	if create.UpdatedTs == 0 {
		create.UpdatedTs = ts
	}
	create.RowStatus = store.Normal

	stmt := `
		INSERT INTO memo (
			creator_id,
			created_ts,
			content,
			visibility,
			updated_ts,
			row_status
		)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	result, err := d.db.ExecContext(
		ctx,
		stmt,
		create.CreatorID,
		create.CreatedTs,
		create.Content,
		create.Visibility,
		create.UpdatedTs,
		create.RowStatus,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	create.ID = int32(id)

	return create, nil
}

func (d *Driver) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
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
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "memo.created_ts < ?"), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "memo.created_ts > ?"), append(args, *v)
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
			list = append(list, "?")
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
	orders = append(orders, "id DESC")

	query := `
	SELECT
		memo.id AS id,
		memo.creator_id AS creator_id,
		memo.created_ts AS created_ts,
		memo.updated_ts AS updated_ts,
		memo.row_status AS row_status,
		memo.content AS content,
		memo.visibility AS visibility,
		MAX(CASE WHEN memo_organizer.pinned = 1 THEN 1 ELSE 0 END) AS pinned,
		GROUP_CONCAT(resource.id) AS resource_id_list,
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
		resource ON memo.id = resource.memo_id
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

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Memo, 0)
	for rows.Next() {
		var memo store.Memo
		var memoResourceIDList sql.NullString
		var memoRelationList sql.NullString
		if err := rows.Scan(
			&memo.ID,
			&memo.CreatorID,
			&memo.CreatedTs,
			&memo.UpdatedTs,
			&memo.RowStatus,
			&memo.Content,
			&memo.Visibility,
			&memo.Pinned,
			&memoResourceIDList,
			&memoRelationList,
		); err != nil {
			return nil, err
		}

		if memoResourceIDList.Valid {
			idStringList := strings.Split(memoResourceIDList.String, ",")
			memo.ResourceIDList = make([]int32, 0, len(idStringList))
			for _, idString := range idStringList {
				id, err := util.ConvertStringToInt32(idString)
				if err != nil {
					return nil, err
				}
				memo.ResourceIDList = append(memo.ResourceIDList, id)
			}
		}
		if memoRelationList.Valid {
			memo.RelationList = make([]*store.MemoRelation, 0)
			relatedMemoTypeList := strings.Split(memoRelationList.String, ",")
			for _, relatedMemoType := range relatedMemoTypeList {
				relatedMemoTypeList := strings.Split(relatedMemoType, ":")
				if len(relatedMemoTypeList) != 2 {
					return nil, errors.Errorf("invalid relation format")
				}
				relatedMemoID, err := util.ConvertStringToInt32(relatedMemoTypeList[0])
				if err != nil {
					return nil, err
				}
				memo.RelationList = append(memo.RelationList, &store.MemoRelation{
					MemoID:        memo.ID,
					RelatedMemoID: relatedMemoID,
					Type:          store.MemoRelationType(relatedMemoTypeList[1]),
				})
			}
		}
		list = append(list, &memo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *Driver) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	_, _, _ = d, ctx, update
	return errNotImplemented
}

func (d *Driver) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

func (d *Driver) FindMemosVisibilityList(ctx context.Context, memoIDs []int32) ([]store.Visibility, error) {
	_, _, _ = d, ctx, memoIDs
	return nil, errNotImplemented
}

package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"`creator_id`", "`content`", "`visibility`"}
	placeholder := []string{"?", "?", "?"}
	args := []any{create.CreatorID, create.Content, create.Visibility}

	if create.ID != 0 {
		fields = append(fields, "`id`")
		placeholder = append(placeholder, "?")
		args = append(args, create.ID)
	}

	if create.CreatedTs != 0 {
		fields = append(fields, "`created_ts`")
		placeholder = append(placeholder, "FROM_UNIXTIME(?)")
		args = append(args, create.CreatedTs)
	}

	if create.UpdatedTs != 0 {
		fields = append(fields, "`updated_ts`")
		placeholder = append(placeholder, "FROM_UNIXTIME(?)")
		args = append(args, create.UpdatedTs)
	}

	if create.RowStatus != "" {
		fields = append(fields, "`row_status`")
		placeholder = append(placeholder, "?")
		args = append(args, create.RowStatus)
	}

	stmt := "INSERT INTO memo (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	memo, err := d.GetMemo(ctx, &store.FindMemo{ID: &id})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, errors.Errorf("failed to create memo")
	}
	return memo, nil
}

func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`memo`.`id` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`memo`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "`memo`.`row_status` = ?"), append(args, *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`created_ts`) < ?"), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`created_ts`) > ?"), append(args, *v)
	}
	if v := find.Pinned; v != nil {
		where = append(where, "`memo_organizer`.`pinned` = 1")
	}
	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			where, args = append(where, "`memo`.`content` LIKE ?"), append(args, "%"+s+"%")
		}
	}
	if v := find.VisibilityList; len(v) != 0 {
		list := []string{}
		for _, visibility := range v {
			list = append(list, "?")
			args = append(args, visibility)
		}
		where = append(where, fmt.Sprintf("`memo`.`visibility` in (%s)", strings.Join(list, ",")))
	}
	orders := []string{"`pinned` DESC"}
	if find.OrderByUpdatedTs {
		orders = append(orders, "`updated_ts` DESC")
	} else {
		orders = append(orders, "`created_ts` DESC")
	}
	orders = append(orders, "`id` DESC")

	query := "SELECT `memo`.`id` AS `id`, `memo`.`creator_id` AS `creator_id`, UNIX_TIMESTAMP(`memo`.`created_ts`) AS `created_ts`, UNIX_TIMESTAMP(`memo`.`updated_ts`) AS `updated_ts`, `memo`.`row_status` AS `row_status`, `memo`.`content` AS `content`, `memo`.`visibility` AS `visibility`, MAX(CASE WHEN `memo_organizer`.`pinned` = 1 THEN 1 ELSE 0 END) AS `pinned`, GROUP_CONCAT(`resource`.`id`) AS `resource_id_list`, (SELECT GROUP_CONCAT(`memo_id`,':',`related_memo_id`,':',`type`) FROM `memo_relation` WHERE `memo_relation`.`memo_id` = `memo`.`id` OR `memo_relation`.`related_memo_id` = `memo`.`id` ) AS `relation_list` FROM `memo` LEFT JOIN `memo_organizer` ON `memo`.`id` = `memo_organizer`.`memo_id` LEFT JOIN `resource` ON `memo`.`id` = `resource`.`memo_id` WHERE " + strings.Join(where, " AND ") + " GROUP BY `memo`.`id` ORDER BY " + strings.Join(orders, ", ")
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
				if len(relatedMemoTypeList) != 3 {
					return nil, errors.Errorf("invalid relation format")
				}
				memoID, err := util.ConvertStringToInt32(relatedMemoTypeList[0])
				if err != nil {
					return nil, err
				}
				relatedMemoID, err := util.ConvertStringToInt32(relatedMemoTypeList[1])
				if err != nil {
					return nil, err
				}
				relationType := store.MemoRelationType(relatedMemoTypeList[2])
				memo.RelationList = append(memo.RelationList, &store.MemoRelation{
					MemoID:        memoID,
					RelatedMemoID: relatedMemoID,
					Type:          relationType,
				})
				// Set the first parent ID if relation type is comment.
				if memo.ParentID == nil && memoID == memo.ID && relationType == store.MemoRelationComment {
					memo.ParentID = &relatedMemoID
				}
			}
		}
		list = append(list, &memo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetMemo(ctx context.Context, find *store.FindMemo) (*store.Memo, error) {
	list, err := d.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (d *DB) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "`content` = ?"), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "`visibility` = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	stmt := "UPDATE `memo` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	where, args := []string{"`id` = ?"}, []any{delete.ID}
	stmt := "DELETE FROM `memo` WHERE " + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	if err := d.Vacuum(ctx); err != nil {
		// Prevent linter warning.
		return err
	}
	return nil
}

func (d *DB) FindMemosVisibilityList(ctx context.Context, memoIDs []int32) ([]store.Visibility, error) {
	args := make([]any, 0, len(memoIDs))
	list := make([]string, 0, len(memoIDs))
	for _, memoID := range memoIDs {
		args = append(args, memoID)
		list = append(list, "?")
	}

	where := fmt.Sprintf("`id` in (%s)", strings.Join(list, ","))
	query := "SELECT DISTINCT(`visibility`) FROM `memo` WHERE " + where
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	visibilityList := make([]store.Visibility, 0)
	for rows.Next() {
		var visibility store.Visibility
		if err := rows.Scan(&visibility); err != nil {
			return nil, err
		}
		visibilityList = append(visibilityList, visibility)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return visibilityList, nil
}

func vacuumMemo(ctx context.Context, tx *sql.Tx) error {
	stmt := "DELETE FROM `memo` WHERE `creator_id` NOT IN (SELECT `id` FROM `user`)"
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}

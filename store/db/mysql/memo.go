package mysql

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"`uid`", "`creator_id`", "`content`", "`visibility`", "`tags`", "`payload`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?"}
	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, err
		}
		payload = string(payloadBytes)
	}
	args := []any{create.UID, create.CreatorID, create.Content, create.Visibility, "[]", payload}

	stmt := "INSERT INTO `memo` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
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
	where, having, args := []string{"1 = 1"}, []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`memo`.`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`memo`.`uid` = ?"), append(args, *v)
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
	if v := find.UpdatedTsBefore; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`updated_ts`) < ?"), append(args, *v)
	}
	if v := find.UpdatedTsAfter; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`updated_ts`) > ?"), append(args, *v)
	}
	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			where, args = append(where, "`memo`.`content` LIKE ?"), append(args, "%"+s+"%")
		}
	}
	if v := find.VisibilityList; len(v) != 0 {
		placeholder := []string{}
		for _, visibility := range v {
			placeholder = append(placeholder, "?")
			args = append(args, visibility.String())
		}
		where = append(where, fmt.Sprintf("`memo`.`visibility` in (%s)", strings.Join(placeholder, ",")))
	}
	if v := find.PayloadFind; v != nil {
		if v.Raw != nil {
			where, args = append(where, "`memo`.`payload` = ?"), append(args, *v.Raw)
		}
		if len(v.TagSearch) != 0 {
			for _, tag := range v.TagSearch {
				where, args = append(where, "(JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.property.tags'), ?) OR JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.property.tags'), ?))"), append(args, fmt.Sprintf(`"%s"`, tag), fmt.Sprintf(`"%s/`, tag))
			}
		}
		if v.HasLink {
			where = append(where, "JSON_EXTRACT(`memo`.`payload`, '$.property.hasLink') IS TRUE")
		}
		if v.HasTaskList {
			where = append(where, "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') IS TRUE")
		}
		if v.HasCode {
			where = append(where, "JSON_EXTRACT(`memo`.`payload`, '$.property.hasCode') IS TRUE")
		}
		if v.HasIncompleteTasks {
			where = append(where, "JSON_EXTRACT(`memo`.`payload`, '$.property.hasIncompleteTasks') IS TRUE")
		}
	}
	if find.ExcludeComments {
		having = append(having, "`parent_id` IS NULL")
	}

	orders := []string{}
	if find.OrderByPinned {
		orders = append(orders, "`pinned` DESC")
	}
	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	if find.OrderByUpdatedTs {
		orders = append(orders, "`updated_ts` "+order)
	} else {
		orders = append(orders, "`created_ts` "+order)
	}
	orders = append(orders, "`id` "+order)
	if find.Random {
		orders = append(orders, "RAND()")
	}

	fields := []string{
		"`memo`.`id` AS `id`",
		"`memo`.`uid` AS `uid`",
		"`memo`.`creator_id` AS `creator_id`",
		"UNIX_TIMESTAMP(`memo`.`created_ts`) AS `created_ts`",
		"UNIX_TIMESTAMP(`memo`.`updated_ts`) AS `updated_ts`",
		"`memo`.`row_status` AS `row_status`",
		"`memo`.`visibility` AS `visibility`",
		"`memo`.`payload` AS `payload`",
		"IFNULL(`memo_organizer`.`pinned`, 0) AS `pinned`",
		"`memo_relation`.`related_memo_id` AS `parent_id`",
	}
	if !find.ExcludeContent {
		fields = append(fields, "`memo`.`content` AS `content`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM `memo`" + " " +
		"LEFT JOIN `memo_organizer` ON `memo`.`id` = `memo_organizer`.`memo_id` AND `memo`.`creator_id` = `memo_organizer`.`user_id`" + " " +
		"LEFT JOIN `memo_relation` ON `memo`.`id` = `memo_relation`.`memo_id` AND `memo_relation`.`type` = 'COMMENT'" + " " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"HAVING " + strings.Join(having, " AND ") + " " +
		"ORDER BY " + strings.Join(orders, ", ")
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
		var payloadBytes []byte
		dests := []any{
			&memo.ID,
			&memo.UID,
			&memo.CreatorID,
			&memo.CreatedTs,
			&memo.UpdatedTs,
			&memo.RowStatus,
			&memo.Visibility,
			&payloadBytes,
			&memo.Pinned,
			&memo.ParentID,
		}
		if !find.ExcludeContent {
			dests = append(dests, &memo.Content)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}
		payload := &storepb.MemoPayload{}
		if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal payload")
		}
		memo.Payload = payload
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
	if v := update.UID; v != nil {
		set, args = append(set, "`uid` = ?"), append(args, *v)
	}
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
	if v := update.Payload; v != nil {
		payloadBytes, err := protojson.Marshal(v)
		if err != nil {
			return err
		}
		set, args = append(set, "`payload` = ?"), append(args, string(payloadBytes))
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
	return nil
}

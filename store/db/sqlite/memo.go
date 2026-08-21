package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"`uid`", "`creator_id`", "`content`", "`visibility`", "`payload`"}
	placeholder := []string{"?", "?", "?", "?", "?"}
	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, err
		}
		payload = string(payloadBytes)
	}
	args := []any{create.UID, create.CreatorID, create.Content, create.Visibility, payload}

	// Add custom timestamps if provided
	if create.CreatedTs != 0 {
		fields = append(fields, "`created_ts`")
		placeholder = append(placeholder, "?")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		fields = append(fields, "`updated_ts`")
		placeholder = append(placeholder, "?")
		args = append(args, create.UpdatedTs)
	}

	stmt := "INSERT INTO `memo` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`, `updated_ts`, `row_status`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	where, args := []string{"1 = 1"}, []any{}

	engine, err := filter.DefaultEngine()
	if err != nil {
		return nil, err
	}
	if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectSQLite, &where, &args); err != nil {
		return nil, err
	}
	if v := find.ID; v != nil {
		where, args = append(where, "`memo`.`id` = ?"), append(args, *v)
	}
	if len(find.IDList) > 0 {
		placeholders := make([]string, 0, len(find.IDList))
		for range find.IDList {
			placeholders = append(placeholders, "?")
		}
		where = append(where, "`memo`.`id` IN ("+strings.Join(placeholders, ",")+")")
		for _, id := range find.IDList {
			args = append(args, id)
		}
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`memo`.`uid` = ?"), append(args, *v)
	}
	if len(find.UIDList) > 0 {
		placeholders := make([]string, 0, len(find.UIDList))
		for range find.UIDList {
			placeholders = append(placeholders, "?")
		}
		where = append(where, "`memo`.`uid` IN ("+strings.Join(placeholders, ",")+")")
		for _, uid := range find.UIDList {
			args = append(args, uid)
		}
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`memo`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "`memo`.`row_status` = ?"), append(args, *v)
	}
	if v := find.VisibilityList; len(v) != 0 {
		placeholder := []string{}
		for _, visibility := range v {
			placeholder = append(placeholder, "?")
			args = append(args, visibility.String())
		}
		where = append(where, fmt.Sprintf("`memo`.`visibility` IN (%s)", strings.Join(placeholder, ",")))
	}
	if find.ExcludeComments {
		where = append(where, "`parent_uid` IS NULL")
	}

	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	orderBy := []string{}
	if find.OrderByPinned {
		orderBy = append(orderBy, "`pinned` DESC")
	}
	if find.OrderByUpdatedTs {
		orderBy = append(orderBy, "`updated_ts` "+order)
	} else {
		orderBy = append(orderBy, "`created_ts` "+order)
	}
	// Add id as final tie-breaker
	orderBy = append(orderBy, "`id` DESC")
	fields := []string{
		"`memo`.`id` AS `id`",
		"`memo`.`uid` AS `uid`",
		"`memo`.`creator_id` AS `creator_id`",
		"`memo`.`created_ts` AS `created_ts`",
		"`memo`.`updated_ts` AS `updated_ts`",
		"`memo`.`row_status` AS `row_status`",
		"`memo`.`visibility` AS `visibility`",
		"`memo`.`pinned` AS `pinned`",
		"`memo`.`payload` AS `payload`",
		"CASE WHEN `parent_memo`.`uid` IS NOT NULL THEN `parent_memo`.`uid` ELSE NULL END AS `parent_uid`",
	}
	if !find.ExcludeContent {
		fields = append(fields, "`memo`.`content` AS `content`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + "FROM `memo` " +
		"LEFT JOIN `user` AS `memo_creator` ON `memo`.`creator_id` = `memo_creator`.`id` " +
		"LEFT JOIN `memo_relation` ON `memo`.`id` = `memo_relation`.`memo_id` AND `memo_relation`.`type` = \"COMMENT\" " +
		"LEFT JOIN `memo` AS `parent_memo` ON `memo_relation`.`related_memo_id` = `parent_memo`.`id` " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"ORDER BY " + strings.Join(orderBy, ", ")
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
			&memo.Pinned,
			&payloadBytes,
			&memo.ParentUID,
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

// TransformMemoContents atomically transforms creator-scoped memo content in
// bounded batches. A concurrent writer makes the transaction fail rather than
// allowing this transform to overwrite a newer edit.
func (d *DB) TransformMemoContents(ctx context.Context, request *store.TransformMemoContentsRequest) ([]int32, error) {
	tx, err := d.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin memo content transform")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	updatedMemoIDs := []int32{}
	var cursorCreatedTs int64
	var cursorID int32
	hasCursor := false
	for {
		memos, err := func() ([]*store.Memo, error) {
			where := []string{"creator_id = ?"}
			args := []any{request.CreatorID}
			if request.ContentSubstring != "" {
				where = append(where, "INSTR(content, ?) > 0")
				args = append(args, request.ContentSubstring)
			}
			if hasCursor {
				where = append(where, "(created_ts < ? OR (created_ts = ? AND id < ?))")
				args = append(args, cursorCreatedTs, cursorCreatedTs, cursorID)
			}
			args = append(args, request.BatchSize)
			rows, err := tx.QueryContext(ctx, `
				SELECT id, uid, creator_id, created_ts, content, payload
				FROM memo
				WHERE `+strings.Join(where, " AND ")+`
				ORDER BY created_ts DESC, id DESC
				LIMIT ?`, args...)
			if err != nil {
				return nil, errors.Wrap(err, "failed to list memos for content transform")
			}
			defer func() {
				_ = rows.Close()
			}()

			memos := make([]*store.Memo, 0, request.BatchSize)
			for rows.Next() {
				memo := &store.Memo{}
				var payloadBytes []byte
				if err := rows.Scan(&memo.ID, &memo.UID, &memo.CreatorID, &memo.CreatedTs, &memo.Content, &payloadBytes); err != nil {
					return nil, errors.Wrap(err, "failed to scan memo for content transform")
				}
				memo.Payload = &storepb.MemoPayload{}
				if len(payloadBytes) > 0 {
					if err := protojson.Unmarshal(payloadBytes, memo.Payload); err != nil {
						return nil, errors.Wrap(err, "failed to unmarshal memo payload")
					}
				}
				memos = append(memos, memo)
			}
			if err := rows.Err(); err != nil {
				return nil, errors.Wrap(err, "failed to iterate memos for content transform")
			}
			return memos, nil
		}()
		if err != nil {
			return nil, err
		}

		for _, memo := range memos {
			changed, err := request.Transform(memo)
			if err != nil {
				return nil, err
			}
			if !changed {
				continue
			}
			if err := applyMemoUpdate(ctx, tx, &store.UpdateMemo{
				ID:        memo.ID,
				UpdatedTs: &request.UpdatedTs,
				Content:   &memo.Content,
				Payload:   memo.Payload,
			}); err != nil {
				return nil, errors.Wrap(err, "failed to persist memo content transform")
			}
			updatedMemoIDs = append(updatedMemoIDs, memo.ID)
		}

		if len(memos) < request.BatchSize {
			break
		}
		lastMemo := memos[len(memos)-1]
		cursorCreatedTs, cursorID = lastMemo.CreatedTs, lastMemo.ID
		hasCursor = true
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo content transform")
	}
	return updatedMemoIDs, nil
}

func (d *DB) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	return applyMemoUpdate(ctx, d.db, update)
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

package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"`uid`", "`creator_id`", "`content`", "`visibility`", "`payload`", "`workspace_id`", "`folder_path`", "`title`", "`doc_type`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?", "?", "?", "?"}
	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, err
		}
		payload = string(payloadBytes)
	}
	docType := create.DocType
	if docType == "" {
		docType = "MARKDOWN"
	}
	args := []any{create.UID, create.CreatorID, create.Content, create.Visibility, payload, create.WorkspaceID, create.FolderPath, create.Title, docType}

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
	if v := find.WorkspaceID; v != nil {
		where, args = append(where, "`memo`.`workspace_id` = ?"), append(args, *v)
	}
	if v := find.FolderPathPrefix; v != nil {
		where = append(where, "(`memo`.`folder_path` = ? OR `memo`.`folder_path` LIKE ?)")
		args = append(args, *v, *v+"/%")
	}
	if v := find.FolderPathList; len(v) != 0 {
		placeholders := make([]string, len(v))
		for i, folderPath := range v {
			placeholders[i] = "?"
			args = append(args, folderPath)
		}
		where = append(where, fmt.Sprintf("`memo`.`folder_path` IN (%s)", strings.Join(placeholders, ",")))
	}
	if find.VisibleWorkspaceIDs != nil {
		if len(find.VisibleWorkspaceIDs) == 0 {
			where = append(where, "`memo`.`visibility` = 'PUBLIC'")
		} else {
			placeholders := make([]string, len(find.VisibleWorkspaceIDs))
			for i, id := range find.VisibleWorkspaceIDs {
				placeholders[i] = "?"
				args = append(args, id)
			}
			where = append(where, fmt.Sprintf("(`memo`.`workspace_id` IN (%s) OR `memo`.`visibility` = 'PUBLIC')", strings.Join(placeholders, ",")))
		}
	}
	if v := find.HomeDocViewerID; v != nil {
		where = append(where, "(`memo`.`folder_path` != ? OR `memo`.`creator_id` = ?)")
		args = append(args, store.HomeFolderPath, *v)
	}
	if find.ExcludeHiddenWorkspaces {
		where = append(where, "`memo`.`workspace_id` NOT IN (SELECT `id` FROM `workspace` WHERE `hidden` = 1)")
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
		"`memo`.`workspace_id` AS `workspace_id`",
		"`memo`.`folder_path` AS `folder_path`",
		"`memo`.`title` AS `title`",
		"`memo`.`doc_type` AS `doc_type`",
		"CASE WHEN `parent_memo`.`uid` IS NOT NULL THEN `parent_memo`.`uid` ELSE NULL END AS `parent_uid`",
	}
	if !find.ExcludeContent {
		fields = append(fields, "`memo`.`content` AS `content`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + "FROM `memo` " +
		"LEFT JOIN `user` AS `memo_creator` ON `memo`.`creator_id` = `memo_creator`.`id` " +
		"LEFT JOIN `workspace` AS `memo_workspace` ON `memo`.`workspace_id` = `memo_workspace`.`id` " +
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
			&memo.WorkspaceID,
			&memo.FolderPath,
			&memo.Title,
			&memo.DocType,
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

func (d *DB) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.UID; v != nil {
		set, args = append(set, "`uid` = ?"), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
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
	if v := update.Pinned; v != nil {
		set, args = append(set, "`pinned` = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		payloadBytes, err := protojson.Marshal(v)
		if err != nil {
			return err
		}
		set, args = append(set, "`payload` = ?"), append(args, string(payloadBytes))
	}
	if v := update.WorkspaceID; v != nil {
		set, args = append(set, "`workspace_id` = ?"), append(args, *v)
	}
	if v := update.FolderPath; v != nil {
		set, args = append(set, "`folder_path` = ?"), append(args, *v)
	}
	if v := update.Title; v != nil {
		set, args = append(set, "`title` = ?"), append(args, *v)
	}
	if v := update.DocType; v != nil {
		set, args = append(set, "`doc_type` = ?"), append(args, *v)
	}
	if len(set) == 0 {
		return nil
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

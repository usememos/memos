package mysql

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
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := validateMySQLMemoCreate(ctx, tx, create); err != nil {
		return nil, err
	}
	memo, err := insertMySQLMemo(ctx, tx, create)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return memo, nil
}

func insertMySQLMemo(ctx context.Context, tx *sql.Tx, create *store.Memo) (*store.Memo, error) {
	fields := []string{"`uid`", "`creator_id`", "`content`", "`visibility`", "`payload`", "`space_id`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?"}
	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, err
		}
		payload = string(payloadBytes)
	}
	args := []any{create.UID, create.CreatorID, create.Content, create.Visibility, payload, create.SpaceID}

	// Add custom timestamps if provided
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

	stmt := "INSERT INTO `memo` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	memo := &store.Memo{}
	var payloadBytes []byte
	err = tx.QueryRowContext(ctx, `SELECT id, uid, creator_id, UNIX_TIMESTAMP(created_ts), UNIX_TIMESTAMP(updated_ts), row_status,
		content, visibility, pinned, payload, space_id
		FROM memo WHERE id = ?`, id).Scan(&memo.ID, &memo.UID, &memo.CreatorID, &memo.CreatedTs, &memo.UpdatedTs, &memo.RowStatus,
		&memo.Content, &memo.Visibility, &memo.Pinned, &payloadBytes, &memo.SpaceID)
	if err != nil {
		return nil, err
	}
	memo.Payload = &storepb.MemoPayload{}
	if err := protojsonUnmarshaler.Unmarshal(payloadBytes, memo.Payload); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal payload")
	}
	return memo, nil
}

func validateMySQLMemoCreate(ctx context.Context, tx *sql.Tx, create *store.Memo) error {
	var actorStatus store.RowStatus
	err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", create.CreatorID).Scan(&actorStatus)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && actorStatus != store.Normal) {
		return store.ErrMemoSpaceMembershipRequired
	}
	if err != nil {
		return err
	}
	if create.SpaceID != nil {
		return validateMySQLMemoSpaceMember(ctx, tx, *create.SpaceID, create.CreatorID)
	}
	return nil
}

func validateMySQLMemoSpaceMember(ctx context.Context, tx *sql.Tx, spaceID, userID int32) error {
	var existingSpaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", spaceID).Scan(&existingSpaceID); errors.Is(err, sql.ErrNoRows) {
		return store.ErrMemoSpaceNotWritable
	} else if err != nil {
		return err
	}
	var exists bool
	err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM space_member sm JOIN user u ON u.id = sm.user_id
		WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = 'ACTIVE'
			AND sm.role IN ('ADMIN', 'USER') AND u.row_status = 'NORMAL')`, spaceID, userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return store.ErrMemoSpaceMembershipRequired
	}
	return nil
}

func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	where, having, args := []string{"1 = 1"}, []string{"1 = 1"}, []any{}

	engine, err := filter.DefaultEngine()
	if err != nil {
		return nil, err
	}
	if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectMySQL, &where, &args); err != nil {
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
		where = append(where, fmt.Sprintf("`memo`.`visibility` in (%s)", strings.Join(placeholder, ",")))
	}
	if v := find.CommentContextMemoID; v != nil {
		where, args = append(where, `EXISTS (
			SELECT 1 FROM memo_relation AS comment_context
			WHERE comment_context.memo_id = memo.id
				AND comment_context.related_memo_id = ?
				AND comment_context.type = 'COMMENT'
		)`), append(args, *v)
	}
	if access := find.Access; access != nil {
		where = append(where, mysqlMemoAccessPredicate(access, "`memo`", "`access_member`", &args))
	}
	if find.ExcludeComments {
		where = append(where, `NOT EXISTS (
			SELECT 1 FROM memo_relation AS comment_relation
			WHERE comment_relation.memo_id = memo.id AND comment_relation.type = 'COMMENT'
		)`)
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
		"UNIX_TIMESTAMP(`memo`.`created_ts`) AS `created_ts`",
		"UNIX_TIMESTAMP(`memo`.`updated_ts`) AS `updated_ts`",
		"`memo`.`row_status` AS `row_status`",
		"`memo`.`visibility` AS `visibility`",
		"`memo`.`pinned` AS `pinned`",
		"`memo`.`payload` AS `payload`",
		"`memo`.`space_id` AS `space_id`",
		`(SELECT parent_memo.uid
			FROM memo_relation AS parent_relation
			JOIN memo AS parent_memo ON parent_memo.id = parent_relation.related_memo_id
			WHERE parent_relation.memo_id = memo.id AND parent_relation.type = 'COMMENT'
			ORDER BY parent_memo.id LIMIT 1) AS parent_uid`,
	}
	if !find.ExcludeContent {
		fields = append(fields, "`memo`.`content` AS `content`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM `memo`" + " " +
		"LEFT JOIN `user` AS `memo_creator` ON `memo`.`creator_id` = `memo_creator`.`id`" + " " +
		"LEFT JOIN `space` AS `memo_space` ON `memo`.`space_id` = `memo_space`.`id`" + " " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"HAVING " + strings.Join(having, " AND ") + " " +
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
			&memo.SpaceID,
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
	if update.Policy == nil {
		return applyMemoUpdate(ctx, d.db, update)
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := validateMySQLMemoWritePolicy(ctx, tx, update.ID, update.Policy, update); err != nil {
		return err
	}
	if err := applyMemoUpdate(ctx, tx, update); err != nil {
		return err
	}
	return tx.Commit()
}

func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to start memo delete transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, "DELETE FROM `memo` WHERE `id` = ?", delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete memo")
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM `reaction` WHERE `memo_id` = ?", delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete memo reactions")
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return nil
}

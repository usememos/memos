package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/plugin/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"uid", "creator_id", "content", "visibility", "payload"}
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
		fields = append(fields, "created_ts")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		fields = append(fields, "updated_ts")
		args = append(args, create.UpdatedTs)
	}

	stmt := "INSERT INTO memo (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts, row_status"
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
	if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectPostgres, &where, &args); err != nil {
		return nil, err
	}
	if v := find.ID; v != nil {
		where, args = append(where, "memo.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(find.IDList) > 0 {
		holders := make([]string, 0, len(find.IDList))
		for _, id := range find.IDList {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, id)
		}
		where = append(where, "memo.id IN ("+strings.Join(holders, ", ")+")")
	}
	if v := find.UID; v != nil {
		where, args = append(where, "memo.uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(find.UIDList) > 0 {
		holders := make([]string, 0, len(find.UIDList))
		for _, uid := range find.UIDList {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, uid)
		}
		where = append(where, "memo.uid IN ("+strings.Join(holders, ", ")+")")
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "memo.creator_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "memo.row_status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.VisibilityList; len(v) != 0 {
		holders := []string{}
		for _, visibility := range v {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, visibility.String())
		}
		where = append(where, fmt.Sprintf("memo.visibility in (%s)", strings.Join(holders, ", ")))
	}
	if find.ExcludeComments {
		where = append(where, "memo_relation.related_memo_id IS NULL")
	}

	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	orderBy := []string{}
	if find.OrderByPinned {
		orderBy = append(orderBy, "pinned DESC")
	}
	if find.OrderByUpdatedTs {
		orderBy = append(orderBy, "updated_ts "+order)
	} else {
		orderBy = append(orderBy, "created_ts "+order)
	}
	// Add id as final tie-breaker
	orderBy = append(orderBy, "id DESC")
	fields := []string{
		`memo.id AS id`,
		`memo.uid AS uid`,
		`memo.creator_id AS creator_id`,
		`memo.created_ts AS created_ts`,
		`memo.updated_ts AS updated_ts`,
		`memo.row_status AS row_status`,
		`memo.visibility AS visibility`,
		`memo.pinned AS pinned`,
		`memo.payload AS payload`,
		`CASE WHEN parent_memo.uid IS NOT NULL THEN parent_memo.uid ELSE NULL END AS parent_uid`,
	}
	if !find.ExcludeContent {
		fields = append(fields, `memo.content AS content`)
	}

	query := `SELECT ` + strings.Join(fields, ", ") + `
		FROM memo
		LEFT JOIN memo_relation ON memo.id = memo_relation.memo_id AND memo_relation.type = 'COMMENT'
		LEFT JOIN memo AS parent_memo ON memo_relation.related_memo_id = parent_memo.id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY ` + strings.Join(orderBy, ", ")
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
		set, args = append(set, "uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "created_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "content = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "visibility = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Pinned; v != nil {
		set, args = append(set, "pinned = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Payload; v != nil {
		payloadBytes, err := protojson.Marshal(v)
		if err != nil {
			return err
		}
		set, args = append(set, "payload = "+placeholder(len(args)+1)), append(args, string(payloadBytes))
	}
	if len(set) == 0 {
		return nil
	}

	stmt := `UPDATE memo SET ` + strings.Join(set, ", ") + ` WHERE id = ` + placeholder(len(args)+1)
	args = append(args, update.ID)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	where, args := []string{"id = " + placeholder(1)}, []any{delete.ID}
	stmt := `DELETE FROM memo WHERE ` + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete memo")
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

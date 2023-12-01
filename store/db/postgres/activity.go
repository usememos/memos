package postgres

import (
	"context"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"google.golang.org/protobuf/encoding/protojson"
)

func (d *DB) CreateActivity(ctx context.Context, create *store.Activity) (*store.Activity, error) {
	payloadString := "{}"
	if create.Payload != nil {
		bytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal activity payload")
		}
		payloadString = string(bytes)
	}

	qb := squirrel.Insert("activity").
		Columns("creator_id", "type", "level", "payload").
		Values(create.CreatorID, create.Type.String(), create.Level.String(), payloadString).
		PlaceholderFormat(squirrel.Dollar)

	if create.ID != 0 {
		qb = qb.Columns("id").Values(create.ID)
	}

	if create.CreatedTs != 0 {
		qb = qb.Columns("created_ts").Values(create.CreatedTs) // Assuming created_ts is a timestamp
	}

	qb = qb.Suffix("RETURNING id")

	stmt, args, err := qb.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to construct query")
	}

	var id int32
	err = d.db.QueryRowContext(ctx, stmt, args...).Scan(&id)
	if err != nil {
		return nil, errors.Wrap(err, "failed to execute statement and retrieve ID")
	}

	list, err := d.ListActivities(ctx, &store.FindActivity{ID: &id})
	if err != nil || len(list) == 0 {
		return nil, errors.Wrap(err, "failed to find activity")
	}

	return list[0], nil
}

func (d *DB) ListActivities(ctx context.Context, find *store.FindActivity) ([]*store.Activity, error) {
	qb := squirrel.Select("id", "creator_id", "type", "level", "payload", "created_ts").
		From("activity").
		Where("1 = 1").
		PlaceholderFormat(squirrel.Dollar)

	if find.ID != nil {
		qb = qb.Where(squirrel.Eq{"id": *find.ID})
	}
	if find.Type != nil {
		qb = qb.Where(squirrel.Eq{"type": find.Type.String()})
	}

	query, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Activity{}
	for rows.Next() {
		activity := &store.Activity{}
		var payloadBytes []byte
		createdTsPlaceHolder := time.Time{}
		if err := rows.Scan(
			&activity.ID,
			&activity.CreatorID,
			&activity.Type,
			&activity.Level,
			&payloadBytes,
			&createdTsPlaceHolder,
		); err != nil {
			return nil, err
		}

		activity.CreatedTs = createdTsPlaceHolder.Unix()

		payload := &storepb.ActivityPayload{}
		if err := protojson.Unmarshal(payloadBytes, payload); err != nil {
			return nil, err
		}
		activity.Payload = payload
		list = append(list, activity)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUserSubscription(ctx context.Context, create *store.UserSubscription) (*store.UserSubscription, error) {
	stmt := `
		INSERT INTO subscription (
			follower_id,
			following_id
		)
		VALUES (?, ?)
	`
	result, err := d.db.ExecContext(ctx, stmt, create.FollowerID, create.FollowingID)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	subscription := &store.UserSubscription{
		ID:          int32(id),
		FollowerID:  create.FollowerID,
		FollowingID: create.FollowingID,
	}

	// Get the created_ts
	query := `SELECT created_ts FROM subscription WHERE id = ?`
	if err := d.db.QueryRowContext(ctx, query, id).Scan(&subscription.CreatedTs); err != nil {
		return nil, err
	}

	return subscription, nil
}

func (d *DB) ListUserSubscriptions(ctx context.Context, find *store.FindUserSubscription) ([]*store.UserSubscription, error) {
	where, args := []string{"TRUE"}, []any{}
	if find.FollowerID != nil {
		where, args = append(where, "follower_id = ?"), append(args, *find.FollowerID)
	}
	if find.FollowingID != nil {
		where, args = append(where, "following_id = ?"), append(args, *find.FollowingID)
	}

	query := `
		SELECT
			id,
			follower_id,
			following_id,
			created_ts
		FROM subscription
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC
	`

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.UserSubscription{}
	for rows.Next() {
		subscription := &store.UserSubscription{}
		if err := rows.Scan(
			&subscription.ID,
			&subscription.FollowerID,
			&subscription.FollowingID,
			&subscription.CreatedTs,
		); err != nil {
			return nil, err
		}
		list = append(list, subscription)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteUserSubscription(ctx context.Context, delete *store.DeleteUserSubscription) error {
	stmt := `DELETE FROM subscription WHERE follower_id = ? AND following_id = ?`
	_, err := d.db.ExecContext(ctx, stmt, delete.FollowerID, delete.FollowingID)
	return err
}

func (d *DB) GetUserSubscriptionCounts(ctx context.Context, userID int32) (*store.UserSubscriptionCounts, error) {
	counts := &store.UserSubscriptionCounts{}

	followerQuery := `SELECT COUNT(*) FROM subscription WHERE following_id = ?`
	if err := d.db.QueryRowContext(ctx, followerQuery, userID).Scan(&counts.FollowerCount); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	followingQuery := `SELECT COUNT(*) FROM subscription WHERE follower_id = ?`
	if err := d.db.QueryRowContext(ctx, followingQuery, userID).Scan(&counts.FollowingCount); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	return counts, nil
}

func (d *DB) IsUserFollowing(ctx context.Context, followerID, followingID int32) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM subscription WHERE follower_id = ? AND following_id = ?)`
	var exists bool
	if err := d.db.QueryRowContext(ctx, query, followerID, followingID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

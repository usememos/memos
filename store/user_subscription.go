package store

import (
	"context"
)

// UserSubscription represents a follow relationship between two users.
type UserSubscription struct {
	ID          int32
	FollowerID  int32 // The user who is following
	FollowingID int32 // The user being followed
	CreatedTs   int64
}

// FindUserSubscription is the query struct for finding user subscriptions.
type FindUserSubscription struct {
	FollowerID  *int32
	FollowingID *int32
}

// DeleteUserSubscription is the query struct for deleting a user subscription.
type DeleteUserSubscription struct {
	FollowerID  int32
	FollowingID int32
}

// UserSubscriptionCounts holds the follower and following counts for a user.
type UserSubscriptionCounts struct {
	FollowerCount  int32
	FollowingCount int32
}

// CreateUserSubscription creates a new subscription (follow relationship).
func (s *Store) CreateUserSubscription(ctx context.Context, create *UserSubscription) (*UserSubscription, error) {
	return s.driver.CreateUserSubscription(ctx, create)
}

// ListUserSubscriptions returns a list of subscriptions matching the query.
func (s *Store) ListUserSubscriptions(ctx context.Context, find *FindUserSubscription) ([]*UserSubscription, error) {
	return s.driver.ListUserSubscriptions(ctx, find)
}

// DeleteUserSubscription removes a subscription (unfollow).
func (s *Store) DeleteUserSubscription(ctx context.Context, delete *DeleteUserSubscription) error {
	return s.driver.DeleteUserSubscription(ctx, delete)
}

// GetUserSubscriptionCounts returns the follower and following counts for a user.
func (s *Store) GetUserSubscriptionCounts(ctx context.Context, userID int32) (*UserSubscriptionCounts, error) {
	return s.driver.GetUserSubscriptionCounts(ctx, userID)
}

// IsUserFollowing checks if followerID is following followingID.
func (s *Store) IsUserFollowing(ctx context.Context, followerID, followingID int32) (bool, error) {
	return s.driver.IsUserFollowing(ctx, followerID, followingID)
}

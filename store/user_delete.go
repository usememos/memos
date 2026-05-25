package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// DeleteUserFailpoint is a test-only hook for forcing a delete-user rollback.
type DeleteUserFailpoint string

const (
	// DeleteUserFailpointBeforeCommit aborts after all delete statements run but before commit.
	DeleteUserFailpointBeforeCommit DeleteUserFailpoint = "before_commit"
)

type deleteUserFailpointKey struct{}

// DeleteUserResult contains resources collected while deleting a user.
type DeleteUserResult struct {
	Attachments     []*Attachment
	UserSettingKeys []storepb.UserSetting_Key
}

// WithDeleteUserFailpoint is a test-only helper that forces DeleteUser to roll back.
func WithDeleteUserFailpoint(ctx context.Context, failpoint DeleteUserFailpoint) context.Context {
	return context.WithValue(ctx, deleteUserFailpointKey{}, failpoint)
}

// GetDeleteUserFailpoint returns the delete-user failpoint attached to ctx, if any.
func GetDeleteUserFailpoint(ctx context.Context) DeleteUserFailpoint {
	failpoint, ok := ctx.Value(deleteUserFailpointKey{}).(DeleteUserFailpoint)
	if !ok {
		return ""
	}
	return failpoint
}

func (s *Store) deleteUserCache(ctx context.Context, userID int32, result *DeleteUserResult) {
	s.userCache.Delete(ctx, userCacheKey(userID))
	if result == nil {
		return
	}
	for _, key := range result.UserSettingKeys {
		s.userSettingCache.Delete(ctx, getUserSettingCacheKey(userID, key.String()))
	}
}

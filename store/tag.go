package store

import (
	"context"
)

type Tag struct {
	ID        int32
	CreatedTs int64
	UpdatedTs int64
	CreatorID int32
	// TagHash is the hash of the tag name, used as unique identifier for the tag
	TagHash string
	// TagName is the original tag name
	TagName string
	// Emoji is the emoji for the tag, can be empty
	Emoji string
	// PinnedTs is the timestamp when the tag was pinned, nil means not pinned
	PinnedTs *int64
}

type FindTag struct {
	ID        *int32
	CreatorID *int32
	TagHash   *string
	TagName   *string
	// OnlyPinned filters only pinned tags, ordered by pinned_ts DESC
	OnlyPinned *bool
	// OnlyWithEmoji filters only tags that have emoji set
	OnlyWithEmoji *bool
}

type UpdateTag struct {
	TagHash   string
	CreatorID int32
	TagName   *string
	Emoji     *string
	PinnedTs  *int64
	// UpdatePinned indicates whether to update the pinned status
	// If true, PinnedTs value will be used (nil = unpin, non-nil = pin with timestamp)
	// If false, pinned status won't be changed
	UpdatePinned bool
}

// UpdateTag performs upsert operation: if tag doesn't exist, create it; if exists, update it.
func (s *Store) UpdateTag(ctx context.Context, update *UpdateTag) (*Tag, error) {
	return s.driver.UpdateTag(ctx, update)
}

// ListPinnedTags returns all pinned tags for a user, ordered by pinned time (newest first).
func (s *Store) ListPinnedTags(ctx context.Context, creatorID int32) ([]*Tag, error) {
	onlyPinned := true
	find := &FindTag{
		CreatorID:  &creatorID,
		OnlyPinned: &onlyPinned,
	}
	return s.driver.ListTags(ctx, find)
}

// ListTagsWithEmoji returns all tags that have emoji set for a user.
func (s *Store) ListTagsWithEmoji(ctx context.Context, creatorID int32) ([]*Tag, error) {
	onlyWithEmoji := true
	find := &FindTag{
		CreatorID:     &creatorID,
		OnlyWithEmoji: &onlyWithEmoji,
	}
	return s.driver.ListTags(ctx, find)
}

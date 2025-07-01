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
	// OnlyPinned filters only pinned tags
	OnlyPinned *bool
}

type UpdateTag struct {
	TagHash   string
	CreatorID int32
	TagName   *string
	Emoji     *string
	PinnedTs  *int64
}

// UpdateTag performs upsert operation: if tag doesn't exist, create it; if exists, update it
func (s *Store) UpdateTag(ctx context.Context, update *UpdateTag) (*Tag, error) {
	return s.driver.UpdateTag(ctx, update)
}

func (s *Store) GetTag(ctx context.Context, find *FindTag) (*Tag, error) {
	tags, err := s.driver.ListTags(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(tags) == 0 {
		return nil, nil
	}
	return tags[0], nil
}

func (s *Store) ListTags(ctx context.Context, find *FindTag) ([]*Tag, error) {
	return s.driver.ListTags(ctx, find)
}

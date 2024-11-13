package store

import (
	"context"
	"errors"

	"github.com/usememos/memos/internal/util"
)

type Nest struct {
	// ID is the system generated unique identifier for the memo.
	ID int32
	// Name is the user defined name for this nest.
	Name string

	// Standard fields
	RowStatus RowStatus
	CreatorID int32
	CreatedTs int64
}

type FindNest struct {
	ID   *int32
	Name *string

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int32
}

type UpdateNest struct {
	ID        int32
	Name      *string
	RowStatus *RowStatus
}

type DeleteNest struct {
	ID int32
}

func (s *Store) CreateNest(ctx context.Context, create *Nest) (*Nest, error) {
	if !util.UIDMatcher.MatchString(create.Name) {
		return nil, errors.New("invalid name")
	}
	return s.driver.CreateNest(ctx, create)
}

func (s *Store) ListNests(ctx context.Context, find *FindNest) ([]*Nest, error) {
	return s.driver.ListNests(ctx, find)
}

func (s *Store) GetNest(ctx context.Context, find *FindNest) (*Nest, error) {
	list, err := s.ListNests(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (s *Store) UpdateNest(ctx context.Context, update *UpdateNest) error {
	if update.Name != nil && !util.UIDMatcher.MatchString(*update.Name) {
		return errors.New("invalid uid")
	}
	return s.driver.UpdateNest(ctx, update)
}

func (s *Store) DeleteNest(ctx context.Context, delete *DeleteNest) error {
	return s.driver.DeleteNest(ctx, delete)
}

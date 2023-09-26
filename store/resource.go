package store

import (
	"context"
	"database/sql"
)

type Resource struct {
	ID int32

	// Standard fields
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Filename     string
	Blob         []byte
	InternalPath string
	ExternalLink string
	Type         string
	Size         int64

	// Related fields
	RelatedMemoID *int32
}

type FindResource struct {
	GetBlob        bool
	ID             *int32
	CreatorID      *int32
	Filename       *string
	MemoID         *int32
	HasRelatedMemo bool
	Limit          *int
	Offset         *int
}

type UpdateResource struct {
	ID           int32
	UpdatedTs    *int64
	Filename     *string
	InternalPath *string
	Blob         []byte
}

type DeleteResource struct {
	ID int32
}

func (s *Store) CreateResource(ctx context.Context, create *Resource) (*Resource, error) {
	return s.driver.CreateResource(ctx, create)
}

func (s *Store) ListResources(ctx context.Context, find *FindResource) ([]*Resource, error) {
	return s.driver.ListResources(ctx, find)
}

func (s *Store) GetResource(ctx context.Context, find *FindResource) (*Resource, error) {
	resources, err := s.ListResources(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(resources) == 0 {
		return nil, nil
	}

	return resources[0], nil
}

func (s *Store) UpdateResource(ctx context.Context, update *UpdateResource) (*Resource, error) {
	return s.driver.UpdateResource(ctx, update)
}

func (s *Store) DeleteResource(ctx context.Context, delete *DeleteResource) error {
	err := s.driver.DeleteResource(ctx, delete)
	if err != nil {
		return err
	}

	if err := s.Vacuum(ctx); err != nil {
		// Prevent linter warning.
		return err
	}
	return nil
}

func vacuumResource(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		resource 
	WHERE 
		creator_id NOT IN (
			SELECT 
				id 
			FROM 
				user
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}

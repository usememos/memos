package store

import (
	"context"
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
)

type Resource struct {
	// ID is the system generated unique identifier for the resource.
	ID int32
	// UID is the user defined unique identifier for the resource.
	UID string

	// Standard fields
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Filename    string
	Blob        []byte
	Type        string
	Size        int64
	StorageType storepb.ResourceStorageType
	Reference   string
	Payload     *storepb.ResourcePayload

	// The related memo ID.
	MemoID *int32
}

type FindResource struct {
	GetBlob        bool
	ID             *int32
	UID            *string
	CreatorID      *int32
	Filename       *string
	MemoID         *int32
	HasRelatedMemo bool
	Limit          *int
	Offset         *int
}

type UpdateResource struct {
	ID        int32
	UID       *string
	UpdatedTs *int64
	Filename  *string
	MemoID    *int32
}

type DeleteResource struct {
	ID     int32
	MemoID *int32
}

func (s *Store) CreateResource(ctx context.Context, create *Resource) (*Resource, error) {
	if !util.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
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

func (s *Store) UpdateResource(ctx context.Context, update *UpdateResource) error {
	if update.UID != nil && !util.UIDMatcher.MatchString(*update.UID) {
		return errors.New("invalid uid")
	}
	return s.driver.UpdateResource(ctx, update)
}

func (s *Store) DeleteResource(ctx context.Context, delete *DeleteResource) error {
	resource, err := s.GetResource(ctx, &FindResource{ID: &delete.ID})
	if err != nil {
		return errors.Wrap(err, "failed to get resource")
	}
	if resource == nil {
		return errors.Wrap(nil, "resource not found")
	}

	// Delete the local file.
	if resource.StorageType == storepb.ResourceStorageType_LOCAL {
		p := filepath.FromSlash(resource.Reference)
		if !filepath.IsAbs(p) {
			p = filepath.Join(s.Profile.Data, p)
		}
		_ = os.Remove(p)
	}

	return s.driver.DeleteResource(ctx, delete)
}

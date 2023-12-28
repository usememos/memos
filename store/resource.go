package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

const (
	// thumbnailImagePath is the directory to store image thumbnails.
	thumbnailImagePath = ".thumbnail_cache"
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
	MemoID       *int32
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
	MemoID       *int32
	Blob         []byte
}

type DeleteResource struct {
	ID     int32
	MemoID *int32
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
	resource, err := s.GetResource(ctx, &FindResource{ID: &delete.ID})
	if err != nil {
		return errors.Wrap(err, "failed to get resource")
	}
	if resource == nil {
		return errors.Wrap(nil, "resource not found")
	}

	// Delete the local file.
	if resource.InternalPath != "" {
		resourcePath := filepath.FromSlash(resource.InternalPath)
		if !filepath.IsAbs(resourcePath) {
			resourcePath = filepath.Join(s.Profile.Data, resourcePath)
		}
		_ = os.Remove(resourcePath)
	}
	// Delete the thumbnail.
	if util.HasPrefixes(resource.Type, "image/png", "image/jpeg") {
		ext := filepath.Ext(resource.Filename)
		thumbnailPath := filepath.Join(s.Profile.Data, thumbnailImagePath, fmt.Sprintf("%d%s", resource.ID, ext))
		_ = os.Remove(thumbnailPath)
	}
	return s.driver.DeleteResource(ctx, delete)
}

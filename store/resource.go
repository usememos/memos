package store

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/storage/s3"
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
	StorageType    *storepb.ResourceStorageType
	Limit          *int
	Offset         *int
}

type UpdateResource struct {
	ID        int32
	UID       *string
	UpdatedTs *int64
	Filename  *string
	MemoID    *int32
	Reference *string
	Payload   *storepb.ResourcePayload
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

	if resource.StorageType == storepb.ResourceStorageType_LOCAL {
		if err := func() error {
			p := filepath.FromSlash(resource.Reference)
			if !filepath.IsAbs(p) {
				p = filepath.Join(s.Profile.Data, p)
			}
			err := os.Remove(p)
			if err != nil {
				return errors.Wrap(err, "failed to delete local file")
			}
			return nil
		}(); err != nil {
			return errors.Wrap(err, "failed to delete local file")
		}
	} else if resource.StorageType == storepb.ResourceStorageType_S3 {
		if err := func() error {
			s3ObjectPayload := resource.Payload.GetS3Object()
			if s3ObjectPayload == nil {
				return errors.Errorf("No s3 object found")
			}
			workspaceStorageSetting, err := s.GetWorkspaceStorageSetting(ctx)
			if err != nil {
				return errors.Wrap(err, "failed to get workspace storage setting")
			}
			s3Config := s3ObjectPayload.S3Config
			if s3Config == nil {
				if workspaceStorageSetting.S3Config == nil {
					return errors.Errorf("S3 config is not found")
				}
				s3Config = workspaceStorageSetting.S3Config
			}

			s3Client, err := s3.NewClient(ctx, s3Config)
			if err != nil {
				return errors.Wrap(err, "Failed to create s3 client")
			}
			if err := s3Client.DeleteObject(ctx, s3ObjectPayload.Key); err != nil {
				return errors.Wrap(err, "Failed to delete s3 object")
			}
			return nil
		}(); err != nil {
			slog.Warn("Failed to delete s3 object", err)
		}
	}

	return s.driver.DeleteResource(ctx, delete)
}

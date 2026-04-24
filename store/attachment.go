package store

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/internal/storage/s3"
	storepb "github.com/usememos/memos/proto/gen/store"
)

type Attachment struct {
	// ID is the system generated unique identifier for the attachment.
	ID int32
	// UID is the user defined unique identifier for the attachment.
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
	StorageType storepb.AttachmentStorageType
	Reference   string
	Payload     *storepb.AttachmentPayload

	// The related memo ID.
	MemoID *int32

	// Composed field
	MemoUID *string
}

type FindAttachment struct {
	GetBlob        bool
	ID             *int32
	UID            *string
	CreatorID      *int32
	Filename       *string
	FilenameSearch *string
	MemoID         *int32
	MemoIDList     []int32
	HasRelatedMemo bool
	StorageType    *storepb.AttachmentStorageType
	Filters        []string
	Limit          *int
	Offset         *int
}

type UpdateAttachment struct {
	ID        int32
	UID       *string
	UpdatedTs *int64
	Filename  *string
	MemoID    *int32
	Reference *string
	Payload   *storepb.AttachmentPayload
}

type DeleteAttachment struct {
	ID     int32
	MemoID *int32
}

const (
	thumbnailCacheFolder = ".thumbnail_cache"
	motionCacheFolder    = ".motion_cache"
)

type deleteAttachmentStorageFailpointKey struct{}

// ErrDeleteAttachmentStorageFailpoint is returned by the test-only attachment storage failpoint.
var ErrDeleteAttachmentStorageFailpoint = errors.New("delete attachment storage failpoint")

// WithDeleteAttachmentStorageFailpoint forces DeleteAttachmentStorage to return a failpoint error.
func WithDeleteAttachmentStorageFailpoint(ctx context.Context) context.Context {
	return context.WithValue(ctx, deleteAttachmentStorageFailpointKey{}, true)
}

func (s *Store) CreateAttachment(ctx context.Context, create *Attachment) (*Attachment, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	return s.driver.CreateAttachment(ctx, create)
}

func (s *Store) ListAttachments(ctx context.Context, find *FindAttachment) ([]*Attachment, error) {
	// Set default limits to prevent loading too many attachments at once
	shouldApplyDefaultLimit := find.Limit == nil && len(find.MemoIDList) == 0
	if shouldApplyDefaultLimit && find.GetBlob {
		// When fetching blobs, we should be especially careful with limits
		defaultLimit := 10
		find.Limit = &defaultLimit
	} else if shouldApplyDefaultLimit {
		// Even without blobs, let's default to a reasonable limit
		defaultLimit := 100
		find.Limit = &defaultLimit
	}

	return s.driver.ListAttachments(ctx, find)
}

func (s *Store) GetAttachment(ctx context.Context, find *FindAttachment) (*Attachment, error) {
	attachments, err := s.ListAttachments(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(attachments) == 0 {
		return nil, nil
	}

	return attachments[0], nil
}

func (s *Store) UpdateAttachment(ctx context.Context, update *UpdateAttachment) error {
	if update.UID != nil && !base.UIDMatcher.MatchString(*update.UID) {
		return errors.New("invalid uid")
	}
	return s.driver.UpdateAttachment(ctx, update)
}

func (s *Store) DeleteAttachment(ctx context.Context, delete *DeleteAttachment) error {
	attachment, err := s.GetAttachment(ctx, &FindAttachment{ID: &delete.ID})
	if err != nil {
		return errors.Wrap(err, "failed to get attachment")
	}
	if attachment == nil {
		return errors.New("attachment not found")
	}

	if err := s.DeleteAttachmentStorage(ctx, attachment); err != nil {
		if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
			return errors.Wrap(err, "failed to delete local file")
		}
		slog.Warn("Failed to delete attachment storage", slog.Any("err", err))
	}

	return s.driver.DeleteAttachment(ctx, delete)
}

func (s *Store) DeleteAttachments(ctx context.Context, attachments []*Attachment) error {
	if len(attachments) == 0 {
		return nil
	}

	deletes := make([]*DeleteAttachment, 0, len(attachments))
	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}
		deletes = append(deletes, &DeleteAttachment{ID: attachment.ID, MemoID: attachment.MemoID})
	}
	if len(deletes) == 0 {
		return nil
	}

	if err := s.driver.DeleteAttachments(ctx, deletes); err != nil {
		return err
	}

	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}
		if err := s.DeleteAttachmentStorage(ctx, attachment); err != nil {
			if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
				return errors.Wrap(err, "failed to delete local file")
			}
			slog.Warn("Failed to delete attachment storage", slog.Any("err", err))
		}
	}

	return nil
}

func (s *Store) DeleteAttachmentStorage(ctx context.Context, attachment *Attachment) error {
	if attachment == nil {
		return nil
	}
	if shouldFailDeleteAttachmentStorage(ctx) {
		return ErrDeleteAttachmentStorageFailpoint
	}

	if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
		if err := func() error {
			p := filepath.FromSlash(attachment.Reference)
			if !filepath.IsAbs(p) {
				p = filepath.Join(s.profile.Data, p)
			}
			err := os.Remove(p)
			if err != nil && !os.IsNotExist(err) {
				return errors.Wrap(err, "failed to delete local file")
			}
			return nil
		}(); err != nil {
			return err
		}
	} else if attachment.StorageType == storepb.AttachmentStorageType_S3 {
		if err := func() error {
			s3ObjectPayload := attachment.Payload.GetS3Object()
			if s3ObjectPayload == nil {
				return errors.Errorf("No s3 object found")
			}
			instanceStorageSetting, err := s.GetInstanceStorageSetting(ctx)
			if err != nil {
				return errors.Wrap(err, "failed to get instance storage setting")
			}
			s3Config := s3ObjectPayload.S3Config
			if s3Config == nil {
				if instanceStorageSetting.S3Config == nil {
					return errors.Errorf("S3 config is not found")
				}
				s3Config = instanceStorageSetting.S3Config
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
			return err
		}
	}

	s.deleteAttachmentDerivedCaches(attachment)
	return nil
}

func (s *Store) deleteAttachmentDerivedCaches(attachment *Attachment) {
	for _, cachePath := range []string{
		filepath.Join(s.profile.Data, thumbnailCacheFolder, attachment.UID+".jpeg"),
		filepath.Join(s.profile.Data, motionCacheFolder, attachment.UID+".mp4"),
	} {
		if err := os.Remove(cachePath); err != nil && !os.IsNotExist(err) {
			slog.Warn("Failed to delete derived attachment cache", slog.String("path", cachePath), slog.Any("err", err))
		}
	}
}

func shouldFailDeleteAttachmentStorage(ctx context.Context) bool {
	failpoint, ok := ctx.Value(deleteAttachmentStorageFailpointKey{}).(bool)
	return ok && failpoint
}

package storage

import (
	"context"
	"io"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/storage/s3"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// Driver provides object operations for a configured attachment storage.
type Driver interface {
	UploadObject(ctx context.Context, key string, fileType string, content io.Reader) (string, error)
	PresignGetObject(ctx context.Context, key string) (string, error)
	GetObject(ctx context.Context, key string) ([]byte, error)
	GetObjectStream(ctx context.Context, key string) (io.ReadCloser, error)
	DeleteObject(ctx context.Context, key string) error
}

// NewDriver creates the driver for a configured storage.
func NewDriver(ctx context.Context, configuredStorage *storepb.Storage) (Driver, error) {
	if configuredStorage == nil {
		return nil, errors.New("storage is required")
	}
	switch configuredStorage.Type {
	case storepb.StorageType_STORAGE_TYPE_S3:
		if configuredStorage.GetS3Config() == nil {
			return nil, errors.Errorf("S3 config is missing for storage %q", configuredStorage.Id)
		}
		return s3.NewDriver(ctx, configuredStorage.GetS3Config())
	default:
		return nil, errors.Errorf("storage %q has unsupported driver type %s", configuredStorage.Id, configuredStorage.Type.String())
	}
}

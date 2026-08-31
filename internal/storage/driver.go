package storage

import (
	"context"
	"io"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/storage/s3"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// ErrRangeNotSatisfiable reports a ranged read whose byte range falls outside
// the object, so HTTP handlers can answer 416 instead of 500.
var ErrRangeNotSatisfiable = s3.ErrRangeNotSatisfiable

// RangeNotSatisfiableError carries response metadata for an unsatisfied range.
type RangeNotSatisfiableError = s3.RangeNotSatisfiableError

// ObjectStream is object content with the metadata needed to answer HTTP
// range requests. Aliased so driver consumers never import a concrete backend.
type ObjectStream = s3.ObjectStream

// Driver provides object operations for a configured attachment storage.
type Driver interface {
	UploadObject(ctx context.Context, key string, fileType string, content io.Reader) (string, error)
	GetObject(ctx context.Context, key string) ([]byte, error)
	// GetObjectStream streams an object; a non-empty byteRange is forwarded as
	// an HTTP Range header and yields a partial object. byteRange must request at
	// most one range because S3 does not support multipart range responses.
	GetObjectStream(ctx context.Context, key string, byteRange string) (*ObjectStream, error)
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

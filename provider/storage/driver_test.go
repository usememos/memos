package storage

import (
	"bytes"
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil/fakes3"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestNewDriver(t *testing.T) {
	ctx := context.Background()

	t.Run("creates S3 driver", func(t *testing.T) {
		fake := fakes3.New(t, "driver-factory")
		driver, err := NewDriver(ctx, &storepb.Storage{
			Id:     "s3-primary",
			Type:   storepb.StorageType_STORAGE_TYPE_S3,
			Config: &storepb.Storage_S3Config{S3Config: fake.Config("driver-factory")},
		})
		require.NoError(t, err)

		content := []byte("created through the storage driver factory")
		key, err := driver.UploadObject(ctx, "factory/object.txt", "text/plain", bytes.NewReader(content))
		require.NoError(t, err)
		downloaded, err := driver.GetObject(ctx, key)
		require.NoError(t, err)
		require.Equal(t, content, downloaded)
	})

	tests := []struct {
		name    string
		storage *storepb.Storage
		wantErr string
	}{
		{name: "missing storage", wantErr: "storage is required"},
		{
			name:    "missing S3 config",
			storage: &storepb.Storage{Id: "s3-missing", Type: storepb.StorageType_STORAGE_TYPE_S3},
			wantErr: `S3 config is missing for storage "s3-missing"`,
		},
		{
			name:    "unsupported storage type",
			storage: &storepb.Storage{Id: "local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL},
			wantErr: `storage "local" has unsupported driver type STORAGE_TYPE_LOCAL`,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			driver, err := NewDriver(ctx, test.storage)
			require.Nil(t, driver)
			require.EqualError(t, err, test.wantErr)
		})
	}
}

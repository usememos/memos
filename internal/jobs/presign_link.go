package jobs

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/plugin/storage/s3"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv2 "github.com/usememos/memos/server/route/api/v2"
	"github.com/usememos/memos/store"
)

// RunPreSignLinks is a background job that pre-signs external links stored in the database.
// It uses S3 client to generate presigned URLs and updates the corresponding resources in the store.
func RunPreSignLinks(ctx context.Context, dataStore *store.Store) {
	for {
		if err := signExternalLinks(ctx, dataStore); err != nil {
			slog.Error("failed to pre-sign links", err)
		} else {
			slog.Debug("pre-signed links")
		}
		select {
		case <-time.After(s3.LinkLifetime / 2):
		case <-ctx.Done():
			return
		}
	}
}

func signExternalLinks(ctx context.Context, dataStore *store.Store) error {
	const pageSize = 32

	objectStore, err := findObjectStorage(ctx, dataStore)
	if err != nil {
		return errors.Wrapf(err, "find object storage")
	}
	if objectStore == nil || !objectStore.Config.PreSign {
		// object storage not set or not supported
		return nil
	}

	var offset int
	var limit = pageSize
	for {
		resources, err := dataStore.ListResources(ctx, &store.FindResource{
			GetBlob: false,
			Limit:   &limit,
			Offset:  &offset,
		})
		if err != nil {
			return errors.Wrapf(err, "list resources, offset %d", offset)
		}

		for _, res := range resources {
			if res.ExternalLink == "" {
				// not for object store
				continue
			}
			if strings.Contains(res.ExternalLink, "?") && time.Since(time.Unix(res.UpdatedTs, 0)) < s3.LinkLifetime/2 {
				// resource not signed (hack for migration)
				// resource was recently updated - skipping
				continue
			}
			newLink, err := objectStore.PreSignLink(ctx, res.ExternalLink)
			if err != nil {
				slog.Error("failed to pre-sign link", err)
				continue // do not fail - we may want update left over links too
			}
			now := time.Now().Unix()
			// we may want to use here transaction and batch update in the future
			_, err = dataStore.UpdateResource(ctx, &store.UpdateResource{
				ID:           res.ID,
				UpdatedTs:    &now,
				ExternalLink: &newLink,
			})
			if err != nil {
				// something with DB - better to stop here
				return errors.Wrapf(err, "update resource %d link to %q", res.ID, newLink)
			}
		}

		offset += limit
		if len(resources) < limit {
			break
		}
	}
	return nil
}

// findObjectStorage returns current default storage if it's S3-compatible or nil otherwise.
// Returns error only in case of internal problems (ie: database or configuration issues).
// May return nil client and nil error.
func findObjectStorage(ctx context.Context, dataStore *store.Store) (*s3.Client, error) {
	workspaceStorageSetting, err := dataStore.GetWorkspaceStorageSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to find workspaceStorageSetting")
	}
	if workspaceStorageSetting.StorageType != storepb.WorkspaceStorageSetting_STORAGE_TYPE_EXTERNAL || workspaceStorageSetting.ActivedExternalStorageId == nil {
		return nil, nil
	}
	storage, err := dataStore.GetStorageV1(ctx, &store.FindStorage{ID: workspaceStorageSetting.ActivedExternalStorageId})
	if err != nil {
		return nil, errors.Wrap(err, "Failed to find storage")
	}
	if storage == nil {
		return nil, nil
	}

	storageMessage := apiv2.ConvertStorageFromStore(storage)
	if storageMessage.Type != apiv2pb.Storage_S3 {
		return nil, nil
	}

	s3Config := storageMessage.Config.GetS3Config()
	return s3.NewClient(ctx, &s3.Config{
		AccessKey: s3Config.AccessKey,
		SecretKey: s3Config.SecretKey,
		EndPoint:  s3Config.EndPoint,
		Region:    s3Config.Region,
		Bucket:    s3Config.Bucket,
		URLPrefix: s3Config.UrlPrefix,
		URLSuffix: s3Config.UrlSuffix,
		PreSign:   s3Config.PreSign,
	})
}

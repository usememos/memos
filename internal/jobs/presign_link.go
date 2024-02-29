package jobs

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/plugin/storage/s3"
	apiv1 "github.com/usememos/memos/server/route/api/v1"
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
	systemSettingStorageServiceID, err := dataStore.GetWorkspaceSetting(ctx, &store.FindWorkspaceSetting{Name: apiv1.SystemSettingStorageServiceIDName.String()})
	if err != nil {
		return nil, errors.Wrap(err, "Failed to find SystemSettingStorageServiceIDName")
	}

	storageServiceID := apiv1.DefaultStorage
	if systemSettingStorageServiceID != nil {
		err = json.Unmarshal([]byte(systemSettingStorageServiceID.Value), &storageServiceID)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to unmarshal storage service id")
		}
	}
	storage, err := dataStore.GetStorage(ctx, &store.FindStorage{ID: &storageServiceID})
	if err != nil {
		return nil, errors.Wrap(err, "Failed to find StorageServiceID")
	}

	if storage == nil {
		return nil, nil // storage not configured - not an error, just return empty ref
	}
	storageMessage, err := apiv1.ConvertStorageFromStore(storage)

	if err != nil {
		return nil, errors.Wrap(err, "Failed to ConvertStorageFromStore")
	}
	if storageMessage.Type != apiv1.StorageS3 {
		return nil, nil
	}

	s3Config := storageMessage.Config.S3Config
	return s3.NewClient(ctx, &s3.Config{
		AccessKey: s3Config.AccessKey,
		SecretKey: s3Config.SecretKey,
		EndPoint:  s3Config.EndPoint,
		Region:    s3Config.Region,
		Bucket:    s3Config.Bucket,
		URLPrefix: s3Config.URLPrefix,
		URLSuffix: s3Config.URLSuffix,
		PreSign:   s3Config.PreSign,
	})
}

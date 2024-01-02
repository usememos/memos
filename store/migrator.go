package store

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/pkg/errors"
)

// MigrateResourceInternalPath migrates resource internal path from absolute path to relative path.
func (s *Store) MigrateResourceInternalPath(ctx context.Context) error {
	resources, err := s.ListResources(ctx, &FindResource{})
	if err != nil {
		return errors.Wrap(err, "failed to list resources")
	}

	for _, resource := range resources {
		if resource.InternalPath == "" {
			continue
		}

		internalPath := resource.InternalPath
		if filepath.IsAbs(internalPath) {
			if !strings.HasPrefix(internalPath, s.Profile.Data) {
				// Invalid internal path, skip.
				continue
			}
			internalPath = strings.TrimPrefix(internalPath, s.Profile.Data)
			for strings.HasPrefix(internalPath, "/") {
				internalPath = strings.TrimPrefix(internalPath, "/")
			}
			_, err := s.UpdateResource(ctx, &UpdateResource{
				ID:           resource.ID,
				InternalPath: &internalPath,
			})
			if err != nil {
				return errors.Wrap(err, "failed to update resource")
			}
		}
	}

	return nil
}

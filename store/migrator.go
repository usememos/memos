package store

import (
	"context"
	"fmt"
	"os"
	"time"

	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/log"
)

// MigrateResourceInternalPath migrates resource internal path from absolute path to relative path.
func (s *Store) MigrateResourceInternalPath(ctx context.Context) error {
	resources, err := s.ListResources(ctx, &FindResource{})
	if err != nil {
		return errors.Wrap(err, "failed to list resources")
	}

	dataPath := strings.ReplaceAll(s.Profile.Data, `\`, "/")
	migrateStartTime := time.Now()
	migratedCount := 0
	for _, resource := range resources {
		if resource.InternalPath == "" {
			continue
		}

		internalPath := strings.ReplaceAll(resource.InternalPath, `\`, "/")
		if !strings.HasPrefix(internalPath, dataPath) {
			continue
		}

		internalPath = strings.TrimPrefix(internalPath, dataPath)

		for os.IsPathSeparator(internalPath[0]) {
			internalPath = internalPath[1:]
		}

		_, err := s.UpdateResource(ctx, &UpdateResource{
			ID:           resource.ID,
			InternalPath: &internalPath,
		})
		if err != nil {
			return errors.Wrap(err, "failed to update local resource path")
		}
		migratedCount++
	}

	if migratedCount > 0 && s.Profile.Mode == "prod" {
		log.Info(fmt.Sprintf("migrated %d local resource paths in %s", migratedCount, time.Since(migrateStartTime)))
	}
	return nil
}

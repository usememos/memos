package store

import (
	"context"
	"fmt"
	"os"
	"time"

	"strings"

	"github.com/lithammer/shortuuid/v4"
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

// MigrateResourceName migrates resource name from other format to short UUID.
func (s *Store) MigrateResourceName(ctx context.Context) error {
	memos, err := s.ListMemos(ctx, &FindMemo{})
	if err != nil {
		return errors.Wrap(err, "failed to list memos")
	}
	for _, memo := range memos {
		if checkResourceName(memo.ResourceName) {
			continue
		}

		resourceName := shortuuid.New()
		err := s.UpdateMemo(ctx, &UpdateMemo{
			ID:           memo.ID,
			ResourceName: &resourceName,
		})
		if err != nil {
			return errors.Wrap(err, "failed to update memo")
		}
	}

	resources, err := s.ListResources(ctx, &FindResource{})
	if err != nil {
		return errors.Wrap(err, "failed to list resources")
	}
	for _, resource := range resources {
		if checkResourceName(resource.ResourceName) {
			continue
		}

		resourceName := shortuuid.New()
		_, err := s.UpdateResource(ctx, &UpdateResource{
			ID:           resource.ID,
			ResourceName: &resourceName,
		})
		if err != nil {
			return errors.Wrap(err, "failed to update resource")
		}
	}

	return nil
}

func checkResourceName(resourceName string) bool {
	// 22 is the length of shortuuid.
	if len(resourceName) != 22 {
		return false
	}
	for _, c := range resourceName {
		if c >= '0' && c <= '9' {
			continue
		}
		if c >= 'a' && c <= 'z' {
			continue
		}
		if c >= 'A' && c <= 'Z' {
			continue
		}
		return false
	}
	return true
}

package store

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/log"
)

// MigrateResourceInternalPath migrates resource internal path from absolute path to relative path.
func (s *Store) MigrateResourceInternalPath(ctx context.Context) error {
	normalizedDataPath := strings.ReplaceAll(s.Profile.Data, `\`, "/")
	normalizedDataPath = strings.ReplaceAll(normalizedDataPath, `//`, "/")

	db := s.driver.GetDB()
	checkStmt := `
		SELECT id FROM resource 
		WHERE 
			internal_path LIKE ?
			OR internal_path LIKE ?
			OR internal_path LIKE ?
		LIMIT 1`
	rows := 0
	res := db.QueryRowContext(ctx, checkStmt, fmt.Sprintf("%s%%", s.Profile.Data), fmt.Sprintf("%s%%", normalizedDataPath), "%\\%")
	if err := res.Scan(&rows); err != nil {
		if rows == 0 || err == sql.ErrNoRows {
			log.Debug("Resource internal path migration is not required.")
			return nil
		} else {
			return errors.Wrap(err, "failed to check resource internal_path")
		}
	}

	log.Info("Migrating resource internal paths. This may take a while.")

	listResourcesStmt := `
		SELECT id, internal_path FROM resource
		WHERE
			internal_path IS NOT ''
			AND internal_path LIKE ?
			OR internal_path LIKE ?
	`
	resources, err := db.QueryContext(ctx, listResourcesStmt, fmt.Sprintf("%s%%", s.Profile.Data), fmt.Sprintf("%s%%", normalizedDataPath))
	if err != nil || resources.Err() != nil {
		return errors.Wrap(err, "failed to list resources")
	}
	defer resources.Close()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()

	updateStmt := `UPDATE resource SET internal_path = ? WHERE id = ?`
	preparedResourceUpdate, err := tx.PrepareContext(ctx, updateStmt)
	if err != nil {
		return errors.Wrap(err, "failed to prepare update statement")
	}
	defer preparedResourceUpdate.Close()

	migrateStartTime := time.Now()
	migratedCount := 0
	for resources.Next() {
		resource := Resource{}
		if err := resources.Scan(&resource.ID, &resource.InternalPath); err != nil {
			return errors.Wrap(err, "failed to parse resource data")
		}

		if resource.InternalPath == "" {
			continue
		}

		internalPath := strings.ReplaceAll(resource.InternalPath, `\`, "/")
		if !strings.HasPrefix(internalPath, normalizedDataPath) {
			continue
		}

		internalPath = strings.TrimPrefix(internalPath, normalizedDataPath)

		for os.IsPathSeparator(internalPath[0]) {
			internalPath = internalPath[1:]
		}

		_, err := preparedResourceUpdate.ExecContext(ctx, internalPath, resource.ID)
		if err != nil {
			return errors.Wrap(err, "failed to update resource internal_path")
		}

		if migratedCount%500 == 0 {
			log.Info(fmt.Sprintf("[Running] Migrated %d local resource paths", migratedCount))
		}

		migratedCount++
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit transaction")
	}

	if migratedCount > 0 {
		log.Info(fmt.Sprintf("Migrated %d local resource paths in %s", migratedCount, time.Since(migrateStartTime)))
	}
	return nil
}

// MigrateResourceName migrates resource name from other format to short UUID.
func (s *Store) MigrateResourceName(ctx context.Context) error {
	db := s.driver.GetDB()

	checkStmt := `
		SELECT resource_name FROM resource 
		WHERE 
			resource_name = ''
		LIMIT 1`
	rows := 0
	res := db.QueryRowContext(ctx, checkStmt)
	if err := res.Scan(&rows); err != nil {
		if rows == 0 || err == sql.ErrNoRows {
			log.Debug("Resource migration to UUIDs is not required.")
			return nil
		} else {
			return errors.Wrap(err, "failed to check resource.resource_name")
		}
	}

	log.Info("Migrating resource IDs to UUIDs. This may take a while.")

	listResourceStmt := "SELECT `id`, `resource_name` FROM `resource` WHERE `resource_name` = ''"
	resources, err := db.QueryContext(ctx, listResourceStmt)
	if err != nil || resources.Err() != nil {
		return errors.Wrap(err, "failed to list resources")
	}
	defer resources.Close()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()

	updateResourceStmt := "UPDATE `resource` SET `resource_name` = ? WHERE `id` = ?"
	preparedResourceUpdate, err := tx.PrepareContext(ctx, updateResourceStmt)
	if err != nil {
		return errors.Wrap(err, "failed to prepare update statement")
	}
	defer preparedResourceUpdate.Close()

	migrateStartTime := time.Now()
	migratedCount := 0
	for resources.Next() {
		resource := Resource{}
		if err := resources.Scan(&resource.ID, &resource.ResourceName); err != nil {
			return errors.Wrap(err, "failed to parse resource data")
		}

		if checkResourceName(resource.ResourceName) {
			continue
		}

		resourceName := shortuuid.New()
		if _, err := preparedResourceUpdate.ExecContext(ctx, resourceName, resource.ID); err != nil {
			return errors.Wrap(err, "failed to update resource")
		}

		if migratedCount%500 == 0 {
			log.Info(fmt.Sprintf("[Running] Migrated %d local resources IDs", migratedCount))
		}
		migratedCount++
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit transaction")
	}

	if migratedCount > 0 {
		log.Info(fmt.Sprintf("Migrated %d resource IDs to UUIDs in %s", migratedCount, time.Since(migrateStartTime)))
	}
	return nil
}

// MigrateResourceName migrates memo name from other format to short UUID.
func (s *Store) MigrateMemoName(ctx context.Context) error {
	db := s.driver.GetDB()

	checkStmt := `
		SELECT resource_name FROM memo 
		WHERE 
			resource_name = ''
		LIMIT 1`
	rows := 0
	res := db.QueryRowContext(ctx, checkStmt)
	if err := res.Scan(&rows); err != nil {
		if rows == 0 || err == sql.ErrNoRows {
			log.Debug("Memo migration to UUIDs is not required.")
			return nil
		} else {
			return errors.Wrap(err, "failed to check memo.resource_name")
		}
	}

	log.Info("Migrating memo ids to uuids. This may take a while.")

	listMemoStmt := "SELECT `id`, `resource_name` FROM `memo` WHERE `resource_name` = ''"
	memos, err := db.QueryContext(ctx, listMemoStmt)
	if err != nil || memos.Err() != nil {
		return errors.Wrap(err, "failed to list memos")
	}
	defer memos.Close()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()

	updateMemoStmt := "UPDATE `memo` SET `resource_name` = ? WHERE `id` = ?"
	preparedMemoUpdate, err := tx.PrepareContext(ctx, updateMemoStmt)
	if err != nil {
		return errors.Wrap(err, "failed to prepare update statement")
	}
	defer preparedMemoUpdate.Close()

	migrateStartTime := time.Now()
	migratedCount := 0
	for memos.Next() {
		memo := Memo{}
		if err := memos.Scan(&memo.ID, &memo.ResourceName); err != nil {
			return errors.Wrap(err, "failed to parse memo data")
		}

		if checkResourceName(memo.ResourceName) {
			continue
		}

		resourceName := shortuuid.New()
		if _, err := preparedMemoUpdate.ExecContext(ctx, resourceName, memo.ID); err != nil {
			return errors.Wrap(err, "failed to update memo")
		}

		if migratedCount%500 == 0 {
			log.Info(fmt.Sprintf("[Running] Migrated %d local resources IDs", migratedCount))
		}
		migratedCount++
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit transaction")
	}

	if migratedCount > 0 {
		log.Info(fmt.Sprintf("Migrated %d memo ids to uuids in %s", migratedCount, time.Since(migrateStartTime)))
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

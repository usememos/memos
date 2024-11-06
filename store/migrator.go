package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/version"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

const (
	// MigrateFileNameSplit is the split character between the patch version and the description in the migration file name.
	// For example, "1__create_table.sql".
	MigrateFileNameSplit = "__"
	// LatestSchemaFileName is the name of the latest schema file.
	// This file is used to apply the latest schema when no migration history is found.
	LatestSchemaFileName = "LATEST.sql"
)

// Migrate applies the latest schema to the database.
func (s *Store) Migrate(ctx context.Context) error {
	if err := s.preMigrate(ctx); err != nil {
		return errors.Wrap(err, "failed to pre-migrate")
	}

	if s.Profile.Mode == "prod" {
		migrationHistoryList, err := s.driver.FindMigrationHistoryList(ctx, &FindMigrationHistory{})
		if err != nil {
			return errors.Wrap(err, "failed to find migration history")
		}
		if len(migrationHistoryList) == 0 {
			return errors.Errorf("no migration history found")
		}

		migrationHistoryVersions := []string{}
		for _, migrationHistory := range migrationHistoryList {
			migrationHistoryVersions = append(migrationHistoryVersions, migrationHistory.Version)
		}
		sort.Sort(version.SortVersion(migrationHistoryVersions))
		latestMigrationHistoryVersion := migrationHistoryVersions[len(migrationHistoryVersions)-1]
		schemaVersion, err := s.GetCurrentSchemaVersion()
		if err != nil {
			return errors.Wrap(err, "failed to get current schema version")
		}

		if version.IsVersionGreaterThan(schemaVersion, latestMigrationHistoryVersion) {
			filePaths, err := fs.Glob(migrationFS, fmt.Sprintf("%s*/*.sql", s.getMigrationBasePath()))
			if err != nil {
				return errors.Wrap(err, "failed to read migration files")
			}
			sort.Strings(filePaths)

			// Start a transaction to apply the latest schema.
			tx, err := s.driver.GetDB().Begin()
			if err != nil {
				return errors.Wrap(err, "failed to start transaction")
			}
			defer tx.Rollback()

			slog.Info("start migration", slog.String("currentSchemaVersion", latestMigrationHistoryVersion), slog.String("targetSchemaVersion", schemaVersion))
			for _, filePath := range filePaths {
				fileSchemaVersion, err := s.getSchemaVersionOfMigrateScript(filePath)
				if err != nil {
					return errors.Wrap(err, "failed to get schema version of migrate script")
				}
				if version.IsVersionGreaterThan(fileSchemaVersion, latestMigrationHistoryVersion) && version.IsVersionGreaterOrEqualThan(schemaVersion, fileSchemaVersion) {
					bytes, err := migrationFS.ReadFile(filePath)
					if err != nil {
						return errors.Wrapf(err, "failed to read minor version migration file: %s", filePath)
					}
					stmt := string(bytes)
					if err := s.execute(ctx, tx, stmt); err != nil {
						return errors.Wrapf(err, "migrate error: %s", stmt)
					}
				}
			}

			if err := tx.Commit(); err != nil {
				return errors.Wrap(err, "failed to commit transaction")
			}
			slog.Info("end migrate")

			// Upsert the current schema version to migration_history.
			// TODO: retire using migration history later.
			if _, err = s.driver.UpsertMigrationHistory(ctx, &UpsertMigrationHistory{
				Version: schemaVersion,
			}); err != nil {
				return errors.Wrapf(err, "failed to upsert migration history with version: %s", schemaVersion)
			}
			if err := s.updateCurrentSchemaVersion(ctx, schemaVersion); err != nil {
				return errors.Wrap(err, "failed to update current schema version")
			}
		}
	} else if s.Profile.Mode == "demo" {
		// In demo mode, we should seed the database.
		if err := s.seed(ctx); err != nil {
			return errors.Wrap(err, "failed to seed")
		}
	}
	return nil
}

func (s *Store) preMigrate(ctx context.Context) error {
	// TODO: using schema version in basic setting instead of migration history.
	migrationHistoryList, err := s.driver.FindMigrationHistoryList(ctx, &FindMigrationHistory{})
	// If any error occurs or no migration history found, apply the latest schema.
	if err != nil || len(migrationHistoryList) == 0 {
		if err != nil {
			slog.Warn("failed to find migration history in pre-migrate", slog.String("error", err.Error()))
		}
		filePath := s.getMigrationBasePath() + LatestSchemaFileName
		bytes, err := migrationFS.ReadFile(filePath)
		if err != nil {
			return errors.Errorf("failed to read latest schema file: %s", err)
		}
		schemaVersion, err := s.GetCurrentSchemaVersion()
		if err != nil {
			return errors.Wrap(err, "failed to get current schema version")
		}

		// Start a transaction to apply the latest schema.
		tx, err := s.driver.GetDB().Begin()
		if err != nil {
			return errors.Wrap(err, "failed to start transaction")
		}
		defer tx.Rollback()
		if err := s.execute(ctx, tx, string(bytes)); err != nil {
			return errors.Errorf("failed to execute SQL file %s, err %s", filePath, err)
		}
		if err := tx.Commit(); err != nil {
			return errors.Wrap(err, "failed to commit transaction")
		}

		// TODO: using schema version in basic setting instead of migration history.
		if _, err := s.driver.UpsertMigrationHistory(ctx, &UpsertMigrationHistory{
			Version: schemaVersion,
		}); err != nil {
			return errors.Wrap(err, "failed to upsert migration history")
		}
		if err := s.updateCurrentSchemaVersion(ctx, schemaVersion); err != nil {
			return errors.Wrap(err, "failed to update current schema version")
		}
	}
	if s.Profile.Mode == "prod" {
		if err := s.normalizedMigrationHistoryList(ctx); err != nil {
			return errors.Wrap(err, "failed to normalize migration history list")
		}
	}
	return nil
}

func (s *Store) getMigrationBasePath() string {
	mode := "dev"
	if s.Profile.Mode == "prod" {
		mode = "prod"
	}
	return fmt.Sprintf("migration/%s/%s/", s.Profile.Driver, mode)
}

func (s *Store) getSeedBasePath() string {
	return fmt.Sprintf("seed/%s/", s.Profile.Driver)
}

func (s *Store) seed(ctx context.Context) error {
	// Only seed for SQLite.
	if s.Profile.Driver != "sqlite" {
		slog.Warn("seed is only supported for SQLite")
		return nil
	}

	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s*.sql", s.getSeedBasePath()))
	if err != nil {
		return errors.Wrap(err, "failed to read seed files")
	}

	// Sort seed files by name. This is important to ensure that seed files are applied in order.
	sort.Strings(filenames)
	// Start a transaction to apply the seed files.
	tx, err := s.driver.GetDB().Begin()
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()
	// Loop over all seed files and execute them in order.
	for _, filename := range filenames {
		bytes, err := seedFS.ReadFile(filename)
		if err != nil {
			return errors.Wrapf(err, "failed to read seed file, filename=%s", filename)
		}
		if err := s.execute(ctx, tx, string(bytes)); err != nil {
			return errors.Wrapf(err, "seed error: %s", filename)
		}
	}
	return tx.Commit()
}

func (s *Store) GetCurrentSchemaVersion() (string, error) {
	currentVersion := version.GetCurrentVersion(s.Profile.Mode)
	minorVersion := version.GetMinorVersion(currentVersion)
	filePaths, err := fs.Glob(migrationFS, fmt.Sprintf("%s%s/*.sql", s.getMigrationBasePath(), minorVersion))
	if err != nil {
		return "", errors.Wrap(err, "failed to read migration files")
	}

	sort.Strings(filePaths)
	if len(filePaths) == 0 {
		return fmt.Sprintf("%s.0", minorVersion), nil
	}
	return s.getSchemaVersionOfMigrateScript(filePaths[len(filePaths)-1])
}

func (s *Store) getSchemaVersionOfMigrateScript(filePath string) (string, error) {
	// If the file is the latest schema file, return the current schema version.
	if strings.HasSuffix(filePath, LatestSchemaFileName) {
		return s.GetCurrentSchemaVersion()
	}

	normalizedPath := filepath.ToSlash(filePath)
	elements := strings.Split(normalizedPath, "/")
	if len(elements) < 2 {
		return "", errors.Errorf("invalid file path: %s", filePath)
	}
	minorVersion := elements[len(elements)-2]
	rawPatchVersion := strings.Split(elements[len(elements)-1], MigrateFileNameSplit)[0]
	patchVersion, err := strconv.Atoi(rawPatchVersion)
	if err != nil {
		return "", errors.Wrapf(err, "failed to convert patch version to int: %s", rawPatchVersion)
	}
	return fmt.Sprintf("%s.%d", minorVersion, patchVersion+1), nil
}

// execute runs a single SQL statement within a transaction.
func (*Store) execute(ctx context.Context, tx *sql.Tx, stmt string) error {
	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return errors.Wrap(err, "failed to execute statement")
	}
	return nil
}

func (s *Store) normalizedMigrationHistoryList(ctx context.Context) error {
	migrationHistoryList, err := s.driver.FindMigrationHistoryList(ctx, &FindMigrationHistory{})
	if err != nil {
		return errors.Wrap(err, "failed to find migration history")
	}
	versions := []string{}
	for _, migrationHistory := range migrationHistoryList {
		versions = append(versions, migrationHistory.Version)
	}
	sort.Sort(version.SortVersion(versions))
	latestVersion := versions[len(versions)-1]
	latestMinorVersion := version.GetMinorVersion(latestVersion)

	// If the latest version is greater than 0.22, return.
	// As of 0.22, the migration history is already normalized.
	if version.IsVersionGreaterThan(latestMinorVersion, "0.22") {
		return nil
	}

	schemaVersionMap := map[string]string{}
	filePaths, err := fs.Glob(migrationFS, fmt.Sprintf("%s*/*.sql", s.getMigrationBasePath()))
	if err != nil {
		return errors.Wrap(err, "failed to read migration files")
	}
	sort.Strings(filePaths)
	for _, filePath := range filePaths {
		fileSchemaVersion, err := s.getSchemaVersionOfMigrateScript(filePath)
		if err != nil {
			return errors.Wrap(err, "failed to get schema version of migrate script")
		}
		schemaVersionMap[version.GetMinorVersion(fileSchemaVersion)] = fileSchemaVersion
	}

	latestSchemaVersion := schemaVersionMap[latestMinorVersion]
	if latestSchemaVersion == "" {
		return errors.Errorf("latest schema version not found")
	}
	if version.IsVersionGreaterOrEqualThan(latestVersion, latestSchemaVersion) {
		return nil
	}

	// Start a transaction to insert the latest schema version to migration_history.
	tx, err := s.driver.GetDB().Begin()
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()
	if err := s.execute(ctx, tx, fmt.Sprintf("INSERT INTO migration_history (version) VALUES ('%s')", latestSchemaVersion)); err != nil {
		return errors.Wrap(err, "failed to insert migration history")
	}
	return tx.Commit()
}

func (s *Store) updateCurrentSchemaVersion(ctx context.Context, schemaVersion string) error {
	workspaceBasicSetting, err := s.GetWorkspaceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get workspace basic setting")
	}
	workspaceBasicSetting.SchemaVersion = schemaVersion
	if _, err := s.UpsertWorkspaceSetting(ctx, &storepb.WorkspaceSetting{
		Key:   storepb.WorkspaceSettingKey_BASIC,
		Value: &storepb.WorkspaceSetting_BasicSetting{BasicSetting: workspaceBasicSetting},
	}); err != nil {
		return errors.Wrap(err, "failed to upsert workspace setting")
	}
	return nil
}

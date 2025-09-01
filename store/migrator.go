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

	"github.com/usememos/memos/internal/version"
	storepb "github.com/usememos/memos/proto/gen/store"
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

// Migrate migrates the database schema to the latest version.
// It checks the current schema version and applies any necessary migrations.
// It also seeds the database with initial data if in demo mode.
func (s *Store) Migrate(ctx context.Context) error {
	if err := s.preMigrate(ctx); err != nil {
		return errors.Wrap(err, "failed to pre-migrate")
	}

	switch s.profile.Mode {
	case "prod":
		workspaceBasicSetting, err := s.GetWorkspaceBasicSetting(ctx)
		if err != nil {
			return errors.Wrap(err, "failed to get workspace basic setting")
		}
		currentSchemaVersion, err := s.GetCurrentSchemaVersion()
		if err != nil {
			return errors.Wrap(err, "failed to get current schema version")
		}
		if version.IsVersionGreaterThan(workspaceBasicSetting.SchemaVersion, currentSchemaVersion) {
			slog.Error("cannot downgrade schema version",
				slog.String("databaseVersion", workspaceBasicSetting.SchemaVersion),
				slog.String("currentVersion", currentSchemaVersion),
			)
			return errors.Errorf("cannot downgrade schema version from %s to %s", workspaceBasicSetting.SchemaVersion, currentSchemaVersion)
		}
		if version.IsVersionGreaterThan(currentSchemaVersion, workspaceBasicSetting.SchemaVersion) {
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

			slog.Info("start migration", slog.String("currentSchemaVersion", workspaceBasicSetting.SchemaVersion), slog.String("targetSchemaVersion", currentSchemaVersion))
			for _, filePath := range filePaths {
				fileSchemaVersion, err := s.getSchemaVersionOfMigrateScript(filePath)
				if err != nil {
					return errors.Wrap(err, "failed to get schema version of migrate script")
				}
				if version.IsVersionGreaterThan(fileSchemaVersion, workspaceBasicSetting.SchemaVersion) && version.IsVersionGreaterOrEqualThan(currentSchemaVersion, fileSchemaVersion) {
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
			if err := s.updateCurrentSchemaVersion(ctx, currentSchemaVersion); err != nil {
				return errors.Wrap(err, "failed to update current schema version")
			}
		}
	case "demo":
		// In demo mode, we should seed the database.
		if err := s.seed(ctx); err != nil {
			return errors.Wrap(err, "failed to seed")
		}
	default:
		// For other modes (like dev), no special migration handling needed
	}
	return nil
}

// preMigrate checks if the database is initialized and applies the latest schema if not.
func (s *Store) preMigrate(ctx context.Context) error {
	initialized, err := s.driver.IsInitialized(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to check if database is initialized")
	}

	if !initialized {
		filePath := s.getMigrationBasePath() + LatestSchemaFileName
		bytes, err := migrationFS.ReadFile(filePath)
		if err != nil {
			return errors.Errorf("failed to read latest schema file: %s", err)
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

		// Upsert current schema version to database.
		schemaVersion, err := s.GetCurrentSchemaVersion()
		if err != nil {
			return errors.Wrap(err, "failed to get current schema version")
		}
		if err := s.updateCurrentSchemaVersion(ctx, schemaVersion); err != nil {
			return errors.Wrap(err, "failed to update current schema version")
		}
	}

	if s.profile.Mode == "prod" {
		if err := s.normalizeMigrationHistoryList(ctx); err != nil {
			return errors.Wrap(err, "failed to normalize migration history list")
		}
		if err := s.migrateSchemaVersionToSetting(ctx); err != nil {
			return errors.Wrap(err, "failed to migrate schema version to setting")
		}
	}
	return nil
}

func (s *Store) getMigrationBasePath() string {
	return fmt.Sprintf("migration/%s/", s.profile.Driver)
}

func (s *Store) getSeedBasePath() string {
	return fmt.Sprintf("seed/%s/", s.profile.Driver)
}

// seed seeds the database with initial data.
// It reads all seed files from the embedded filesystem and executes them in order.
// This is only supported for SQLite databases.
func (s *Store) seed(ctx context.Context) error {
	// Only seed for SQLite.
	if s.profile.Driver != "sqlite" {
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
	currentVersion := version.GetCurrentVersion(s.profile.Mode)
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

// getSchemaVersionOfMigrateScript extracts the schema version from the migration script file path.
// It returns the schema version in the format "major.minor.patch".
// If the file is the latest schema file, it returns the current schema version.
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

// execute executes a SQL statement within a transaction context.
// It returns an error if the execution fails.
func (*Store) execute(ctx context.Context, tx *sql.Tx, stmt string) error {
	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return errors.Wrap(err, "failed to execute statement")
	}
	return nil
}

// updateCurrentSchemaVersion updates the current schema version in the workspace basic setting.
// It retrieves the workspace basic setting, updates the schema version, and upserts the setting back to the database.
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

// normalizeMigrationHistoryList normalizes the migration history list.
// It checks the existing migration history and updates it to the latest schema version if necessary.
func (s *Store) normalizeMigrationHistoryList(ctx context.Context) error {
	migrationHistoryList, err := s.driver.FindMigrationHistoryList(ctx, &FindMigrationHistory{})
	if err != nil {
		return errors.Wrap(err, "failed to find migration history")
	}
	versions := []string{}
	for _, migrationHistory := range migrationHistoryList {
		versions = append(versions, migrationHistory.Version)
	}
	if len(versions) == 0 {
		return nil
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
	if _, err := s.driver.UpsertMigrationHistory(ctx, &UpsertMigrationHistory{
		Version: latestSchemaVersion,
	}); err != nil {
		return errors.Wrap(err, "failed to upsert latest migration history")
	}
	return nil
}

// migrateSchemaVersionToSetting migrates the schema version from the migration history to the workspace basic setting.
// It retrieves the migration history, sorts the versions, and updates the workspace basic setting if necessary.
func (s *Store) migrateSchemaVersionToSetting(ctx context.Context) error {
	migrationHistoryList, err := s.driver.FindMigrationHistoryList(ctx, &FindMigrationHistory{})
	if err != nil {
		return errors.Wrap(err, "failed to find migration history")
	}
	versions := []string{}
	for _, migrationHistory := range migrationHistoryList {
		versions = append(versions, migrationHistory.Version)
	}
	if len(versions) == 0 {
		return nil
	}
	sort.Sort(version.SortVersion(versions))
	latestVersion := versions[len(versions)-1]

	workspaceBasicSetting, err := s.GetWorkspaceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get workspace basic setting")
	}
	if version.IsVersionGreaterOrEqualThan(workspaceBasicSetting.SchemaVersion, latestVersion) {
		if err := s.updateCurrentSchemaVersion(ctx, latestVersion); err != nil {
			return errors.Wrap(err, "failed to update current schema version")
		}
	}
	return nil
}

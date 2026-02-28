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

// Migration System Overview:
//
// The migration system handles database schema versioning and upgrades.
// Schema version is stored in system_setting.
//
// Migration Flow:
// 1. preMigrate: Check if DB is initialized. If not, apply LATEST.sql
// 2. checkMinimumUpgradeVersion: Verify installation can be upgraded (reject pre-0.22 installations)
// 3. Migrate (prod mode): Apply incremental migrations from current to target version
// 4. Migrate (demo mode): Seed database with demo data
//
// Version Tracking:
// - New installations: Schema version set in system_setting immediately
// - Existing v0.22+ installations: Schema version tracked in system_setting
// - Pre-v0.22 installations: Must upgrade to v0.25.x first (migration_history → system_setting migration)
//
// Migration Files:
// - Location: store/migration/{driver}/{version}/NN__description.sql
// - Naming: NN is zero-padded patch number, description is human-readable
// - Ordering: Files sorted lexicographically and applied in order
// - LATEST.sql: Full schema for new installations (faster than incremental migrations)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

const (
	// MigrateFileNameSplit is the split character between the patch version and the description in the migration file name.
	// For example, "1__create_table.sql".
	MigrateFileNameSplit = "__"
	// LatestSchemaFileName is the name of the latest schema file.
	// This file is used to initialize fresh installations with the current schema.
	LatestSchemaFileName = "LATEST.sql"

	// defaultSchemaVersion is used when schema version is empty or not set.
	// This handles edge cases for old installations without version tracking.
	defaultSchemaVersion = "0.0.0"
)

// getSchemaVersionOrDefault returns the schema version or default if empty.
// This ensures safe version comparisons and handles old installations.
func getSchemaVersionOrDefault(schemaVersion string) string {
	if schemaVersion == "" {
		return defaultSchemaVersion
	}
	return schemaVersion
}

// isVersionEmpty checks if the schema version is empty or the default value.
func isVersionEmpty(schemaVersion string) bool {
	return schemaVersion == "" || schemaVersion == defaultSchemaVersion
}

// shouldApplyMigration determines if a migration file should be applied.
// It checks if the file's version is between the current DB version and target version.
func shouldApplyMigration(fileVersion, currentDBVersion, targetVersion string) bool {
	currentDBVersionSafe := getSchemaVersionOrDefault(currentDBVersion)
	return version.IsVersionGreaterThan(fileVersion, currentDBVersionSafe) &&
		version.IsVersionGreaterOrEqualThan(targetVersion, fileVersion)
}

// validateMigrationFileName checks if a migration file follows the expected naming convention.
// Expected format: "NN__description.sql" where NN is a zero-padded number.
func validateMigrationFileName(filename string) error {
	if !strings.Contains(filename, MigrateFileNameSplit) {
		return errors.Errorf("invalid migration filename format (missing %s): %s", MigrateFileNameSplit, filename)
	}
	parts := strings.Split(filename, MigrateFileNameSplit)
	if len(parts) < 2 {
		return errors.Errorf("invalid migration filename format: %s", filename)
	}
	// Check if first part is a number
	if _, err := strconv.Atoi(parts[0]); err != nil {
		return errors.Errorf("migration filename must start with a number: %s", filename)
	}
	return nil
}

// Migrate migrates the database schema to the latest version.
// It checks the current schema version and applies any necessary migrations.
// It also seeds the database with initial data if in demo mode.
func (s *Store) Migrate(ctx context.Context) error {
	if err := s.preMigrate(ctx); err != nil {
		return errors.Wrap(err, "failed to pre-migrate")
	}

	instanceBasicSetting, err := s.GetInstanceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance basic setting")
	}
	currentSchemaVersion, err := s.GetCurrentSchemaVersion()
	if err != nil {
		return errors.Wrap(err, "failed to get current schema version")
	}
	// Check for downgrade (but skip if schema version is empty - that means fresh/old installation)
	if !isVersionEmpty(instanceBasicSetting.SchemaVersion) && version.IsVersionGreaterThan(instanceBasicSetting.SchemaVersion, currentSchemaVersion) {
		slog.Error("cannot downgrade schema version",
			slog.String("databaseVersion", instanceBasicSetting.SchemaVersion),
			slog.String("currentVersion", currentSchemaVersion),
		)
		return errors.Errorf("cannot downgrade schema version from %s to %s", instanceBasicSetting.SchemaVersion, currentSchemaVersion)
	}
	// Apply migrations if needed (including when schema version is empty)
	if isVersionEmpty(instanceBasicSetting.SchemaVersion) || version.IsVersionGreaterThan(currentSchemaVersion, instanceBasicSetting.SchemaVersion) {
		if err := s.applyMigrations(ctx, instanceBasicSetting.SchemaVersion, currentSchemaVersion); err != nil {
			return errors.Wrap(err, "failed to apply migrations")
		}
	}

	if s.profile.Demo {
		// In demo mode, we should seed the database.
		if err := s.seed(ctx); err != nil {
			return errors.Wrap(err, "failed to seed")
		}
	}

	return nil
}

// applyMigrations applies all necessary migration files between current and target schema versions.
// It runs all migrations in a single transaction for atomicity.
func (s *Store) applyMigrations(ctx context.Context, currentSchemaVersion, targetSchemaVersion string) error {
	filePaths, err := fs.Glob(migrationFS, fmt.Sprintf("%s*/*.sql", s.getMigrationBasePath()))
	if err != nil {
		return errors.Wrap(err, "failed to read migration files")
	}
	sort.Strings(filePaths)

	// Start a transaction to apply migrations atomically
	tx, err := s.driver.GetDB().Begin()
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()

	// Use safe version for comparison (handles empty version case)
	schemaVersionForComparison := getSchemaVersionOrDefault(currentSchemaVersion)
	if isVersionEmpty(currentSchemaVersion) {
		slog.Warn("schema version is empty, treating as default for migration comparison",
			slog.String("defaultVersion", defaultSchemaVersion))
	}

	slog.Info("start migration",
		slog.String("currentSchemaVersion", schemaVersionForComparison),
		slog.String("targetSchemaVersion", targetSchemaVersion))

	migrationsApplied := 0
	for _, filePath := range filePaths {
		fileSchemaVersion, err := s.getSchemaVersionOfMigrateScript(filePath)
		if err != nil {
			return errors.Wrap(err, "failed to get schema version of migrate script")
		}

		if shouldApplyMigration(fileSchemaVersion, currentSchemaVersion, targetSchemaVersion) {
			// Validate migration filename before applying
			filename := filepath.Base(filePath)
			if err := validateMigrationFileName(filename); err != nil {
				slog.Warn("migration file has invalid name but will be applied", slog.String("file", filePath), slog.String("error", err.Error()))
			}

			slog.Info("applying migration",
				slog.String("file", filePath),
				slog.String("version", fileSchemaVersion))

			bytes, err := migrationFS.ReadFile(filePath)
			if err != nil {
				return errors.Wrapf(err, "failed to read migration file: %s", filePath)
			}

			stmt := string(bytes)
			if err := s.execute(ctx, tx, stmt); err != nil {
				return errors.Wrapf(err, "failed to execute migration %s: %s", filePath, err)
			}
			migrationsApplied++
		}
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit migration transaction")
	}

	slog.Info("migration completed", slog.Int("migrationsApplied", migrationsApplied))

	// Update schema version after successful migration
	if err := s.updateCurrentSchemaVersion(ctx, targetSchemaVersion); err != nil {
		return errors.Wrap(err, "failed to update current schema version")
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
		slog.Info("initializing new database with latest schema", slog.String("file", filePath))
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
		slog.Info("database initialized successfully", slog.String("schemaVersion", schemaVersion))
		if err := s.updateCurrentSchemaVersion(ctx, schemaVersion); err != nil {
			return errors.Wrap(err, "failed to update current schema version")
		}
	}

	if err := s.checkMinimumUpgradeVersion(ctx); err != nil {
		return err // Error message is already descriptive, don't wrap it
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
// This is only supported for SQLite databases and is used in demo mode.
func (s *Store) seed(ctx context.Context) error {
	// Only seed for SQLite - other databases should use production data
	if s.profile.Driver != "sqlite" {
		slog.Warn("seed is only supported for SQLite, skipping for other databases")
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
	currentVersion := version.GetCurrentVersion()
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

// updateCurrentSchemaVersion updates the current schema version in the instance basic setting.
// It retrieves the instance basic setting, updates the schema version, and upserts the setting back to the database.
func (s *Store) updateCurrentSchemaVersion(ctx context.Context, schemaVersion string) error {
	instanceBasicSetting, err := s.GetInstanceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance basic setting")
	}
	instanceBasicSetting.SchemaVersion = schemaVersion
	if _, err := s.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: instanceBasicSetting},
	}); err != nil {
		return errors.Wrap(err, "failed to upsert instance setting")
	}
	return nil
}

// checkMinimumUpgradeVersion verifies the installation meets minimum version requirements for upgrade.
// For very old installations (< v0.22.0), users must upgrade to v0.25.x first before upgrading to current version.
// This is necessary because schema version tracking was moved from migration_history to system_setting in v0.22.0.
func (s *Store) checkMinimumUpgradeVersion(ctx context.Context) error {
	instanceBasicSetting, err := s.GetInstanceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance basic setting")
	}

	schemaVersion := instanceBasicSetting.SchemaVersion

	// If schema version is >= 0.22.0, the installation is up-to-date
	if !isVersionEmpty(schemaVersion) && version.IsVersionGreaterOrEqualThan(schemaVersion, "0.22.0") {
		return nil
	}

	// If schema version is set but < 0.22.0, this is an old installation
	if !isVersionEmpty(schemaVersion) && !version.IsVersionGreaterOrEqualThan(schemaVersion, "0.22.0") {
		currentVersion, _ := s.GetCurrentSchemaVersion()

		return errors.Errorf(
			"Your Memos installation is too old to upgrade directly.\n\n"+
				"Your current version: %s\n"+
				"Target version: %s\n"+
				"Minimum required: v0.22.0 (May 2024)\n\n"+
				"Upgrade path:\n"+
				"1. First upgrade to v0.25.3: https://github.com/usememos/memos/releases/tag/v0.25.3\n"+
				"2. Start the server and verify it works\n"+
				"3. Then upgrade to the latest version\n\n"+
				"This is required because schema version tracking was moved from migration_history\n"+
				"to system_setting in v0.22.0. The intermediate upgrade handles this migration safely.",
			schemaVersion,
			currentVersion,
		)
	}

	// Schema version is empty - this is either a fresh install or corrupted installation
	// Fresh installs will have schema version set immediately after LATEST.sql is applied
	// So this should not be an issue in normal operation
	return nil
}

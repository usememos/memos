package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"slices"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Migration System Overview:
//
// The migration system handles database schema versioning and upgrades.
// Schema version is stored in system_setting.
//
// Migration Flow:
// 1. preMigrate: Check if DB is initialized. If not, apply LATEST.sql
// 2. checkMinimumUpgradeVersion: Verify the database meets the fixed v0.31.0 baseline
// 3. Migrate (prod mode): Apply incremental migrations from current to target version
// 4. Migrate (demo mode): Seed database with demo data
// Deployment configuration is loaded separately after migration completes.
//
// Version Tracking:
// - New installations: Schema version set in system_setting immediately
// - Existing installations: Must have schema 0.31.8 or newer
// - Older installations: Must upgrade through v0.31.0 before running this binary
//
// Migration Files:
// - Location: store/migration/{driver}/{version}/NN__description.sql
// - Naming: NN is a zero-based migration sequence, description is human-readable
// - Ordering: Calendar year, month, and migration sequence are compared numerically
// - Every driver ships the same set of migration versions; a schema change is
//   one file per driver under the same YY.MM/NN
// - LATEST.sql: Full schema for new installations (faster than incremental migrations)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

const (
	// MigrateFileNameSplit separates the migration sequence from the description in the migration file name.
	// For example, "00__create_table.sql".
	MigrateFileNameSplit = "__"
	// LatestSchemaFileName is the name of the latest schema file.
	// This file is used to initialize fresh installations with the current schema.
	LatestSchemaFileName = "LATEST.sql"

	// defaultSchemaVersion is used when schema version is empty or not set.
	// This handles edge cases for old installations without version tracking.
	defaultSchemaVersion = "0.0.0"

	// baselineSchemaVersion is the schema shipped by v0.31.0. Historical migrations
	// were removed at this boundary; this minimum must not advance with releases.
	baselineSchemaVersion = "0.31.8"
)

// migrationFile is one embedded migration script with its schema version parsed once.
type migrationFile struct {
	path    string
	version string
	parsed  [3]int
}

// isVersionEmpty identifies legacy databases without schema tracking.
func isVersionEmpty(schemaVersion string) bool {
	return schemaVersion == "" || schemaVersion == defaultSchemaVersion
}

// shouldApplyMigration reports whether a file version lies after the current
// database version and at or before the target version.
func shouldApplyMigration(fileVersion, currentDBVersion, targetVersion [3]int) bool {
	return compareParsedSchemaVersions(fileVersion, currentDBVersion) > 0 &&
		compareParsedSchemaVersions(fileVersion, targetVersion) <= 0
}

// validateMigrationFileName checks if a migration file follows the expected naming convention.
// Expected format: "NN__description.sql" where NN is a zero-padded number.
func validateMigrationFileName(filename string) error {
	if !migrationFilePattern.MatchString(filename) {
		return errors.Errorf("invalid migration filename %q; expected NN__description.sql", filename)
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
	order, err := compareSchemaVersions(instanceBasicSetting.SchemaVersion, currentSchemaVersion)
	if err != nil {
		return err
	}
	if order > 0 {
		slog.Error("cannot downgrade schema version",
			slog.String("databaseVersion", instanceBasicSetting.SchemaVersion),
			slog.String("currentVersion", currentSchemaVersion),
		)
		return errors.Errorf("cannot downgrade schema version from %s to %s", instanceBasicSetting.SchemaVersion, currentSchemaVersion)
	}
	// Apply migrations if needed.
	if order < 0 {
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
	if err := s.initializeInstanceAccessSetting(ctx); err != nil {
		return errors.Wrap(err, "failed to initialize instance access setting")
	}
	return nil
}

// initializeInstanceAccessSetting captures the pre-ACCESS behavior exactly once.
// Existing installations that configured an external URL were public; all others
// were private. Once persisted, later URL changes do not alter the access policy.
func (s *Store) initializeInstanceAccessSetting(ctx context.Context) error {
	accessMode := storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE
	if strings.TrimSpace(s.profile.InstanceURL) != "" {
		accessMode = storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC
	}
	value, err := protojson.Marshal(&storepb.InstanceAccessSetting{AccessMode: accessMode})
	if err != nil {
		return errors.Wrap(err, "failed to marshal initial instance access setting")
	}
	_, err = s.driver.CreateInstanceSettingIfNotExists(ctx, &InstanceSetting{
		Name:  storepb.InstanceSettingKey_ACCESS.String(),
		Value: string(value),
	})
	if err != nil {
		return errors.Wrap(err, "failed to conditionally create initial instance access setting")
	}
	return nil
}

// applyMigrations applies all necessary migration files between current and target schema versions.
// It runs all migrations in a single transaction for atomicity.
func (s *Store) applyMigrations(ctx context.Context, currentSchemaVersion, targetSchemaVersion string) error {
	current, err := parseSchemaVersion(currentSchemaVersion)
	if err != nil {
		return err
	}
	target, err := parseSchemaVersion(targetSchemaVersion)
	if err != nil {
		return err
	}
	files, err := s.listMigrationFiles()
	if err != nil {
		return err
	}

	// Start a transaction to apply migrations atomically
	tx, err := s.driver.GetDB().Begin()
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer tx.Rollback()

	slog.Info("start migration",
		slog.String("currentSchemaVersion", currentSchemaVersion),
		slog.String("targetSchemaVersion", targetSchemaVersion))

	migrationsApplied := 0
	for _, file := range files {
		if !shouldApplyMigration(file.parsed, current, target) {
			continue
		}
		slog.Info("applying migration",
			slog.String("file", file.path),
			slog.String("version", file.version))

		bytes, err := migrationFS.ReadFile(file.path)
		if err != nil {
			return errors.Wrapf(err, "failed to read migration file: %s", file.path)
		}

		stmt := string(bytes)
		if err := s.execute(ctx, tx, stmt); err != nil {
			return errors.Wrapf(err, "failed to execute migration %s: %s", file.path, err)
		}
		migrationsApplied++
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
	slices.Sort(filenames)
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

// GetCurrentSchemaVersion returns the latest schema version available for the configured database driver.
// With no incremental migrations, it returns the fixed v0.31.0 baseline.
//
// Only this driver's migration files count. Every driver must ship the same
// migration versions (TestMigrationVersionsMatchAcrossDrivers enforces this),
// so a driver never records a version whose SQL it has not executed.
func (s *Store) GetCurrentSchemaVersion() (string, error) {
	files, err := s.listMigrationFiles()
	if err != nil {
		return "", err
	}
	if len(files) == 0 {
		return baselineSchemaVersion, nil
	}
	latest := files[len(files)-1]
	if compareParsedSchemaVersions(latest.parsed, mustParseSchemaVersion(baselineSchemaVersion)) < 0 {
		return baselineSchemaVersion, nil
	}
	return latest.version, nil
}

// listMigrationFiles returns this driver's migration scripts in application
// order. Every filename is validated and every version parsed before any SQL
// runs, sequences are ordered numerically (including months with more than
// 100 migrations), and two files that resolve to the same version are rejected
// because their relative order would be undefined.
func (s *Store) listMigrationFiles() ([]migrationFile, error) {
	return listMigrationFilesFrom(migrationFS, s.getMigrationBasePath())
}

func listMigrationFilesFrom(fsys fs.FS, basePath string) ([]migrationFile, error) {
	paths, err := fs.Glob(fsys, basePath+"*/*.sql")
	if err != nil {
		return nil, errors.Wrap(err, "failed to read migration files")
	}
	files := make([]migrationFile, 0, len(paths))
	seen := make(map[string]string, len(paths))
	for _, path := range paths {
		version, err := getSchemaVersionOfMigrateScript(path)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get schema version of migrate script")
		}
		if previous, exists := seen[version]; exists {
			return nil, errors.Errorf("migration files %s and %s both resolve to schema version %s", previous, path, version)
		}
		seen[version] = path
		files = append(files, migrationFile{path: path, version: version, parsed: mustParseSchemaVersion(version)})
	}
	slices.SortFunc(files, func(a, b migrationFile) int {
		return compareParsedSchemaVersions(a.parsed, b.parsed)
	})
	return files, nil
}

// getSchemaVersionOfMigrateScript extracts the schema version from the migration script file path.
// Calendar directory YY.MM and file NN__description.sql produce YY.M.(NN+1).
func getSchemaVersionOfMigrateScript(filePath string) (string, error) {
	elements := strings.Split(filePath, "/")
	if len(elements) < 2 {
		return "", errors.Errorf("invalid file path: %s", filePath)
	}
	if err := validateMigrationFileName(elements[len(elements)-1]); err != nil {
		return "", err
	}
	series := elements[len(elements)-2]
	rawSequence := strings.Split(elements[len(elements)-1], MigrateFileNameSplit)[0]
	sequence, err := strconv.Atoi(rawSequence)
	if err != nil {
		return "", errors.Wrapf(err, "failed to convert migration sequence to int: %s", rawSequence)
	}
	if !calendarMigrationSeriesPattern.MatchString(series) {
		return "", errors.Errorf("invalid migration series %q; expected YY.MM", series)
	}
	yearMonth := strings.Split(series, ".")
	month, err := strconv.Atoi(yearMonth[1])
	if err != nil {
		return "", errors.Wrap(err, "invalid migration month")
	}
	schema := fmt.Sprintf("%s.%d.%d", yearMonth[0], month, sequence+1)
	if _, err := parseSchemaVersion(schema); err != nil {
		return "", err
	}
	return schema, nil
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

// checkMinimumUpgradeVersion rejects databases whose migration history is no longer shipped.
// Fresh installations already have their schema version set by preMigrate.
func (s *Store) checkMinimumUpgradeVersion(ctx context.Context) error {
	instanceBasicSetting, err := s.GetInstanceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to read database schema version")
	}
	schemaVersion := instanceBasicSetting.SchemaVersion
	if !isVersionEmpty(schemaVersion) {
		order, err := compareSchemaVersions(schemaVersion, baselineSchemaVersion)
		if err != nil {
			return err
		}
		if order >= 0 {
			return nil
		}
	}

	upgradePath := "First upgrade to v0.31.0: https://github.com/usememos/memos/releases/tag/v0.31.0"
	legacyOrder := -1
	if !isVersionEmpty(schemaVersion) {
		legacyOrder, err = compareSchemaVersions(schemaVersion, "0.22.0")
		if err != nil {
			return err
		}
	}
	if legacyOrder < 0 {
		upgradePath = "First upgrade to v0.25.3: https://github.com/usememos/memos/releases/tag/v0.25.3\n" +
			"Start the server and verify it works, then upgrade to v0.31.0: https://github.com/usememos/memos/releases/tag/v0.31.0"
	}
	return errors.Errorf(
		"database schema %q is too old to upgrade directly; minimum supported schema is %s.\n"+
			"%s\nStart v0.31.0 and verify it works before upgrading to this version.",
		schemaVersion, baselineSchemaVersion, upgradePath,
	)
}

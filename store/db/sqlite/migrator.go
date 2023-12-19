package sqlite

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"sort"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/server/version"
	"github.com/usememos/memos/store"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

// Migrate applies the latest schema to the database.
func (d *DB) Migrate(ctx context.Context) error {
	currentVersion := version.GetCurrentVersion(d.profile.Mode)
	if d.profile.Mode == "prod" {
		_, err := os.Stat(d.profile.DSN)
		if err != nil {
			// If db file not exists, we should create a new one with latest schema.
			if errors.Is(err, os.ErrNotExist) {
				if err := d.applyLatestSchema(ctx); err != nil {
					return errors.Wrap(err, "failed to apply latest schema")
				}
				// Upsert the newest version to migration_history.
				if _, err := d.UpsertMigrationHistory(ctx, &store.UpsertMigrationHistory{
					Version: currentVersion,
				}); err != nil {
					return errors.Wrap(err, "failed to upsert migration history")
				}
			} else {
				return errors.Wrap(err, "failed to get db file stat")
			}
		} else {
			// If db file exists, we should check if we need to migrate the database.
			migrationHistoryList, err := d.FindMigrationHistoryList(ctx, &store.FindMigrationHistory{})
			if err != nil {
				return errors.Wrap(err, "failed to find migration history")
			}
			// If no migration history, we should apply the latest version migration and upsert the migration history.
			if len(migrationHistoryList) == 0 {
				minorVersion := version.GetMinorVersion(currentVersion)
				if err := d.applyMigrationForMinorVersion(ctx, minorVersion); err != nil {
					return errors.Wrapf(err, "failed to apply version %s migration", minorVersion)
				}
				_, err := d.UpsertMigrationHistory(ctx, &store.UpsertMigrationHistory{
					Version: currentVersion,
				})
				if err != nil {
					return errors.Wrap(err, "failed to upsert migration history")
				}
				return nil
			}

			migrationHistoryVersionList := []string{}
			for _, migrationHistory := range migrationHistoryList {
				migrationHistoryVersionList = append(migrationHistoryVersionList, migrationHistory.Version)
			}
			sort.Sort(version.SortVersion(migrationHistoryVersionList))
			latestMigrationHistoryVersion := migrationHistoryVersionList[len(migrationHistoryVersionList)-1]

			if version.IsVersionGreaterThan(version.GetSchemaVersion(currentVersion), latestMigrationHistoryVersion) {
				minorVersionList := getMinorVersionList()
				// Backup the raw database file before migration.
				rawBytes, err := os.ReadFile(d.profile.DSN)
				if err != nil {
					return errors.Wrap(err, "failed to read raw database file")
				}
				backupDBFilePath := fmt.Sprintf("%s/memos_%s_%d_backup.db", d.profile.Data, d.profile.Version, time.Now().Unix())
				if err := os.WriteFile(backupDBFilePath, rawBytes, 0644); err != nil {
					return errors.Wrap(err, "failed to write raw database file")
				}
				println("succeed to copy a backup database file")
				println("start migrate")
				for _, minorVersion := range minorVersionList {
					normalizedVersion := minorVersion + ".0"
					if version.IsVersionGreaterThan(normalizedVersion, latestMigrationHistoryVersion) && version.IsVersionGreaterOrEqualThan(currentVersion, normalizedVersion) {
						println("applying migration for", normalizedVersion)
						if err := d.applyMigrationForMinorVersion(ctx, minorVersion); err != nil {
							return errors.Wrap(err, "failed to apply minor version migration")
						}
					}
				}
				println("end migrate")

				// Remove the created backup db file after migrate succeed.
				if err := os.Remove(backupDBFilePath); err != nil {
					println(fmt.Sprintf("Failed to remove temp database file, err %v", err))
				}
			}
		}
	} else {
		// In non-prod mode, we should always migrate the database.
		if _, err := os.Stat(d.profile.DSN); errors.Is(err, os.ErrNotExist) {
			if err := d.applyLatestSchema(ctx); err != nil {
				return errors.Wrap(err, "failed to apply latest schema")
			}
			// In demo mode, we should seed the database.
			if d.profile.Mode == "demo" {
				if err := d.seed(ctx); err != nil {
					return errors.Wrap(err, "failed to seed")
				}
			}
		}
	}

	return nil
}

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (d *DB) applyLatestSchema(ctx context.Context) error {
	schemaMode := "dev"
	if d.profile.Mode == "prod" {
		schemaMode = "prod"
	}
	latestSchemaPath := fmt.Sprintf("migration/%s/%s", schemaMode, latestSchemaFileName)
	buf, err := migrationFS.ReadFile(latestSchemaPath)
	if err != nil {
		return errors.Wrapf(err, "failed to read latest schema %q", latestSchemaPath)
	}
	stmt := string(buf)
	if err := d.execute(ctx, stmt); err != nil {
		return errors.Wrapf(err, "migrate error: %s", stmt)
	}
	return nil
}

func (d *DB) applyMigrationForMinorVersion(ctx context.Context, minorVersion string) error {
	filenames, err := fs.Glob(migrationFS, fmt.Sprintf("%s/%s/*.sql", "migration/prod", minorVersion))
	if err != nil {
		return errors.Wrap(err, "failed to read ddl files")
	}

	sort.Strings(filenames)
	migrationStmt := ""

	// Loop over all migration files and execute them in order.
	for _, filename := range filenames {
		buf, err := migrationFS.ReadFile(filename)
		if err != nil {
			return errors.Wrapf(err, "failed to read minor version migration file, filename=%s", filename)
		}
		stmt := string(buf)
		migrationStmt += stmt
		if err := d.execute(ctx, stmt); err != nil {
			return errors.Wrapf(err, "migrate error: %s", stmt)
		}
	}

	// Upsert the newest version to migration_history.
	version := minorVersion + ".0"
	if _, err = d.UpsertMigrationHistory(ctx, &store.UpsertMigrationHistory{
		Version: version,
	}); err != nil {
		return errors.Wrapf(err, "failed to upsert migration history with version: %s", version)
	}

	return nil
}

func (d *DB) seed(ctx context.Context) error {
	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s/*.sql", "seed"))
	if err != nil {
		return errors.Wrap(err, "failed to read seed files")
	}

	sort.Strings(filenames)

	// Loop over all seed files and execute them in order.
	for _, filename := range filenames {
		buf, err := seedFS.ReadFile(filename)
		if err != nil {
			return errors.Wrapf(err, "failed to read seed file, filename=%s", filename)
		}
		stmt := string(buf)
		if err := d.execute(ctx, stmt); err != nil {
			return errors.Wrapf(err, "seed error: %s", stmt)
		}
	}
	return nil
}

// execute runs a single SQL statement within a transaction.
func (d *DB) execute(ctx context.Context, stmt string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return errors.Wrap(err, "failed to execute statement")
	}

	return tx.Commit()
}

// minorDirRegexp is a regular expression for minor version directory.
var minorDirRegexp = regexp.MustCompile(`^migration/prod/[0-9]+\.[0-9]+$`)

func getMinorVersionList() []string {
	minorVersionList := []string{}

	if err := fs.WalkDir(migrationFS, "migration", func(path string, file fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if file.IsDir() && minorDirRegexp.MatchString(path) {
			minorVersionList = append(minorVersionList, file.Name())
		}

		return nil
	}); err != nil {
		panic(err)
	}

	sort.Sort(version.SortVersion(minorVersionList))

	return minorVersionList
}

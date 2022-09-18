package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"sort"
	"time"

	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

type DB struct {
	// sqlite db connection instance
	Db      *sql.DB
	profile *profile.Profile
}

// NewDB returns a new instance of DB associated with the given datasource name.
func NewDB(profile *profile.Profile) *DB {
	db := &DB{
		profile: profile,
	}
	return db
}

func (db *DB) Open(ctx context.Context) (err error) {
	// Ensure a DSN is set before attempting to open the database.
	if db.profile.DSN == "" {
		return fmt.Errorf("dsn required")
	}

	// Connect to the database.
	sqlDB, err := sql.Open("sqlite3", db.profile.DSN+"?_foreign_keys=1")
	if err != nil {
		return fmt.Errorf("failed to open db with dsn: %s, err: %w", db.profile.DSN, err)
	}

	db.Db = sqlDB
	// If mode is dev, we should migrate and seed the database.
	if db.profile.Mode == "dev" {
		if err := db.applyLatestSchema(ctx); err != nil {
			return fmt.Errorf("failed to apply latest schema: %w", err)
		}
		if err := db.seed(ctx); err != nil {
			return fmt.Errorf("failed to seed: %w", err)
		}
	} else {
		// If db file not exists, we should migrate the database.
		if _, err := os.Stat(db.profile.DSN); errors.Is(err, os.ErrNotExist) {
			err := db.applyLatestSchema(ctx)
			if err != nil {
				return fmt.Errorf("failed to apply latest schema: %w", err)
			}
		} else {
			err := db.createMigrationHistoryTable(ctx)
			if err != nil {
				return fmt.Errorf("failed to create migration_history table: %w", err)
			}

			currentVersion := version.GetCurrentVersion(db.profile.Mode)
			migrationHistory, err := db.FindMigrationHistory(ctx, &MigrationHistoryFind{})
			if err != nil {
				return err
			}
			if migrationHistory == nil {
				migrationHistory, err = db.UpsertMigrationHistory(ctx, &MigrationHistoryUpsert{
					Version: currentVersion,
				})
				if err != nil {
					return err
				}
			}

			if version.IsVersionGreaterThan(version.GetSchemaVersion(currentVersion), migrationHistory.Version) {
				minorVersionList := getMinorVersionList()

				// backup the raw database file before migration
				rawBytes, err := os.ReadFile(db.profile.DSN)
				if err != nil {
					return fmt.Errorf("failed to read raw database file, err: %w", err)
				}
				backupDBFilePath := fmt.Sprintf("%s/memos_%s_%d_backup.db", db.profile.Data, db.profile.Version, time.Now().Unix())
				if err := os.WriteFile(backupDBFilePath, rawBytes, 0644); err != nil {
					return fmt.Errorf("failed to write raw database file, err: %w", err)
				}

				println("succeed to copy a backup database file")
				println("start migrate")
				for _, minorVersion := range minorVersionList {
					normalizedVersion := minorVersion + ".0"
					if version.IsVersionGreaterThan(normalizedVersion, migrationHistory.Version) && version.IsVersionGreaterOrEqualThan(currentVersion, normalizedVersion) {
						println("applying migration for", normalizedVersion)
						if err := db.applyMigrationForMinorVersion(ctx, minorVersion); err != nil {
							return fmt.Errorf("failed to apply minor version migration: %w", err)
						}
					}
				}

				println("end migrate")
				// remove the created backup db file after migrate succeed
				if err := os.Remove(backupDBFilePath); err != nil {
					println(fmt.Sprintf("Failed to remove temp database file, err %v", err))
				}
			}
		}
	}

	return err
}

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (db *DB) applyLatestSchema(ctx context.Context) error {
	latestSchemaPath := fmt.Sprintf("%s/%s/%s", "migration", db.profile.Mode, latestSchemaFileName)
	buf, err := migrationFS.ReadFile(latestSchemaPath)
	if err != nil {
		return fmt.Errorf("failed to read latest schema %q, error %w", latestSchemaPath, err)
	}
	stmt := string(buf)
	if err := db.execute(ctx, stmt); err != nil {
		return fmt.Errorf("migrate error: statement:%s err=%w", stmt, err)
	}
	return nil
}

func (db *DB) applyMigrationForMinorVersion(ctx context.Context, minorVersion string) error {
	filenames, err := fs.Glob(migrationFS, fmt.Sprintf("%s/%s/*.sql", "migration/prod", minorVersion))
	if err != nil {
		return err
	}

	sort.Strings(filenames)
	migrationStmt := ""

	// Loop over all migration files and execute them in order.
	for _, filename := range filenames {
		buf, err := migrationFS.ReadFile(filename)
		if err != nil {
			return fmt.Errorf("failed to read minor version migration file, filename=%s err=%w", filename, err)
		}
		stmt := string(buf)
		migrationStmt += stmt
		if err := db.execute(ctx, stmt); err != nil {
			return fmt.Errorf("migrate error: statement:%s err=%w", stmt, err)
		}
	}

	tx, err := db.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// upsert the newest version to migration_history
	if _, err = upsertMigrationHistory(ctx, tx, &MigrationHistoryUpsert{
		Version: minorVersion + ".0",
	}); err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) seed(ctx context.Context) error {
	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s/*.sql", "seed"))
	if err != nil {
		return err
	}

	sort.Strings(filenames)

	// Loop over all seed files and execute them in order.
	for _, filename := range filenames {
		buf, err := seedFS.ReadFile(filename)
		if err != nil {
			return fmt.Errorf("failed to read seed file, filename=%s err=%w", filename, err)
		}
		stmt := string(buf)
		if err := db.execute(ctx, stmt); err != nil {
			return fmt.Errorf("seed error: statement:%s err=%w", stmt, err)
		}
	}
	return nil
}

// execute runs a single SQL statement within a transaction.
func (db *DB) execute(ctx context.Context, stmt string) error {
	tx, err := db.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return err
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

	sort.Strings(minorVersionList)

	return minorVersionList
}

// createMigrationHistoryTable creates the migration_history table if it doesn't exist.
func (db *DB) createMigrationHistoryTable(ctx context.Context) error {
	tx, err := db.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := createTable(ctx, tx, `
	CREATE TABLE IF NOT EXISTS migration_history (
		version TEXT NOT NULL PRIMARY KEY,
		created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now'))
	);
	`); err != nil {
		return err
	}

	return tx.Commit()
}

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
	DBInstance *sql.DB
	profile    *profile.Profile
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

	// Connect to the database without foreign_key.
	sqliteDB, err := sql.Open("sqlite", db.profile.DSN+"?cache=private&_foreign_keys=0&_busy_timeout=10000&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("failed to open db with dsn: %s, err: %w", db.profile.DSN, err)
	}
	db.DBInstance = sqliteDB

	if db.profile.Mode == "prod" {
		_, err := os.Stat(db.profile.DSN)
		if err != nil {
			// If db file not exists, we should create a new one with latest schema.
			if errors.Is(err, os.ErrNotExist) {
				if err := db.applyLatestSchema(ctx); err != nil {
					return fmt.Errorf("failed to apply latest schema, err: %w", err)
				}
			} else {
				return fmt.Errorf("failed to get db file stat, err: %w", err)
			}
		} else {
			// If db file exists, we should check if we need to migrate the database.
			currentVersion := version.GetCurrentVersion(db.profile.Mode)
			migrationHistoryList, err := db.FindMigrationHistoryList(ctx, &MigrationHistoryFind{})
			if err != nil {
				return fmt.Errorf("failed to find migration history, err: %w", err)
			}
			if len(migrationHistoryList) == 0 {
				_, err := db.UpsertMigrationHistory(ctx, &MigrationHistoryUpsert{
					Version: currentVersion,
				})
				if err != nil {
					return fmt.Errorf("failed to upsert migration history, err: %w", err)
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
					if version.IsVersionGreaterThan(normalizedVersion, latestMigrationHistoryVersion) && version.IsVersionGreaterOrEqualThan(currentVersion, normalizedVersion) {
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
	} else {
		// In non-prod mode, we should always migrate the database.
		if _, err := os.Stat(db.profile.DSN); errors.Is(err, os.ErrNotExist) {
			if err := db.applyLatestSchema(ctx); err != nil {
				return fmt.Errorf("failed to apply latest schema: %w", err)
			}
			// In demo mode, we should seed the database.
			if db.profile.Mode == "demo" {
				if err := db.seed(ctx); err != nil {
					return fmt.Errorf("failed to seed: %w", err)
				}
			}
		}
	}

	return nil
}

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (db *DB) applyLatestSchema(ctx context.Context) error {
	schemaMode := "dev"
	if db.profile.Mode == "prod" {
		schemaMode = "prod"
	}
	latestSchemaPath := fmt.Sprintf("%s/%s/%s", "migration", schemaMode, latestSchemaFileName)
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
		return fmt.Errorf("failed to read ddl files, err: %w", err)
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

	tx, err := db.DBInstance.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// upsert the newest version to migration_history
	version := minorVersion + ".0"
	if _, err = upsertMigrationHistory(ctx, tx, &MigrationHistoryUpsert{
		Version: version,
	}); err != nil {
		return fmt.Errorf("failed to upsert migration history with version: %s, err: %w", version, err)
	}

	return tx.Commit()
}

func (db *DB) seed(ctx context.Context) error {
	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s/*.sql", "seed"))
	if err != nil {
		return fmt.Errorf("failed to read seed files, err: %w", err)
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
	tx, err := db.DBInstance.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return fmt.Errorf("failed to execute statement, err: %w", err)
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

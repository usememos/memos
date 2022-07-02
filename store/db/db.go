package db

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"sort"

	"github.com/usememos/memos/common"
	"github.com/usememos/memos/server/profile"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

type DB struct {
	// sqlite db connection instance
	Db *sql.DB
	// datasource name
	DSN string
	// mode should be prod or dev
	mode string
}

// NewDB returns a new instance of DB associated with the given datasource name.
func NewDB(profile *profile.Profile) *DB {
	db := &DB{
		DSN:  profile.DSN,
		mode: profile.Mode,
	}
	return db
}

func (db *DB) Open() (err error) {
	// Ensure a DSN is set before attempting to open the database.
	if db.DSN == "" {
		return fmt.Errorf("dsn required")
	}

	// Connect to the database.
	sqlDB, err := sql.Open("sqlite3", db.DSN)
	if err != nil {
		return fmt.Errorf("failed to open db with dsn: %s, err: %w", db.DSN, err)
	}

	db.Db = sqlDB
	// If mode is dev, we should migrate and seed the database.
	if db.mode == "dev" {
		if err := db.applyLatestSchema(); err != nil {
			return fmt.Errorf("failed to apply latest schema: %w", err)
		}
		if err := db.seed(); err != nil {
			return fmt.Errorf("failed to seed: %w", err)
		}
	} else {
		// If db file not exists, we should migrate the database.
		if _, err := os.Stat(db.DSN); errors.Is(err, os.ErrNotExist) {
			err := db.applyLatestSchema()
			if err != nil {
				return fmt.Errorf("failed to apply latest schema: %w", err)
			}
		} else {
			err := db.createMigrationHistoryTable()
			if err != nil {
				return fmt.Errorf("failed to create migration_history table: %w", err)
			}

			currentVersion := common.GetCurrentVersion(db.mode)
			migrationHistory, err := findMigrationHistory(db.Db, &MigrationHistoryFind{})
			if err != nil {
				return err
			}
			if migrationHistory == nil {
				migrationHistory, err = upsertMigrationHistory(db.Db, &MigrationHistoryCreate{
					Version:   currentVersion,
					Statement: "",
				})
				if err != nil {
					return err
				}
			}

			if common.IsVersionGreaterThan(currentVersion, migrationHistory.Version) {
				minorVersionList := getMinorVersionList()

				for _, minorVersion := range minorVersionList {
					normalizedVersion := minorVersion + ".0"
					if common.IsVersionGreaterThan(normalizedVersion, migrationHistory.Version) && common.IsVersionGreaterOrEqualThan(currentVersion, normalizedVersion) {
						err := db.applyMigrationForMinorVersion(minorVersion)
						if err != nil {
							return fmt.Errorf("failed to apply minor version migration: %w", err)
						}
					}
				}
			}
		}
	}

	return err
}

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (db *DB) applyLatestSchema() error {
	latestSchemaPath := fmt.Sprintf("%s/%s", "migration", latestSchemaFileName)
	buf, err := migrationFS.ReadFile(latestSchemaPath)
	if err != nil {
		return fmt.Errorf("failed to read latest schema %q, error %w", latestSchemaPath, err)
	}
	stmt := string(buf)
	if err := db.execute(stmt); err != nil {
		return fmt.Errorf("migrate error: statement:%s err=%w", stmt, err)
	}
	return nil
}

func (db *DB) applyMigrationForMinorVersion(minorVersion string) error {
	filenames, err := fs.Glob(migrationFS, fmt.Sprintf("%s/%s/*.sql", "migration", minorVersion))
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
		if err := db.execute(stmt); err != nil {
			return fmt.Errorf("migrate error: statement:%s err=%w", stmt, err)
		}
	}

	// upsert the newest version to migration_history
	if _, err = upsertMigrationHistory(db.Db, &MigrationHistoryCreate{
		Version:   minorVersion + ".0",
		Statement: migrationStmt,
	}); err != nil {
		return err
	}

	return nil
}

func (db *DB) seed() error {
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
		if err := db.execute(stmt); err != nil {
			return fmt.Errorf("seed error: statement:%s err=%w", stmt, err)
		}
	}
	return nil
}

// excecute runs a single SQL statement within a transaction.
func (db *DB) execute(stmt string) error {
	tx, err := db.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(stmt); err != nil {
		return err
	}

	return tx.Commit()
}

// minorDirRegexp is a regular expression for minor version directory.
var minorDirRegexp = regexp.MustCompile(`^migration/[0-9]+\.[0-9]+$`)

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
func (db *DB) createMigrationHistoryTable() error {
	table, err := findTable(db.Db, "migration_history")
	if err != nil {
		return err
	}

	// TODO(steven): Drop the migration_history table if it exists temporarily.
	if table != nil {
		err = db.execute(`
		DROP TABLE IF EXISTS migration_history;
		`)
		if err != nil {
			return err
		}
	}

	err = createTable(db.Db, `
	CREATE TABLE migration_history (
		version TEXT NOT NULL PRIMARY KEY,
		statement TEXT NOT NULL DEFAULT '',
		created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now'))
	);
	`)
	if err != nil {
		return err
	}

	return nil
}

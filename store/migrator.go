package store

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"regexp"
	"sort"

	"github.com/pkg/errors"

	"github.com/usememos/memos/server/version"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

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
		currentVersion := version.GetCurrentVersion(s.Profile.Mode)

		if version.IsVersionGreaterThan(version.GetSchemaVersion(currentVersion), latestMigrationHistoryVersion) {
			minorVersionList := s.getMinorVersionList()
			fmt.Println("start migration")
			for _, minorVersion := range minorVersionList {
				normalizedVersion := minorVersion + ".0"
				if version.IsVersionGreaterThan(normalizedVersion, latestMigrationHistoryVersion) && version.IsVersionGreaterOrEqualThan(currentVersion, normalizedVersion) {
					fmt.Println("applying migration for", normalizedVersion)
					if err := s.applyMigrationForMinorVersion(ctx, minorVersion); err != nil {
						return errors.Wrap(err, "failed to apply minor version migration")
					}
				}
			}
			fmt.Println("end migrate")
		}
	} else {
		// In demo mode, we should seed the database.
		if s.Profile.Mode == "demo" {
			if err := s.seed(ctx); err != nil {
				return errors.Wrap(err, "failed to seed")
			}
		}
	}
	return nil
}

func (s *Store) preMigrate(ctx context.Context) error {
	migrationHistoryList, err := s.driver.FindMigrationHistoryList(ctx, &FindMigrationHistory{})
	// If there is no migration history, we should apply the latest schema.
	if err != nil || len(migrationHistoryList) == 0 {
		if err != nil {
			slog.Error("failed to find migration history", "error", err)
		}
		fileName := s.getMigrationBasePath() + latestSchemaFileName
		bytes, err := migrationFS.ReadFile(fileName)
		if err != nil {
			return errors.Errorf("failed to read latest schema file: %s", err)
		}
		if err := s.execute(ctx, string(bytes)); err != nil {
			return errors.Errorf("failed to exec SQL file %s, err %s", fileName, err)
		}
		if _, err := s.driver.UpsertMigrationHistory(ctx, &UpsertMigrationHistory{
			Version: version.GetCurrentVersion(s.Profile.Mode),
		}); err != nil {
			return errors.Wrap(err, "failed to upsert migration history")
		}
	}
	return nil
}

func (s *Store) getMigrationBasePath() string {
	mode := "dev"
	if s.Profile.Mode == "prod" {
		mode = "prod"
	}
	return fmt.Sprintf("migration/%s/%s/", s.driver.Type(), mode)
}

func (s *Store) getSeedBasePath() string {
	return fmt.Sprintf("seed/%s/", s.driver.Type())
}

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (s *Store) applyMigrationForMinorVersion(ctx context.Context, minorVersion string) error {
	filenames, err := fs.Glob(migrationFS, fmt.Sprintf("%s%s/*.sql", s.getMigrationBasePath(), minorVersion))
	if err != nil {
		return errors.Wrap(err, "failed to read migration files")
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
		if err := s.execute(ctx, stmt); err != nil {
			return errors.Wrapf(err, "migrate error: %s", stmt)
		}
	}

	// Upsert the newest version to migration_history.
	version := minorVersion + ".0"
	if _, err = s.driver.UpsertMigrationHistory(ctx, &UpsertMigrationHistory{
		Version: version,
	}); err != nil {
		return errors.Wrapf(err, "failed to upsert migration history with version: %s", version)
	}

	return nil
}

func (s *Store) seed(ctx context.Context) error {
	// Only seed for SQLite.
	if s.driver.Type() != "sqlite" {
		return nil
	}

	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s*.sql", s.getSeedBasePath()))
	if err != nil {
		return errors.Wrap(err, "failed to read seed files")
	}

	sort.Strings(filenames)
	// Loop over all seed files and execute them in order.
	for _, filename := range filenames {
		bytes, err := seedFS.ReadFile(filename)
		if err != nil {
			return errors.Wrapf(err, "failed to read seed file, filename=%s", filename)
		}
		if err := s.execute(ctx, string(bytes)); err != nil {
			return errors.Wrapf(err, "seed error: %s", filename)
		}
	}
	return nil
}

// execute runs a single SQL statement within a transaction.
func (s *Store) execute(ctx context.Context, stmt string) error {
	tx, err := s.driver.GetDB().Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return errors.Wrap(err, "failed to execute statement")
	}
	return tx.Commit()
}

func (s *Store) getMinorVersionList() []string {
	var minorDirRegexp = regexp.MustCompile(fmt.Sprintf(`^%s[0-9]+\.[0-9]+$`, s.getMigrationBasePath()))
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

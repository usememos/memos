package postgres

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/server/version"
	"github.com/usememos/memos/store"
)

//go:embed migration
var migrationFS embed.FS

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (d *DB) Migrate(ctx context.Context) error {
	if d.profile.IsDev() {
		return d.nonProdMigrate(ctx)
	}

	return d.prodMigrate(ctx)
}

func (d *DB) nonProdMigrate(ctx context.Context) error {
	rows, err := d.db.QueryContext(ctx, "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';")
	if err != nil {
		return errors.Errorf("failed to query database tables: %s", err)
	}
	if rows.Err() != nil {
		return errors.Errorf("failed to query database tables: %s", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		err := rows.Scan(&table)
		if err != nil {
			return errors.Errorf("failed to scan table name: %s", err)
		}
		tables = append(tables, table)
	}

	if len(tables) != 0 {
		return nil
	}

	buf, err := migrationFS.ReadFile("migration/dev/" + latestSchemaFileName)
	if err != nil {
		return errors.Errorf("failed to read latest schema file: %s", err)
	}

	stmt := string(buf)
	if _, err := d.db.ExecContext(ctx, stmt); err != nil {
		return errors.Errorf("failed to exec SQL %s: %s", stmt, err)
	}

	return nil
}

func (d *DB) prodMigrate(ctx context.Context) error {
	currentVersion := version.GetCurrentVersion(d.profile.Mode)
	migrationHistoryList, err := d.FindMigrationHistoryList(ctx, &store.FindMigrationHistory{})
	// If there is no migration history, we should apply the latest schema.
	if err != nil || len(migrationHistoryList) == 0 {
		buf, err := migrationFS.ReadFile("migration/prod/" + latestSchemaFileName)
		if err != nil {
			return errors.Errorf("failed to read latest schema file: %s", err)
		}

		stmt := string(buf)
		if _, err := d.db.ExecContext(ctx, stmt); err != nil {
			return errors.Errorf("failed to exec SQL %s: %s", stmt, err)
		}
		if _, err := d.UpsertMigrationHistory(ctx, &store.UpsertMigrationHistory{
			Version: currentVersion,
		}); err != nil {
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
	if !version.IsVersionGreaterThan(version.GetSchemaVersion(currentVersion), latestMigrationHistoryVersion) {
		return nil
	}

	println("start migrate")
	for _, minorVersion := range getMinorVersionList() {
		normalizedVersion := minorVersion + ".0"
		if version.IsVersionGreaterThan(normalizedVersion, latestMigrationHistoryVersion) && version.IsVersionGreaterOrEqualThan(currentVersion, normalizedVersion) {
			println("applying migration for", normalizedVersion)
			if err := d.applyMigrationForMinorVersion(ctx, minorVersion); err != nil {
				return errors.Wrap(err, "failed to apply minor version migration")
			}
		}
	}
	println("end migrate")
	return nil
}

func (d *DB) applyMigrationForMinorVersion(ctx context.Context, minorVersion string) error {
	filenames, err := fs.Glob(migrationFS, fmt.Sprintf("migration/prod/%s/*.sql", minorVersion))
	if err != nil {
		return errors.Wrap(err, "failed to read ddl files")
	}

	sort.Strings(filenames)
	// Loop over all migration files and execute them in order.
	for _, filename := range filenames {
		buf, err := migrationFS.ReadFile(filename)
		if err != nil {
			return errors.Wrapf(err, "failed to read minor version migration file, filename=%s", filename)
		}
		for _, stmt := range strings.Split(string(buf), ";") {
			if strings.TrimSpace(stmt) == "" {
				continue
			}
			if _, err := d.db.ExecContext(ctx, stmt); err != nil {
				return errors.Wrapf(err, "migrate error: %s", stmt)
			}
		}
	}

	// Upsert the newest version to migration_history.
	version := minorVersion + ".0"
	if _, err = d.UpsertMigrationHistory(ctx, &store.UpsertMigrationHistory{Version: version}); err != nil {
		return errors.Wrapf(err, "failed to upsert migration history with version: %s", version)
	}

	return nil
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

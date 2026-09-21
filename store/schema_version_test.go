package store

import (
	"io/fs"
	"maps"
	"slices"
	"testing"
	"testing/fstest"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"golang.org/x/mod/semver"
)

func TestCompareSchemaVersions(t *testing.T) {
	for _, tc := range []struct {
		a, b string
		want int
	}{
		{"0.31.7", "0.31.8", -1},
		{"0.31.8", "0.31.8", 0},
		{"26.9.1", "0.31.8", 1},
		{"26.9.10", "26.9.2", 1},
		{"26.10.1", "26.9.99", 1},
		{"27.1.1", "26.12.99", 1},
	} {
		order, err := compareSchemaVersions(tc.a, tc.b)
		require.NoError(t, err)
		require.Equal(t, tc.want, order)
	}
	for _, invalid := range []string{"", "dev", "26.09.1", "26.9", "26.0.1", "26.13.1", "26.9.01", "26.9.1-rc.1", "26.9.1+build", "0.031.8", "26.9.999999999999999999999999"} {
		_, err := compareSchemaVersions(invalid, baselineSchemaVersion)
		require.Error(t, err, invalid)
		_, err = compareSchemaVersions(baselineSchemaVersion, invalid)
		require.Error(t, err, invalid)
	}
}

func migrationFixture(paths ...string) fstest.MapFS {
	fsys := fstest.MapFS{}
	for _, path := range paths {
		fsys[path] = &fstest.MapFile{Data: []byte("SELECT 1;")}
	}
	return fsys
}

func TestCalendarMigrationOrdering(t *testing.T) {
	files, err := listMigrationFilesFrom(migrationFixture(
		"migration/sqlite/LATEST.sql",
		"migration/sqlite/27.01/00__next_year.sql",
		"migration/sqlite/26.09/100__many_changes.sql",
		"migration/sqlite/26.10/00__next_month.sql",
		"migration/sqlite/26.09/09__tenth.sql",
		"migration/sqlite/26.09/00__first.sql",
	), "migration/sqlite/")
	require.NoError(t, err)
	var versions []string
	for _, file := range files {
		versions = append(versions, file.version)
		require.Equal(t, mustParseSchemaVersion(file.version), file.parsed)
		// v0.31.0 uses this comparator for its downgrade guard.
		require.True(t, semver.IsValid("v"+file.version))
		require.Positive(t, semver.Compare("v"+file.version, "v"+baselineSchemaVersion))
	}
	require.Equal(t, []string{"26.9.1", "26.9.10", "26.9.101", "26.10.1", "27.1.1"}, versions)
	v, err := getSchemaVersionOfMigrateScript("migration/sqlite/26.09/00__LATEST.sql")
	require.NoError(t, err)
	require.Equal(t, "26.9.1", v)
	for _, path := range []string{
		"migration/sqlite/26.13/00__bad_month.sql",
		"migration/sqlite/26.9/00__unpadded.sql",
		"migration/sqlite/26.09/-1__negative.sql",
		"migration/sqlite/26.09/00.sql",
		"migration/sqlite/26.09/00__.sql",
		"migration/sqlite/26.09/LATEST.sql",
	} {
		_, err := listMigrationFilesFrom(migrationFixture(path), "migration/sqlite/")
		require.Error(t, err, path)
	}
}

func TestDuplicateMigrationSequenceIsRejected(t *testing.T) {
	_, err := listMigrationFilesFrom(migrationFixture(
		"migration/sqlite/26.09/00__first.sql",
		"migration/sqlite/26.09/01__add_index.sql",
		"migration/sqlite/26.09/01__rename_column.sql",
	), "migration/sqlite/")
	require.ErrorContains(t, err, "both resolve to schema version 26.9.2")
}

func TestCalendarMigrationSelection(t *testing.T) {
	for _, tc := range []struct {
		file, current, target string
		want                  bool
	}{
		{"26.9.1", "0.31.8", "26.10.1", true},
		{"26.9.1", "26.9.1", "26.10.1", false},
		{"26.9.2", "26.9.1", "26.9.2", true},
		{"26.9.3", "26.9.1", "26.9.2", false},
		{"27.1.1", "26.12.1", "27.1.1", true},
	} {
		apply := shouldApplyMigration(mustParseSchemaVersion(tc.file), mustParseSchemaVersion(tc.current), mustParseSchemaVersion(tc.target))
		require.Equal(t, tc.want, apply, "%+v", tc)
	}
}

// migrationVersionsByDriver lists each driver's migration versions in order.
func migrationVersionsByDriver(t *testing.T, fsys fs.FS) map[string][]string {
	t.Helper()
	entries, err := fs.ReadDir(fsys, "migration")
	require.NoError(t, err)
	versions := map[string][]string{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		files, err := listMigrationFilesFrom(fsys, "migration/"+entry.Name()+"/")
		require.NoError(t, err, entry.Name())
		driverVersions := []string{}
		for _, file := range files {
			driverVersions = append(driverVersions, file.version)
		}
		versions[entry.Name()] = driverVersions
	}
	return versions
}

// migrationVersionMismatch names the first driver whose migration versions
// differ from another driver's, or returns nil when every driver agrees.
func migrationVersionMismatch(versions map[string][]string) error {
	drivers := slices.Sorted(maps.Keys(versions))
	for _, driver := range drivers[1:] {
		if !slices.Equal(versions[drivers[0]], versions[driver]) {
			return errors.Errorf("driver %s ships migration versions %v but %s ships %v",
				driver, versions[driver], drivers[0], versions[drivers[0]])
		}
	}
	return nil
}

// TestMigrationVersionsMatchAcrossDrivers guards the schema marker: a driver
// only records versions whose SQL it executed, so a migration must exist for
// every driver before any driver can advance past it.
func TestMigrationVersionsMatchAcrossDrivers(t *testing.T) {
	versions := migrationVersionsByDriver(t, migrationFS)
	require.Len(t, versions, 3)
	require.NoError(t, migrationVersionMismatch(versions))

	// The check itself catches a migration that lands for one driver only.
	partial := migrationVersionsByDriver(t, migrationFixture(
		"migration/mysql/LATEST.sql",
		"migration/postgres/LATEST.sql",
		"migration/sqlite/LATEST.sql",
		"migration/sqlite/26.09/00__sqlite_only.sql",
	))
	require.Equal(t, []string{"26.9.1"}, partial["sqlite"])
	require.Empty(t, partial["mysql"])
	require.ErrorContains(t, migrationVersionMismatch(partial), "driver sqlite ships migration versions [26.9.1] but mysql ships []")
}

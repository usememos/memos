package store

import (
	"testing"

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

func TestCalendarMigrationOrdering(t *testing.T) {
	s := &Store{}
	paths := []string{
		"migration/sqlite/27.01/00__next_year.sql",
		"migration/sqlite/26.09/100__many_changes.sql",
		"migration/sqlite/26.10/00__next_month.sql",
		"migration/sqlite/26.09/09__tenth.sql",
		"migration/sqlite/26.09/00__first.sql",
	}
	require.NoError(t, s.sortMigrationFiles(paths))
	var versions []string
	for _, path := range paths {
		v, err := s.getSchemaVersionOfMigrateScript(path)
		require.NoError(t, err)
		versions = append(versions, v)
		// v0.31.0 uses this comparator for its downgrade guard.
		require.True(t, semver.IsValid("v"+v))
		require.Positive(t, semver.Compare("v"+v, "v"+baselineSchemaVersion))
	}
	require.Equal(t, []string{"26.9.1", "26.9.10", "26.9.101", "26.10.1", "27.1.1"}, versions)
	v, err := s.getSchemaVersionOfMigrateScript("migration/sqlite/26.09/00__LATEST.sql")
	require.NoError(t, err)
	require.Equal(t, "26.9.1", v)
	for _, path := range []string{
		"migration/sqlite/26.13/00__bad_month.sql",
		"migration/sqlite/26.9/00__unpadded.sql",
		"migration/sqlite/26.09/-1__negative.sql",
		"migration/sqlite/26.09/00.sql",
		"migration/sqlite/26.09/00__.sql",
	} {
		require.Error(t, s.sortMigrationFiles([]string{path}), path)
	}
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
		apply, err := shouldApplyMigration(tc.file, tc.current, tc.target)
		require.NoError(t, err)
		require.Equal(t, tc.want, apply)
	}
	_, err := shouldApplyMigration("26.9.1", "unknown", "26.9.2")
	require.Error(t, err)
}

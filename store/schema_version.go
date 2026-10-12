package store

import (
	"cmp"
	"regexp"
	"strconv"
	"strings"

	"github.com/pkg/errors"
)

// Schema versions are legacy 0.MINOR.SEQUENCE or calendar YY.M.SEQUENCE.
// The sequence tracks database migrations, independently of release revisions.
// Calendar markers omit month padding so old binaries can reject downgrades
// using their SemVer comparator. Release tags and migration directories retain it.
var calendarMigrationSeriesPattern = regexp.MustCompile(`^[1-9][0-9]\.(0[1-9]|1[0-2])$`)
var migrationFilePattern = regexp.MustCompile(`^[0-9]+__[^/]+\.sql$`)
var schemaVersionPattern = regexp.MustCompile(`^(0\.(0|[1-9][0-9]*)|[1-9][0-9]\.([1-9]|1[0-2]))\.(0|[1-9][0-9]*)$`)

func parseSchemaVersion(value string) ([3]int, error) {
	var result [3]int
	if !schemaVersionPattern.MatchString(value) {
		return result, errors.Errorf("invalid database schema version %q", value)
	}
	for i, part := range strings.Split(value, ".") {
		number, err := strconv.Atoi(part)
		if err != nil {
			return result, errors.Wrapf(err, "invalid database schema version %q", value)
		}
		result[i] = number
	}
	return result, nil
}

// mustParseSchemaVersion is for versions the migrator itself produced or
// declared as constants; those are valid by construction.
func mustParseSchemaVersion(value string) [3]int {
	parsed, err := parseSchemaVersion(value)
	if err != nil {
		panic(err)
	}
	return parsed
}

func compareParsedSchemaVersions(a, b [3]int) int {
	for i := range a {
		if order := cmp.Compare(a[i], b[i]); order != 0 {
			return order
		}
	}
	return 0
}

func compareSchemaVersions(a, b string) (int, error) {
	left, err := parseSchemaVersion(a)
	if err != nil {
		return 0, err
	}
	right, err := parseSchemaVersion(b)
	if err != nil {
		return 0, err
	}
	return compareParsedSchemaVersions(left, right), nil
}

package store

import (
	"context"
	"log/slog"
	"strings"
)

// uniqueEmailSchemaVersion is the schema version introduced by
// migration/{driver}/0.31/07__unique_email.sql; the migrator numbers a file
// as its patch number plus one.
const uniqueEmailSchemaVersion = "0.31.8"

// reportUniqueEmailMigrationImpact logs, before the unique-email migration
// runs, which accounts it will change. The migration itself is plain SQL and
// cannot log, and an operator whose second account silently loses its address
// would otherwise have no way to find out. The queries mirror the migration's
// rules exactly: addresses are compared trimmed and lowercased, values
// without an '@' are cleared, and within a duplicate group the lowest id
// keeps the address.
//
// The report never blocks the migration; a failure to read is logged and
// ignored.
func (s *Store) reportUniqueEmailMigrationImpact(ctx context.Context, currentSchemaVersion, targetSchemaVersion string) {
	if !shouldApplyMigration(uniqueEmailSchemaVersion, currentSchemaVersion, targetSchemaVersion) {
		return
	}

	rows, err := s.driver.GetDB().QueryContext(ctx, s.uniqueEmailReportQuery())
	if err != nil {
		slog.Warn("unable to inspect user emails before the unique-email migration", slog.String("error", err.Error()))
		return
	}
	defer rows.Close()

	type account struct {
		username string
		email    string
	}
	// Rows arrive ordered by id, so the first account seen for an address is
	// the one the migration keeps.
	keeper := map[string]account{}
	cleared := map[string][]string{}
	malformed := []string{}
	for rows.Next() {
		var current account
		if err := rows.Scan(&current.username, &current.email); err != nil {
			slog.Warn("unable to inspect user emails before the unique-email migration", slog.String("error", err.Error()))
			return
		}
		canonical := strings.ToLower(strings.TrimSpace(current.email))
		if canonical == "" {
			continue
		}
		if !strings.Contains(canonical, "@") {
			malformed = append(malformed, current.username)
			continue
		}
		if _, exists := keeper[canonical]; !exists {
			keeper[canonical] = current
			continue
		}
		cleared[canonical] = append(cleared[canonical], current.username)
	}
	if err := rows.Err(); err != nil {
		slog.Warn("unable to inspect user emails before the unique-email migration", slog.String("error", err.Error()))
		return
	}

	for canonical, losers := range cleared {
		slog.Warn("unique-email migration will clear a duplicate address",
			slog.String("email", canonical),
			slog.String("keptBy", keeper[canonical].username),
			slog.Any("clearedFrom", losers),
		)
	}
	if len(malformed) > 0 {
		slog.Warn("unique-email migration will clear malformed addresses",
			slog.Int("count", len(malformed)),
			slog.Any("users", malformed),
		)
	}
}

// uniqueEmailReportQuery selects every user that currently has a non-empty
// address, oldest first, using the pre-migration column shape.
func (s *Store) uniqueEmailReportQuery() string {
	switch s.profile.Driver {
	case "mysql":
		return "SELECT `username`, `email` FROM `user` WHERE `email` <> '' ORDER BY `id`"
	case "postgres":
		return `SELECT username, email FROM "user" WHERE email <> '' ORDER BY id`
	default:
		return "SELECT username, email FROM user WHERE email <> '' ORDER BY id"
	}
}

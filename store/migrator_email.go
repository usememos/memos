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

// prepareUniqueEmailMigration runs before the unique-email migration and does
// two things the SQL file cannot do on its own.
//
// First, it rewrites every stored address into the canonical form used by
// util.NormalizeEmail: trimmed and lowercased with Unicode rules. SQLite's
// LOWER folds ASCII only, and PostgreSQL does the same under a C locale, so
// without this pass "Ä@example.com" and "ä@example.com" could both survive
// the migration's deduplication and the unique index would then permit a
// canonical collision. The rewrite is idempotent and touches only rows whose
// stored value differs from its canonical form.
//
// Second, it logs which accounts the migration will change. The migration
// itself is plain SQL and cannot log, and an operator whose second account
// silently loses its address would otherwise have no way to find out. The
// rules mirror the migration exactly: values that do not look like an address
// are cleared, and within a duplicate group the lowest id keeps the address.
// Addresses themselves are not logged; usernames are enough for the operator
// to find the affected accounts.
//
// Neither step blocks the migration; a failure is logged and ignored.
func (s *Store) prepareUniqueEmailMigration(ctx context.Context, currentSchemaVersion, targetSchemaVersion string) {
	if !shouldApplyMigration(uniqueEmailSchemaVersion, currentSchemaVersion, targetSchemaVersion) {
		return
	}

	accounts, err := s.loadLegacyEmailAccounts(ctx)
	if err != nil {
		slog.Warn("unable to inspect user emails before the unique-email migration", slog.String("error", err.Error()))
		return
	}

	// Pass 1: Unicode-aware canonicalization.
	canonicalized := 0
	tx, err := s.driver.GetDB().BeginTx(ctx, nil)
	if err != nil {
		slog.Warn("unable to canonicalize user emails before the unique-email migration", slog.String("error", err.Error()))
	} else {
		updateQuery := s.uniqueEmailUpdateQuery()
		for _, current := range accounts {
			canonical := strings.ToLower(strings.TrimSpace(current.email))
			if canonical == current.email {
				continue
			}
			if _, err := tx.ExecContext(ctx, updateQuery, canonical, current.id); err != nil {
				_ = tx.Rollback()
				slog.Warn("unable to canonicalize user emails before the unique-email migration", slog.String("error", err.Error()))
				canonicalized = -1
				break
			}
			canonicalized++
		}
		if canonicalized >= 0 {
			if err := tx.Commit(); err != nil {
				slog.Warn("unable to canonicalize user emails before the unique-email migration", slog.String("error", err.Error()))
			} else if canonicalized > 0 {
				slog.Info("canonicalized user emails before the unique-email migration", slog.Int("count", canonicalized))
			}
		}
	}

	// Pass 2: report. Rows arrive ordered by id, so the first account seen for
	// an address is the one the migration keeps.
	keeper := map[string]string{}
	cleared := map[string][]string{}
	malformed := []string{}
	for _, current := range accounts {
		canonical := strings.ToLower(strings.TrimSpace(current.email))
		if canonical == "" {
			continue
		}
		if !legacyEmailLooksLikeAddress(canonical) {
			malformed = append(malformed, current.username)
			continue
		}
		if _, exists := keeper[canonical]; !exists {
			keeper[canonical] = current.username
			continue
		}
		cleared[canonical] = append(cleared[canonical], current.username)
	}
	for canonical, losers := range cleared {
		slog.Warn("unique-email migration will clear a duplicate address",
			slog.String("keptBy", keeper[canonical]),
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

// legacyEmailAccount is one pre-migration user row with a non-empty address.
type legacyEmailAccount struct {
	id       int32
	username string
	email    string
}

// loadLegacyEmailAccounts reads every user with a non-empty address, oldest
// first. The result set is fully consumed and closed before the caller
// writes, which matters on SQLite where an open cursor blocks a writer.
func (s *Store) loadLegacyEmailAccounts(ctx context.Context) ([]legacyEmailAccount, error) {
	rows, err := s.driver.GetDB().QueryContext(ctx, s.uniqueEmailSelectQuery())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []legacyEmailAccount{}
	for rows.Next() {
		var current legacyEmailAccount
		if err := rows.Scan(&current.id, &current.username, &current.email); err != nil {
			return nil, err
		}
		accounts = append(accounts, current)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}

// legacyEmailLooksLikeAddress mirrors the migration's SQL rule for values that
// are kept: it must contain an '@' and none of the characters that only appear
// in display-name forms or other junk the API would refuse.
func legacyEmailLooksLikeAddress(email string) bool {
	return strings.Contains(email, "@") && !strings.ContainsAny(email, "<> ")
}

// uniqueEmailSelectQuery selects every user that currently has a non-empty
// address, oldest first, using the pre-migration column shape.
func (s *Store) uniqueEmailSelectQuery() string {
	switch s.profile.Driver {
	case "mysql":
		return "SELECT `id`, `username`, `email` FROM `user` WHERE `email` <> '' ORDER BY `id`"
	case "postgres":
		return `SELECT id, username, email FROM "user" WHERE email <> '' ORDER BY id`
	default:
		return "SELECT id, username, email FROM user WHERE email <> '' ORDER BY id"
	}
}

// uniqueEmailUpdateQuery rewrites one user's address by id.
func (s *Store) uniqueEmailUpdateQuery() string {
	switch s.profile.Driver {
	case "mysql":
		return "UPDATE `user` SET `email` = ? WHERE `id` = ?"
	case "postgres":
		return `UPDATE "user" SET email = $1 WHERE id = $2`
	default:
		return "UPDATE user SET email = ? WHERE id = ?"
	}
}

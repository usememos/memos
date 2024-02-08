package dbv2

import (
	"fmt"

	"github.com/go-sql-driver/mysql"

	"github.com/usememos/memos/ent"
	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/server/profile"
)

// NewDBDriver creates new db driver based on profile.
func NewDriver(profile *profile.Profile) (*ent.Client, error) {
	var driver *ent.Client
	var err error

	switch profile.Driver {
	case "mysql":
		// TODO(kw): do we still need this?
		//
		// Open MySQL connection with parameter.
		// multiStatements=true is required for migration.
		// See more in: https://github.com/go-sql-driver/mysql#multistatements
		dsn, err := mergeDSN(profile.DSN)
		if err != nil {
			log.Error(fmt.Sprintf("DSN %s error: %v", dsn, err))
			return nil, err
		}

		driver, err = ent.Open("mysql", dsn)
	default:
		return nil, fmt.Errorf("unknown dbv2 driver")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create db driver: %w", err)
	}

	return driver, nil
}

func mergeDSN(baseDSN string) (string, error) {
	config, err := mysql.ParseDSN(baseDSN)
	if err != nil {
		return "", fmt.Errorf("failed to parse DSN %s: %w", baseDSN, err)
	}

	config.MultiStatements = true
	return config.FormatDSN(), nil
}

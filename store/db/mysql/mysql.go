package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"

	"github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type DB struct {
	db      *sql.DB
	profile *profile.Profile
	config  *mysql.Config
}

func NewDB(profile *profile.Profile) (store.Driver, error) {
	// Open MySQL connection with parameter.
	// multiStatements=true is required for migration.
	// See more in: https://github.com/go-sql-driver/mysql#multistatements
	dsn, err := mergeDSNWithParams(profile.DSN, map[string]string{
		"multiStatements": "true",
	})
	if err != nil {
		return nil, err
	}

	driver := DB{profile: profile}
	driver.config, err = mysql.ParseDSN(dsn)
	if err != nil {
		log.Error(fmt.Sprintf("DSN parse error: %s", dsn))
		return nil, errors.New("Parse DSN eroor")
	}

	driver.db, err = sql.Open("mysql", dsn)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open db: %s", profile.DSN)
	}

	return &driver, nil
}

func (d *DB) GetDB() *sql.DB {
	return d.db
}

func (d *DB) Vacuum(ctx context.Context) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := vacuumMemo(ctx, tx); err != nil {
		return err
	}
	if err := vacuumResource(ctx, tx); err != nil {
		return err
	}
	if err := vacuumUserSetting(ctx, tx); err != nil {
		return err
	}
	if err := vacuumMemoOrganizer(ctx, tx); err != nil {
		return err
	}
	if err := vacuumMemoRelations(ctx, tx); err != nil {
		return err
	}
	if err := vacuumInbox(ctx, tx); err != nil {
		return err
	}
	if err := vacuumTag(ctx, tx); err != nil {
		// Prevent revive warning.
		return err
	}

	return tx.Commit()
}

func (d *DB) GetCurrentDBSize(ctx context.Context) (int64, error) {
	query := "SELECT SUM(`data_length` + `index_length`) AS `size` " +
		" FROM information_schema.TABLES" +
		" WHERE `table_schema` = ?" +
		" GROUP BY `table_schema`"
	rows, err := d.db.QueryContext(ctx, query, d.config.DBName)
	if err != nil {
		log.Error("Query db size error, make sure you have enough privilege")
		return 0, err
	}
	defer rows.Close()

	var size int64
	for rows.Next() {
		if err := rows.Scan(&size); err != nil {
			return 0, err
		}
	}

	if rows.Err() != nil {
		return 0, rows.Err()
	}

	return size, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

func mergeDSNWithParams(baseDSN string, params map[string]string) (string, error) {
	parsedDSN, err := url.Parse(baseDSN)
	if err != nil {
		return "", errors.Wrapf(err, "failed to parse DSN: %s", baseDSN)
	}

	existingParams := parsedDSN.Query()
	for key, value := range params {
		existingParams.Add(key, value)
	}
	parsedDSN.RawQuery = existingParams.Encode()
	return parsedDSN.String(), nil
}

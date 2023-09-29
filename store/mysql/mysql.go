package mysql

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/pkg/errors"

	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type Driver struct {
	db      *sql.DB
	profile *profile.Profile
}

func NewDriver(profile *profile.Profile) (store.Driver, error) {
	// Open MySQL connection with parameter.
	// multiStatements=true is required for migration.
	// See more in: https://github.com/go-sql-driver/mysql#multistatements
	db, err := sql.Open("mysql", fmt.Sprintf("%s?multiStatements=true", profile.DSN))
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open db: %s", profile.DSN)
	}

	driver := Driver{db: db, profile: profile}
	return &driver, nil
}

func (d *Driver) GetDB() *sql.DB {
	return d.db
}

func (d *Driver) Vacuum(ctx context.Context) error {
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
	if err := vacuumTag(ctx, tx); err != nil {
		// Prevent revive warning.
		return err
	}

	return tx.Commit()
}

func (*Driver) BackupTo(context.Context, string) error {
	return errors.New("Please use mysqldump to backup")
}

func (d *Driver) Close() error {
	return d.db.Close()
}

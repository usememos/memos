package sqlite

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"
	"modernc.org/sqlite"

	"github.com/usememos/memos/store"
)

type Driver struct {
	db *sql.DB
}

func NewDriver(db *sql.DB) store.Driver {
	return &Driver{
		db: db,
	}
}

func (d *Driver) Vacuum(ctx context.Context) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := vacuumImpl(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// Vacuum sqlite database file size after deleting resource.
	if _, err := d.db.Exec("VACUUM"); err != nil {
		return err
	}

	return nil
}

func vacuumImpl(ctx context.Context, tx *sql.Tx) error {
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

	return nil
}

func (d *Driver) BackupTo(ctx context.Context, filename string) error {
	conn, err := d.db.Conn(ctx)
	if err != nil {
		return errors.Errorf("fail to get conn %s", err)
	}
	defer conn.Close()

	err = conn.Raw(func(driverConn any) error {
		type backuper interface {
			NewBackup(string) (*sqlite.Backup, error)
		}
		backupConn, ok := driverConn.(backuper)
		if !ok {
			return errors.Errorf("db connection is not a sqlite backuper")
		}

		bck, err := backupConn.NewBackup(filename)
		if err != nil {
			return errors.Errorf("fail to create sqlite backup %s", err)
		}

		for more := true; more; {
			more, err = bck.Step(-1)
			if err != nil {
				return errors.Errorf("fail to execute sqlite backup %s", err)
			}
		}

		return bck.Finish()
	})
	if err != nil {
		return errors.Errorf("fail to backup %s", err)
	}

	return nil
}

func (d *Driver) Close() error {
	return d.db.Close()
}

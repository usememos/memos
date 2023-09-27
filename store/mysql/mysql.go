package mysql

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/common/log"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

var errNotImplemented = errors.New("not implemented")

type Driver struct {
	db      *sql.DB
	profile *profile.Profile
}

func NewDriver(profile *profile.Profile) (store.Driver, error) {
	db, err := sql.Open("mysql", profile.DSN)
	if err != nil {
		return nil, err
	}

	driver := Driver{db: db, profile: profile}
	return &driver, nil
}

func (d *Driver) Vacuum(ctx context.Context) error {
	_, _ = d, ctx
	log.Error("driver.Vacuum MUST BE implement")
	return nil
}

func (d *Driver) BackupTo(ctx context.Context, filename string) error {
	_, _, _ = d, ctx, filename
	return errNotImplemented
}

func (d *Driver) Close() error {
	_ = d
	return errNotImplemented
}

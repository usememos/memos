package store

import (
	"context"
	"database/sql"
	"sync"

	"modernc.org/sqlite"

	"github.com/pkg/errors"

	"github.com/usememos/memos/server/profile"
)

// Store provides database access to all raw objects.
type Store struct {
	Profile            *profile.Profile
	db                 *sql.DB
	driver             Driver
	systemSettingCache sync.Map // map[string]*SystemSetting
	userCache          sync.Map // map[int]*User
	userSettingCache   sync.Map // map[string]*UserSetting
	idpCache           sync.Map // map[int]*IdentityProvider
}

// New creates a new instance of Store.
func New(db *sql.DB, driver Driver, profile *profile.Profile) *Store {
	return &Store{
		Profile: profile,
		db:      db,
		driver:  driver,
	}
}

func (s *Store) GetDB() *sql.DB {
	return s.db
}

func (s *Store) BackupTo(ctx context.Context, filename string) error {
	conn, err := s.db.Conn(ctx)
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

func (s *Store) Vacuum(ctx context.Context) error {
	return s.driver.Vacuum(ctx)
}

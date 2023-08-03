package store

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"github.com/usememos/memos/server/profile"
	"modernc.org/sqlite"
)

// Store provides database access to all raw objects.
type Store struct {
	Profile            *profile.Profile
	db                 *sql.DB
	systemSettingCache sync.Map // map[string]*SystemSetting
	userCache          sync.Map // map[int]*User
	userSettingCache   sync.Map // map[string]*UserSetting
	idpCache           sync.Map // map[int]*IdentityProvider
}

// New creates a new instance of Store.
func New(db *sql.DB, profile *profile.Profile) *Store {
	return &Store{
		Profile: profile,
		db:      db,
	}
}

func (s *Store) GetDB() *sql.DB {
	return s.db
}

func (s *Store) BackupTo(ctx context.Context, filename string) error {
	conn, err := s.db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("fail to get conn %s", err)
	}
	defer conn.Close()

	err = conn.Raw(func(driverConn any) error {
		type backuper interface {
			NewBackup(string) (*sqlite.Backup, error)
		}
		backupConn, ok := driverConn.(backuper)
		if !ok {
			return fmt.Errorf("db connection is not a sqlite backuper")
		}

		bck, err := backupConn.NewBackup(filename)
		if err != nil {
			return fmt.Errorf("fail to create sqlite backup %s", err)
		}

		for more := true; more; {
			more, err = bck.Step(-1)
			if err != nil {
				return fmt.Errorf("fail to execute sqlite backup %s", err)
			}
		}

		return bck.Finish()
	})
	if err != nil {
		return fmt.Errorf("fail to backup %s", err)
	}

	return nil
}

func (s *Store) Vacuum(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.vacuumImpl(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// Vacuum sqlite database file size after deleting resource.
	if _, err := s.db.Exec("VACUUM"); err != nil {
		return err
	}

	return nil
}

func (*Store) vacuumImpl(ctx context.Context, tx *sql.Tx) error {
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
	if err := vacuumMemoResource(ctx, tx); err != nil {
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

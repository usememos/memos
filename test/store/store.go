package teststore

import (
	"context"
	"fmt"
	"testing"

	// mysql driver.
	_ "github.com/go-sql-driver/mysql"
	// sqlite driver.
	_ "modernc.org/sqlite"

	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
	"github.com/usememos/memos/test"
)

func NewTestingStore(ctx context.Context, t *testing.T) *store.Store {
	profile := test.GetTestingProfile(t)
	dbDriver, err := db.NewDBDriver(profile)
	if err != nil {
		fmt.Printf("failed to create db driver, error: %+v\n", err)
	}
	if err := dbDriver.Migrate(ctx); err != nil {
		fmt.Printf("failed to migrate db, error: %+v\n", err)
	}

	store := store.New(dbDriver, profile)
	return store
}

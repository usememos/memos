package teststore

import (
	"context"
	"fmt"
	"testing"

	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
	"github.com/usememos/memos/store/sqlite3"
	"github.com/usememos/memos/test"

	// sqlite driver.
	_ "modernc.org/sqlite"
)

func NewTestingStore(ctx context.Context, t *testing.T) *store.Store {
	profile := test.GetTestingProfile(t)
	db := db.NewDB(profile)
	if err := db.Open(); err != nil {
		fmt.Printf("failed to open db, error: %+v\n", err)
	}
	if err := db.Migrate(ctx); err != nil {
		fmt.Printf("failed to migrate db, error: %+v\n", err)
	}

	driver := sqlite3.NewDriver(db.DBInstance)

	store := store.New(db.DBInstance, driver, profile)
	return store
}

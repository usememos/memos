package teststore

import (
	"context"
	"fmt"
	"testing"

	// sqlite driver.
	_ "modernc.org/sqlite"

	"github.com/usememos/memos/server/profile"
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
	resetTestingDB(ctx, profile, dbDriver)
	if err := dbDriver.Migrate(ctx); err != nil {
		fmt.Printf("failed to migrate db, error: %+v\n", err)
	}

	store := store.New(dbDriver, profile)
	return store
}

func resetTestingDB(ctx context.Context, profile *profile.Profile, dbDriver store.Driver) {
	if profile.Driver == "postgres" {
		_, err := dbDriver.GetDB().ExecContext(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
		if err != nil {
			fmt.Printf("failed to reset testing db, error: %+v\n", err)
			panic(err)
		}
	}
}

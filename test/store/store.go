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
	if profile.Driver == "mysql" {
		_, err := dbDriver.GetDB().ExecContext(ctx, `
		DROP TABLE IF EXISTS migration_history;
		DROP TABLE IF EXISTS system_setting;
		DROP TABLE IF EXISTS user;
		DROP TABLE IF EXISTS user_setting;
		DROP TABLE IF EXISTS memo;
		DROP TABLE IF EXISTS memo_organizer;
		DROP TABLE IF EXISTS memo_relation;
		DROP TABLE IF EXISTS resource;
		DROP TABLE IF EXISTS tag;
		DROP TABLE IF EXISTS activity;
		DROP TABLE IF EXISTS storage;
		DROP TABLE IF EXISTS idp;
		DROP TABLE IF EXISTS inbox;
		DROP TABLE IF EXISTS webhook;`)
		if err != nil {
			fmt.Printf("failed to reset testing db, error: %+v\n", err)
			panic(err)
		}
	} else if profile.Driver == "postgres" {
		_, err := dbDriver.GetDB().ExecContext(ctx, `
		DROP TABLE IF EXISTS migration_history CASCADE;
		DROP TABLE IF EXISTS system_setting CASCADE;
		DROP TABLE IF EXISTS "user" CASCADE;
		DROP TABLE IF EXISTS user_setting CASCADE;
		DROP TABLE IF EXISTS memo CASCADE;
		DROP TABLE IF EXISTS memo_organizer CASCADE;
		DROP TABLE IF EXISTS memo_relation CASCADE;
		DROP TABLE IF EXISTS resource CASCADE;
		DROP TABLE IF EXISTS tag CASCADE;
		DROP TABLE IF EXISTS activity CASCADE;
		DROP TABLE IF EXISTS storage CASCADE;
		DROP TABLE IF EXISTS idp CASCADE;
		DROP TABLE IF EXISTS inbox CASCADE;
		DROP TABLE IF EXISTS webhook CASCADE;`)
		if err != nil {
			fmt.Printf("failed to reset testing db, error: %+v\n", err)
			panic(err)
		}
	}
}

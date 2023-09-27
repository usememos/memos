package teststore

import (
	"context"
	"fmt"
	"testing"

	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/sqlite"
	"github.com/usememos/memos/test"

	// sqlite driver.
	_ "modernc.org/sqlite"
)

func NewTestingStore(ctx context.Context, t *testing.T) *store.Store {
	profile := test.GetTestingProfile(t)
	driver, err := sqlite.NewDriver(profile)
	if err != nil {
		fmt.Printf("failed to create db driver, error: %+v\n", err)
	}
	if err := driver.Migrate(ctx); err != nil {
		fmt.Printf("failed to migrate db, error: %+v\n", err)
	}

	store := store.New(driver, profile)
	return store
}

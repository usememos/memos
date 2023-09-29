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
	"github.com/usememos/memos/store/mysql"
	"github.com/usememos/memos/store/sqlite"
	"github.com/usememos/memos/test"
)

func NewTestingStore(ctx context.Context, t *testing.T) *store.Store {
	profile := test.GetTestingProfile(t)
	var driver store.Driver
	var err error
	switch profile.Driver {
	case "sqlite":
		driver, err = sqlite.NewDriver(profile)
	case "mysql":
		driver, err = mysql.NewDriver(profile)
	default:
		panic(fmt.Sprintf("unknown db driver: %s", profile.Driver))
	}
	if err != nil {
		fmt.Printf("failed to create db driver, error: %+v\n", err)
	}
	if err := driver.Migrate(ctx); err != nil {
		fmt.Printf("failed to migrate db, error: %+v\n", err)
	}

	store := store.New(driver, profile)
	return store
}

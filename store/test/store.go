package teststore

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"testing"

	// sqlite driver.
	_ "modernc.org/sqlite"

	"github.com/joho/godotenv"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

func NewTestingStore(ctx context.Context, t *testing.T) *store.Store {
	profile := getTestingProfile(t)
	dbDriver, err := db.NewDBDriver(profile)
	if err != nil {
		slog.Error("failed to create db driver", slog.String("error", err.Error()))
	}
	resetTestingDB(ctx, profile, dbDriver)

	store := store.New(dbDriver, profile)
	if err := store.Migrate(ctx); err != nil {
		slog.Error("failed to migrate db", slog.String("error", err.Error()))
	}
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
		DROP TABLE IF EXISTS reaction;`)
		if err != nil {
			slog.Error("failed to reset testing db", slog.String("error", err.Error()))
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
		DROP TABLE IF EXISTS reaction CASCADE;`)
		if err != nil {
			slog.Error("failed to reset testing db", slog.String("error", err.Error()))
			panic(err)
		}
	}
}

func getUnusedPort() int {
	// Get a random unused port
	listener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		panic(err)
	}
	defer listener.Close()

	// Get the port number
	port := listener.Addr().(*net.TCPAddr).Port
	return port
}

func getTestingProfile(t *testing.T) *profile.Profile {
	if err := godotenv.Load(".env"); err != nil {
		t.Log("failed to load .env file, but it's ok")
	}

	// Get a temporary directory for the test data.
	dir := t.TempDir()
	mode := "prod"
	port := getUnusedPort()
	driver := getDriverFromEnv()
	dsn := os.Getenv("DSN")
	if driver == "sqlite" {
		dsn = fmt.Sprintf("%s/memos_%s.db", dir, mode)
	}
	return &profile.Profile{
		Mode:    mode,
		Port:    port,
		Data:    dir,
		DSN:     dsn,
		Driver:  driver,
		Version: version.GetCurrentVersion(mode),
	}
}

func getDriverFromEnv() string {
	driver := os.Getenv("DRIVER")
	if driver == "" {
		driver = "sqlite"
	}
	return driver
}

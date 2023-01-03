package main

import (
	"os"

	_ "github.com/mattn/go-sqlite3"

	"context"
	"fmt"

	"github.com/usememos/memos/server"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"

	DB "github.com/usememos/memos/store/db"
)

const (
	greetingBanner = `
███╗   ███╗███████╗███╗   ███╗ ██████╗ ███████╗
████╗ ████║██╔════╝████╗ ████║██╔═══██╗██╔════╝
██╔████╔██║█████╗  ██╔████╔██║██║   ██║███████╗
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║╚════██║
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝███████║
╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝
`
)

func run() error {
	ctx := context.Background()
	profile, err := profile.GetProfile()
	if err != nil {
		return err
	}
	println("---")
	println("profile")
	println("mode:", profile.Mode)
	println("port:", profile.Port)
	println("dsn:", profile.DSN)
	println("version:", profile.Version)
	println("---")

	db := DB.NewDB(profile)
	if err := db.Open(ctx); err != nil {
		return fmt.Errorf("cannot open db: %w", err)
	}

	serverInstance := server.NewServer(profile)
	storeInstance := store.New(db.Db, profile)
	serverInstance.Store = storeInstance

	metricCollector := server.NewMetricCollector(profile, storeInstance)
	// Disable metrics collector.
	metricCollector.Enabled = false
	serverInstance.Collector = &metricCollector

	println(greetingBanner)
	fmt.Printf("Version %s has started at :%d\n", profile.Version, profile.Port)
	return serverInstance.Run(ctx)
}

func main() {
	if err := run(); err != nil {
		fmt.Printf("error: %+v\n", err)
		os.Exit(1)
	}
}

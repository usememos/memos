package cmd

import (
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

func Run(profile *profile.Profile) error {
	ctx := context.Background()

	db := DB.NewDB(profile)
	if err := db.Open(ctx); err != nil {
		return fmt.Errorf("cannot open db: %w", err)
	}

	s := server.NewServer(profile)

	storeInstance := store.New(db.Db, profile)
	s.Store = storeInstance

	println(greetingBanner)
	fmt.Printf("Version %s has started at :%d\n", profile.Version, profile.Port)

	return s.Run()
}

func Execute() error {
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

	if err := Run(profile); err != nil {
		fmt.Printf("error: %+v\n", err)
		return err
	}

	return nil
}

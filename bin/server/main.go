package main

import (
	"os"

	_ "github.com/mattn/go-sqlite3"
	"github.com/pkg/errors"

	"context"
	"fmt"

	"github.com/usememos/memos/server"
	"github.com/usememos/memos/server/profile"
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

	serverInstance, err := server.NewServer(ctx, profile)
	if err != nil {
		return errors.Wrap(err, "failed to start server")
	}

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

package main

import (
	"net/http"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/mattn/go-sqlite3"

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

func main() {
	profile, err := profile.GetProfile()
	if err != nil {
		fmt.Printf("failed to get profile, error: %+v\n", err)
		return
	}
	println("---")
	println("profile")
	println("mode:", profile.Mode)
	println("port:", profile.Port)
	println("dsn:", profile.DSN)
	println("version:", profile.Version)
	println("---")

	ctx, cancel := context.WithCancel(context.Background())
	s, err := server.NewServer(ctx, profile)
	if err != nil {
		cancel()
		fmt.Printf("failed to create server, error: %+v\n", err)
		return
	}

	c := make(chan os.Signal, 1)
	// Trigger graceful shutdown on SIGINT or SIGTERM.
	// The default signal sent by the `kill` command is SIGTERM,
	// which is taken as the graceful shutdown signal for many systems, eg., Kubernetes, Gunicorn.
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		sig := <-c
		fmt.Printf("%s received.\n", sig.String())
		s.Shutdown(ctx)
		cancel()
	}()

	println(greetingBanner)
	fmt.Printf("Version %s has started at :%d\n", profile.Version, profile.Port)
	if err := s.Start(ctx); err != nil {
		if err != http.ErrServerClosed {
			fmt.Printf("failed to start server, error: %+v\n", err)
			cancel()
		}
	}

	// Wait for CTRL-C.
	<-ctx.Done()
}

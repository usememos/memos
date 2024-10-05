package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/usememos/memos/server"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
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

var (
	rootCmd = &cobra.Command{
		Use:   "memos",
		Short: `An open source, lightweight note-taking service. Easily capture and share your great thoughts.`,
		Run: func(_ *cobra.Command, _ []string) {
			instanceProfile := &profile.Profile{
				Mode:        viper.GetString("mode"),
				Addr:        viper.GetString("addr"),
				Port:        viper.GetInt("port"),
				Data:        viper.GetString("data"),
				Driver:      viper.GetString("driver"),
				DSN:         viper.GetString("dsn"),
				InstanceURL: viper.GetString("instance-url"),
				Version:     version.GetCurrentVersion(viper.GetString("mode")),
			}
			if err := instanceProfile.Validate(); err != nil {
				panic(err)
			}

			ctx, cancel := context.WithCancel(context.Background())
			dbDriver, err := db.NewDBDriver(instanceProfile)
			if err != nil {
				cancel()
				slog.Error("failed to create db driver", "error", err)
				return
			}

			storeInstance := store.New(dbDriver, instanceProfile)
			if err := storeInstance.Migrate(ctx); err != nil {
				cancel()
				slog.Error("failed to migrate", "error", err)
				return
			}

			s, err := server.NewServer(ctx, instanceProfile, storeInstance)
			if err != nil {
				cancel()
				slog.Error("failed to create server", "error", err)
				return
			}

			c := make(chan os.Signal, 1)
			// Trigger graceful shutdown on SIGINT or SIGTERM.
			// The default signal sent by the `kill` command is SIGTERM,
			// which is taken as the graceful shutdown signal for many systems, eg., Kubernetes, Gunicorn.
			signal.Notify(c, os.Interrupt, syscall.SIGTERM)

			if err := s.Start(ctx); err != nil {
				if err != http.ErrServerClosed {
					slog.Error("failed to start server", "error", err)
					cancel()
				}
			}

			printGreetings(instanceProfile)

			go func() {
				<-c
				s.Shutdown(ctx)
				cancel()
			}()

			// Wait for CTRL-C.
			<-ctx.Done()
		},
	}
)

func init() {
	viper.SetDefault("mode", "dev")
	viper.SetDefault("driver", "sqlite")
	viper.SetDefault("port", 8081)

	rootCmd.PersistentFlags().String("mode", "dev", `mode of server, can be "prod" or "dev" or "demo"`)
	rootCmd.PersistentFlags().String("addr", "", "address of server")
	rootCmd.PersistentFlags().Int("port", 8081, "port of server")
	rootCmd.PersistentFlags().String("data", "", "data directory")
	rootCmd.PersistentFlags().String("driver", "sqlite", "database driver")
	rootCmd.PersistentFlags().String("dsn", "", "database source name(aka. DSN)")
	rootCmd.PersistentFlags().String("instance-url", "", "the url of your memos instance")

	if err := viper.BindPFlag("mode", rootCmd.PersistentFlags().Lookup("mode")); err != nil {
		panic(err)
	}
	if err := viper.BindPFlag("addr", rootCmd.PersistentFlags().Lookup("addr")); err != nil {
		panic(err)
	}
	if err := viper.BindPFlag("port", rootCmd.PersistentFlags().Lookup("port")); err != nil {
		panic(err)
	}
	if err := viper.BindPFlag("data", rootCmd.PersistentFlags().Lookup("data")); err != nil {
		panic(err)
	}
	if err := viper.BindPFlag("driver", rootCmd.PersistentFlags().Lookup("driver")); err != nil {
		panic(err)
	}
	if err := viper.BindPFlag("dsn", rootCmd.PersistentFlags().Lookup("dsn")); err != nil {
		panic(err)
	}
	if err := viper.BindPFlag("instance-url", rootCmd.PersistentFlags().Lookup("instance-url")); err != nil {
		panic(err)
	}

	viper.SetEnvPrefix("memos")
	viper.AutomaticEnv()
	if err := viper.BindEnv("instance-url", "MEMOS_INSTANCE_URL"); err != nil {
		panic(err)
	}
}

func printGreetings(profile *profile.Profile) {
	fmt.Printf(`---
Server profile
version: %s
data: %s
dsn: %s
addr: %s
port: %d
mode: %s
driver: %s
---
`, profile.Version, profile.Data, profile.DSN, profile.Addr, profile.Port, profile.Mode, profile.Driver)

	print(greetingBanner)
	if len(profile.Addr) == 0 {
		fmt.Printf("Version %s has been started on port %d\n", profile.Version, profile.Port)
	} else {
		fmt.Printf("Version %s has been started on address '%s' and port %d\n", profile.Version, profile.Addr, profile.Port)
	}
	fmt.Printf(`---
See more in:
👉Website: %s
👉GitHub: %s
---
`, "https://usememos.com", "https://github.com/usememos/memos")
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		panic(err)
	}
}

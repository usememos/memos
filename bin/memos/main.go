package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.uber.org/zap"

	"github.com/usememos/memos/internal/jobs"
	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/server"
	_profile "github.com/usememos/memos/server/profile"
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
	profile       *_profile.Profile
	mode          string
	addr          string
	port          int
	data          string
	driver        string
	dsn           string
	serveFrontend bool

	rootCmd = &cobra.Command{
		Use:   "memos",
		Short: `An open-source, self-hosted memo hub with knowledge management and social networking.`,
		Run: func(_cmd *cobra.Command, _args []string) {
			ctx, cancel := context.WithCancel(context.Background())
			dbDriver, err := db.NewDBDriver(profile)
			if err != nil {
				cancel()
				log.Error("failed to create db driver", zap.Error(err))
				return
			}
			if err := dbDriver.Migrate(ctx); err != nil {
				cancel()
				log.Error("failed to migrate db", zap.Error(err))
				return
			}

			storeInstance := store.New(dbDriver, profile)
			if err := storeInstance.MigrateManually(ctx); err != nil {
				cancel()
				log.Error("failed to migrate manually", zap.Error(err))
				return
			}

			s, err := server.NewServer(ctx, profile, storeInstance)
			if err != nil {
				cancel()
				log.Error("failed to create server", zap.Error(err))
				return
			}

			c := make(chan os.Signal, 1)
			// Trigger graceful shutdown on SIGINT or SIGTERM.
			// The default signal sent by the `kill` command is SIGTERM,
			// which is taken as the graceful shutdown signal for many systems, eg., Kubernetes, Gunicorn.
			signal.Notify(c, os.Interrupt, syscall.SIGTERM)
			go func() {
				sig := <-c
				log.Info(fmt.Sprintf("%s received.\n", sig.String()))
				s.Shutdown(ctx)
				cancel()
			}()

			printGreetings()

			// update (pre-sign) object storage links if applicable
			go jobs.RunPreSignLinks(ctx, storeInstance)

			if err := s.Start(ctx); err != nil {
				if err != http.ErrServerClosed {
					log.Error("failed to start server", zap.Error(err))
					cancel()
				}
			}

			// Wait for CTRL-C.
			<-ctx.Done()
		},
	}
)

func Execute() error {
	defer log.Sync()
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVarP(&mode, "mode", "m", "demo", `mode of server, can be "prod" or "dev" or "demo"`)
	rootCmd.PersistentFlags().StringVarP(&addr, "addr", "a", "", "address of server")
	rootCmd.PersistentFlags().IntVarP(&port, "port", "p", 8081, "port of server")
	rootCmd.PersistentFlags().StringVarP(&data, "data", "d", "", "data directory")
	rootCmd.PersistentFlags().StringVarP(&driver, "driver", "", "", "database driver")
	rootCmd.PersistentFlags().StringVarP(&dsn, "dsn", "", "", "database source name(aka. DSN)")
	rootCmd.PersistentFlags().BoolVarP(&serveFrontend, "frontend", "", true, "serve frontend files")

	err := viper.BindPFlag("mode", rootCmd.PersistentFlags().Lookup("mode"))
	if err != nil {
		panic(err)
	}
	err = viper.BindPFlag("addr", rootCmd.PersistentFlags().Lookup("addr"))
	if err != nil {
		panic(err)
	}
	err = viper.BindPFlag("port", rootCmd.PersistentFlags().Lookup("port"))
	if err != nil {
		panic(err)
	}
	err = viper.BindPFlag("data", rootCmd.PersistentFlags().Lookup("data"))
	if err != nil {
		panic(err)
	}
	err = viper.BindPFlag("driver", rootCmd.PersistentFlags().Lookup("driver"))
	if err != nil {
		panic(err)
	}
	err = viper.BindPFlag("dsn", rootCmd.PersistentFlags().Lookup("dsn"))
	if err != nil {
		panic(err)
	}
	err = viper.BindPFlag("frontend", rootCmd.PersistentFlags().Lookup("frontend"))
	if err != nil {
		panic(err)
	}

	viper.SetDefault("mode", "demo")
	viper.SetDefault("driver", "sqlite")
	viper.SetDefault("addr", "")
	viper.SetDefault("port", 8081)
	viper.SetDefault("frontend", true)
	viper.SetEnvPrefix("memos")
}

func initConfig() {
	viper.AutomaticEnv()
	var err error
	profile, err = _profile.GetProfile()
	if err != nil {
		fmt.Printf("failed to get profile, error: %+v\n", err)
		return
	}

	fmt.Printf(`---
Server profile
version: %s
data: %s
dsn: %s
addr: %s
port: %d
mode: %s
driver: %s
frontend: %t
---
`, profile.Version, profile.Data, profile.DSN, profile.Addr, profile.Port, profile.Mode, profile.Driver, profile.Frontend)
}

func printGreetings() {
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
	err := Execute()
	if err != nil {
		panic(err)
	}
}

package cmd

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

	"github.com/usememos/memos/common/log"
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
	profile *_profile.Profile
	mode    string
	addr    string
	port    int
	data    string

	rootCmd = &cobra.Command{
		Use:   "memos",
		Short: `An open-source, self-hosted memo hub with knowledge management and social networking.`,
		Run: func(_cmd *cobra.Command, _args []string) {
			ctx, cancel := context.WithCancel(context.Background())
			db := db.NewDB(profile)
			if err := db.Open(); err != nil {
				cancel()
				log.Error("failed to open db", zap.Error(err))
				return
			}
			if err := db.Migrate(ctx); err != nil {
				cancel()
				log.Error("failed to migrate db", zap.Error(err))
				return
			}

			store := store.New(db.DBInstance, profile)
			s, err := server.NewServer(ctx, profile, store)
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

	viper.SetDefault("mode", "demo")
	viper.SetDefault("addr", "")
	viper.SetDefault("port", 8081)
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

	println("---")
	println("Server profile")
	println("dsn:", profile.DSN)
	println("addr:", profile.Addr)
	println("port:", profile.Port)
	println("mode:", profile.Mode)
	println("version:", profile.Version)
	println("---")
}

func printGreetings() {
	print(greetingBanner)
	if len(profile.Addr) == 0 {
		fmt.Printf("Version %s has been started on port %d\n", profile.Version, profile.Port)
	} else {
		fmt.Printf("Version %s has been started on address '%s' and port %d\n", profile.Version, profile.Addr, profile.Port)
	}
	println("---")
	println("See more in:")
	fmt.Printf("👉Website: %s\n", "https://usememos.com")
	fmt.Printf("👉GitHub: %s\n", "https://github.com/usememos/memos")
	println("---")
}

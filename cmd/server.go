package cmd

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/usememos/memos/server"
	_profile "github.com/usememos/memos/server/profile"

	"fmt"
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
	mode    string
	port    int
	data    string
	feat    string
	profile *_profile.Profile

	rootCmd = &cobra.Command{
		Use:   "memos",
		Short: `An open-source, self-hosted memo hub with knowledge management and social networking.`,
		Run: func(_cmd *cobra.Command, _args []string) {
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
		},
	}
)

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVarP(&mode, "mode", "m", "demo", `mode of server, can be "prod" or "dev" or "demo"`)
	rootCmd.PersistentFlags().IntVarP(&port, "port", "p", 8081, "port of server")
	rootCmd.PersistentFlags().StringVarP(&data, "data", "d", "", "data directory")
	rootCmd.PersistentFlags().StringVarP(&feat, "feat", "f", "", "feature flags, split by comma")

	err := viper.BindPFlag("mode", rootCmd.PersistentFlags().Lookup("mode"))
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
	err = viper.BindPFlag("feature", rootCmd.PersistentFlags().Lookup("feat"))
	if err != nil {
		panic(err)
	}
	viper.SetDefault("mode", "demo")
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
	println("profile")
	println("mode:", profile.Mode)
	println("port:", profile.Port)
	println("dsn:", profile.DSN)
	println("version:", profile.Version)
	println("feature: ", profile.Feature)
	println("---")
}

package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/usememos/memos/server"
	_profile "github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/setup"
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
	port    int
	data    string

	rootCmd = &cobra.Command{
		Use:   "memos",
		Short: `An open-source, self-hosted memo hub with knowledge management and social networking.`,
		Run: func(_cmd *cobra.Command, _args []string) {
			ctx, cancel := context.WithCancel(context.Background())
			db := db.NewDB(profile)
			if err := db.Open(ctx); err != nil {
				cancel()
				fmt.Printf("failed to open db, error: %+v\n", err)
				return
			}

			store := store.New(db.DBInstance, profile)
			s, err := server.NewServer(ctx, profile, store)
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

	setupCmd = &cobra.Command{
		Use:   "setup",
		Short: "Make initial setup for memos",
		Run: func(cmd *cobra.Command, _ []string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			hostUsername, err := cmd.Flags().GetString(setupCmdFlagHostUsername)
			if err != nil {
				fmt.Printf("failed to get owner username, error: %+v\n", err)
				return
			}

			hostPassword, err := cmd.Flags().GetString(setupCmdFlagHostPassword)
			if err != nil {
				fmt.Printf("failed to get owner password, error: %+v\n", err)
				return
			}

			db := db.NewDB(profile)
			if err := db.Open(ctx); err != nil {
				fmt.Printf("failed to open db, error: %+v\n", err)
				return
			}

			store := store.New(db.DBInstance, profile)
			if err := setup.Execute(ctx, store, hostUsername, hostPassword); err != nil {
				fmt.Printf("failed to setup, error: %+v\n", err)
				return
			}
		},
	}

	mvrssCmd = &cobra.Command{
		Use:   "mvrss", // `mvrss` is a shortened for 'means move resource'
		Short: "Move resource between storage",
		Run: func(cmd *cobra.Command, _ []string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			from, err := cmd.Flags().GetString(mvrssCmdFlagFrom)
			if err != nil {
				fmt.Printf("failed to get from storage, error: %+v\n", err)
				return
			}

			to, err := cmd.Flags().GetString(mvrssCmdFlagTo)
			if err != nil {
				fmt.Printf("failed to get to storage, error: %+v\n", err)
				return
			}

			if from != "local" || to != "db" {
				fmt.Printf("only local=>db be supported currently\n")
				return
			}

			db := db.NewDB(profile)
			if err := db.Open(ctx); err != nil {
				fmt.Printf("failed to open db, error: %+v\n", err)
				return
			}

			s := store.New(db.DBInstance, profile)
			resources, err := s.ListResources(ctx, &store.FindResource{})
			if err != nil {
				fmt.Printf("failed to list resources, error: %+v\n", err)
				return
			}

			var emptyString string
			for _, res := range resources {
				if res.InternalPath == "" {
					continue
				}

				buf, err := os.ReadFile(res.InternalPath)
				if err != nil {
					fmt.Printf("Resource %5d failed to read file: %s\n", res.ID, err)
					continue
				}

				if len(buf) != int(res.Size) {
					fmt.Printf("Resource %5d size of file %d != %d\n", res.ID, len(buf), res.Size)
					continue
				}

				update := store.UpdateResource{
					ID:           res.ID,
					Blob:         buf,
					InternalPath: &emptyString,
				}
				_, err = s.UpdateResource(ctx, &update)
				if err != nil {
					fmt.Printf("Resource %5d failed to update: %s\n", res.ID, err)
					continue
				}

				fmt.Printf("Resource %5d copy %12d bytes from %s\n", res.ID, len(buf), res.InternalPath)
			}
			fmt.Println("done")
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

	viper.SetDefault("mode", "demo")
	viper.SetDefault("port", 8081)
	viper.SetEnvPrefix("memos")

	setupCmd.Flags().String(setupCmdFlagHostUsername, "", "Owner username")
	setupCmd.Flags().String(setupCmdFlagHostPassword, "", "Owner password")

	rootCmd.AddCommand(setupCmd)

	mvrssCmd.Flags().String(mvrssCmdFlagFrom, "local", "From storage")
	mvrssCmd.Flags().String(mvrssCmdFlagTo, "db", "To Storage")

	rootCmd.AddCommand(mvrssCmd)
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
	println("port:", profile.Port)
	println("mode:", profile.Mode)
	println("version:", profile.Version)
	println("---")
}

const (
	setupCmdFlagHostUsername = "host-username"
	setupCmdFlagHostPassword = "host-password"
	mvrssCmdFlagFrom         = "from"
	mvrssCmdFlagTo           = "to"
)

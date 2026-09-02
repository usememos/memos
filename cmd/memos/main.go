package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	"github.com/usememos/memos/internal/webhook"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

func initSlogDefault() {
	level, err := parseSlogLevel(viper.GetString("log-level"))
	if err != nil {
		slog.Warn("invalid log-level value, defaulting to info", "error", err)
	}
	slog.SetDefault(newLogger(level, os.Stderr))
}

var (
	rootCmd = &cobra.Command{
		Use:           "memos",
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runServer()
		},
	}
	versionCmd = &cobra.Command{
		Use:   "version",
		Short: "Print the current Memos version",
		Run: func(_ *cobra.Command, _ []string) {
			fmt.Println(version.GetCurrentVersion())
		},
	}
)

func init() {
	cobra.OnInitialize(initSlogDefault)

	viper.SetDefault("demo", false)
	viper.SetDefault("driver", "sqlite")
	viper.SetDefault("port", 8081)

	rootCmd.Flags().Bool("demo", false, "enable demo mode")
	rootCmd.Flags().String("addr", "", "address of server")
	rootCmd.Flags().Int("port", 8081, "port of server")
	rootCmd.Flags().String("unix-sock", "", "path to the unix socket, overrides --addr and --port")
	rootCmd.Flags().String("data", "", "data directory")
	rootCmd.Flags().String("driver", "sqlite", "database driver")
	rootCmd.Flags().String("dsn", "", "database source name (DSN)")
	rootCmd.Flags().String("instance-url", "", "canonical external URL of the Memos instance")
	rootCmd.Flags().Bool("allow-private-webhooks", false, "allow webhooks to access any private/reserved IP address")
	rootCmd.Flags().StringSlice("webhook-private-network-allowlist", nil, "private webhook destinations to allow (exact hostname, IP, or CIDR)")
	rootCmd.Flags().String("log-level", "info", "log verbosity level (debug, info, warn, error)")

	if err := rootCmd.Flags().MarkDeprecated("allow-private-webhooks", "use --webhook-private-network-allowlist to allow only required destinations"); err != nil {
		panic(err)
	}
	for _, key := range []string{
		"demo",
		"addr",
		"port",
		"unix-sock",
		"data",
		"driver",
		"dsn",
		"instance-url",
		"allow-private-webhooks",
		"webhook-private-network-allowlist",
		"log-level",
	} {
		if err := viper.BindPFlag(key, rootCmd.Flags().Lookup(key)); err != nil {
			panic(err)
		}
	}

	viper.SetEnvPrefix("memos")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	rootCmd.AddCommand(versionCmd)
}

func runServer() error {
	instanceProfile := &profile.Profile{
		Demo:        viper.GetBool("demo"),
		Addr:        viper.GetString("addr"),
		Port:        viper.GetInt("port"),
		UNIXSock:    viper.GetString("unix-sock"),
		Data:        viper.GetString("data"),
		Driver:      viper.GetString("driver"),
		DSN:         viper.GetString("dsn"),
		InstanceURL: viper.GetString("instance-url"),
		Version:     version.GetCurrentVersion(),
		Commit:      version.Commit,
	}

	allowPrivateWebhooks := viper.GetBool("allow-private-webhooks")
	//nolint:staticcheck // The deprecated CLI/env input remains supported for upgrade compatibility.
	webhook.AllowPrivateIPs = allowPrivateWebhooks
	if allowPrivateWebhooks {
		slog.Warn("--allow-private-webhooks is deprecated and disables webhook private-network protection; use --webhook-private-network-allowlist")
	}
	if err := webhook.ConfigurePrivateDestinationAllowlist(privateWebhookAllowlist()); err != nil {
		return errors.Wrap(err, "failed to configure private webhook destinations")
	}
	if err := instanceProfile.Validate(); err != nil {
		return errors.Wrap(err, "failed to validate profile")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	dbDriver, err := db.NewDBDriver(instanceProfile)
	if err != nil {
		return errors.Wrap(err, "failed to create database driver")
	}
	storeInstance := store.New(dbDriver, instanceProfile)
	closeStore := true
	defer func() {
		if closeStore {
			if err := storeInstance.Close(); err != nil {
				slog.Error("failed to close store", "error", err)
			}
		}
	}()

	if err := storeInstance.Migrate(ctx); err != nil {
		return errors.Wrap(err, "failed to migrate database")
	}
	if err := storeInstance.LoadDeploymentConfiguration(ctx); err != nil {
		return errors.Wrap(err, "failed to load deployment configuration")
	}
	accessSetting, err := storeInstance.GetInstanceAccessSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance access setting")
	}

	s, err := server.NewServer(ctx, instanceProfile, storeInstance)
	if err != nil {
		return errors.Wrap(err, "failed to create server")
	}
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(signals)

	if err := s.Start(); err != nil {
		return errors.Wrap(err, "failed to start server")
	}
	closeStore = false

	printServerInfo(instanceProfile, accessSetting.AccessMode)
	<-signals
	s.Shutdown(context.Background())
	return nil
}

func privateWebhookAllowlist() []string {
	var entries []string
	for _, value := range viper.GetStringSlice("webhook-private-network-allowlist") {
		for entry := range strings.SplitSeq(value, ",") {
			if entry = strings.TrimSpace(entry); entry != "" {
				entries = append(entries, entry)
			}
		}
	}
	return entries
}

func printServerInfo(profile *profile.Profile, accessMode storepb.InstanceAccessMode) {
	fmt.Printf("Memos %s started successfully!\n", profile.Version)

	if profile.Demo {
		fmt.Fprint(os.Stderr, "Demo mode is enabled\n")
	}

	// Server information
	fmt.Printf("Data directory: %s\n", profile.Data)
	fmt.Printf("Database driver: %s\n", profile.Driver)

	// Connection information
	if len(profile.UNIXSock) == 0 {
		if len(profile.Addr) == 0 {
			fmt.Printf("Server running on port %d\n", profile.Port)
			fmt.Printf("Access your memos at: http://localhost:%d\n", profile.Port)
		} else {
			fmt.Printf("Server running on %s:%d\n", profile.Addr, profile.Port)
			fmt.Printf("Access your memos at: http://%s:%d\n", profile.Addr, profile.Port)
		}
	} else {
		fmt.Printf("Server running on unix socket: %s\n", profile.UNIXSock)
	}

	accessModeLabel := "private"
	if accessMode == storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC {
		accessModeLabel = "public"
	}
	fmt.Printf("Access mode: %s\n", accessModeLabel)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		slog.Error("memos failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

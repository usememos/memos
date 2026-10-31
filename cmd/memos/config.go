package main

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"os"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/core/configuration"
	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

// The plan exit statuses of --detailed-exitcode, matching terraform plan.
const (
	planExitChanges = 2
)

var (
	configCmd = &cobra.Command{
		Use:   "config",
		Short: "Work with declarative configuration files",
	}
	configValidateCmd = &cobra.Command{
		Use:   "validate",
		Short: "Check the configuration files without a database",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runConfigValidate(flagOrSetting(cmd, "config-dir"), configuration.OSResolver(), cmd.OutOrStdout(), cmd.ErrOrStderr())
		},
	}
	configPlanCmd = &cobra.Command{
		Use:   "plan",
		Short: "Show what applying the configuration files would change, without writing",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			storeInstance, err := openConfigurationStore(cmd.Context(), cmd, false)
			if err != nil {
				return err
			}
			defer storeInstance.Close()
			options := planOptions{}
			options.json, _ = cmd.Flags().GetBool("json")
			options.detailedExitCode, _ = cmd.Flags().GetBool("detailed-exitcode")
			return runConfigPlan(cmd.Context(), flagOrSetting(cmd, "config-dir"), configuration.OSResolver(), storeInstance, options, cmd.OutOrStdout(), cmd.ErrOrStderr())
		},
	}
	configApplyCmd = &cobra.Command{
		Use:   "apply",
		Short: "Apply the configuration files to the instance in one transaction",
		Long: "Apply migrates the database as server startup does, plans the configuration files against it, and writes " +
			"the plan and the state record in one transaction: it either completes or changes nothing.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			storeInstance, err := openConfigurationStore(cmd.Context(), cmd, true)
			if err != nil {
				return err
			}
			defer storeInstance.Close()
			jsonOutput, _ := cmd.Flags().GetBool("json")
			return runConfigApply(cmd.Context(), flagOrSetting(cmd, "config-dir"), configuration.OSResolver(), storeInstance, configMetadata("cli"), jsonOutput, cmd.OutOrStdout(), cmd.ErrOrStderr())
		},
	}
	configStateCmd = &cobra.Command{
		Use:   "state",
		Short: "Show the state record: the managed resources and the last apply",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			storeInstance, err := openConfigurationStore(cmd.Context(), cmd, false)
			if err != nil {
				return err
			}
			defer storeInstance.Close()
			jsonOutput, _ := cmd.Flags().GetBool("json")
			return runConfigState(cmd.Context(), storeInstance, jsonOutput, cmd.OutOrStdout())
		},
	}
)

func init() {
	// The server's own flags are local to the root command, so these are
	// declared again and read through flagOrSetting rather than bound to the
	// same viper keys, which would unbind the server's flags.
	flags := configCmd.PersistentFlags()
	flags.String("config-dir", configuration.DefaultDir, "directory of declarative configuration files")
	flags.String("data", "", "data directory of the instance")
	flags.String("driver", "sqlite", "database driver of the instance (sqlite, mysql, postgres)")
	flags.String("dsn", "", "database source name of the instance")

	configPlanCmd.Flags().Bool("json", false, "print the plan as JSON")
	configPlanCmd.Flags().Bool("detailed-exitcode", false, "exit 0 for no changes, 1 for an error, 2 for changes")
	configApplyCmd.Flags().Bool("json", false, "print the applied plan as JSON")
	configStateCmd.Flags().Bool("json", false, "print the state record as JSON")

	configCmd.AddCommand(configValidateCmd, configPlanCmd, configApplyCmd, configStateCmd)
	rootCmd.AddCommand(configCmd)
}

// flagOrSetting returns a config command's flag when it was given, and
// otherwise the setting viper resolves from the environment and defaults.
func flagOrSetting(cmd *cobra.Command, name string) string {
	if flag := cmd.Flags().Lookup(name); flag != nil && flag.Changed {
		return flag.Value.String()
	}
	if value := viper.GetString(name); value != "" {
		return value
	}
	if flag := cmd.Flags().Lookup(name); flag != nil {
		return flag.DefValue
	}
	return ""
}

// configMetadata identifies an apply in the state record by path and host.
func configMetadata(path string) configuration.ApplyMetadata {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}
	return configuration.ApplyMetadata{AppliedBy: path + " " + hostname, Version: version.GetCurrentVersion(), Now: time.Now()}
}

// loadConfiguration loads dir, printing every problem on its own line so a
// long list stays readable, and returns a one-line error for the exit status.
func loadConfiguration(dir string, resolver configuration.Resolver, stderr io.Writer) (*configuration.Desired, error) {
	desired, err := configuration.Load(dir, resolver)
	var validationError *configuration.ValidationError
	if errors.As(err, &validationError) {
		for _, problem := range validationError.Problems {
			fmt.Fprintln(stderr, "error:", problem)
		}
		noun := "problems"
		if len(validationError.Problems) == 1 {
			noun = "problem"
		}
		return nil, errors.Errorf("configuration in %s is invalid: %d %s", dir, len(validationError.Problems), noun)
	}
	if err != nil {
		return nil, err
	}
	for _, warning := range desired.Warnings {
		fmt.Fprintln(stderr, "warning:", warning)
	}
	return desired, nil
}

func runConfigValidate(dir string, resolver configuration.Resolver, stdout, stderr io.Writer) error {
	// A missing directory is a valid, empty configuration at startup, but here
	// it is more likely a mistyped --config-dir, so say so.
	if _, err := os.Stat(dir); errors.Is(err, fs.ErrNotExist) {
		fmt.Fprintf(stdout, "Configuration directory %s does not exist; there is nothing to validate.\n", dir)
		return nil
	}
	desired, err := loadConfiguration(dir, resolver, stderr)
	if err != nil {
		return err
	}
	config := desired.Configuration
	fmt.Fprintf(stdout, "Configuration in %s is valid: %d identity providers, %d instance settings, %d users, %d linked identities.\n",
		dir, len(config.IdentityProviders), len(config.InstanceSettings), len(config.Users), len(config.LinkedIdentities))
	return nil
}

type planOptions struct {
	json             bool
	detailedExitCode bool
}

func runConfigPlan(ctx context.Context, dir string, resolver configuration.Resolver, reader configuration.Reader, options planOptions, stdout, stderr io.Writer) error {
	if _, err := os.Stat(dir); errors.Is(err, fs.ErrNotExist) {
		// An empty configuration is still worth planning: it shows every
		// managed resource that now lacks a declaration.
		fmt.Fprintf(stderr, "warning: configuration directory %s does not exist; planning an empty configuration\n", dir)
	}
	desired, err := loadConfiguration(dir, resolver, stderr)
	if err != nil {
		return err
	}
	plan, err := configuration.ComputePlan(ctx, desired, reader)
	if err != nil {
		return err
	}
	if err := printPlan(stdout, plan.Message, options.json); err != nil {
		return err
	}
	if !plan.Valid() {
		return errors.New("the plan cannot be applied")
	}
	if options.detailedExitCode && plan.HasChanges() {
		return exitCodeError{code: planExitChanges}
	}
	return nil
}

// openConfigurationStore opens the instance database. To read, as plan and
// state do, it never creates or migrates a database. To write, as apply does,
// it migrates exactly as server startup would, creating a fresh one.
func openConfigurationStore(ctx context.Context, cmd *cobra.Command, write bool) (*store.Store, error) {
	instanceProfile := &profile.Profile{
		Data:    flagOrSetting(cmd, "data"),
		Driver:  flagOrSetting(cmd, "driver"),
		DSN:     flagOrSetting(cmd, "dsn"),
		Version: version.GetCurrentVersion(),
		Commit:  version.Commit,
	}
	if instanceProfile.Data != "" {
		if _, err := os.Stat(instanceProfile.Data); err != nil {
			return nil, errors.Wrap(err, "failed to open the data directory")
		}
	}
	if err := instanceProfile.Validate(); err != nil {
		return nil, errors.Wrap(err, "failed to validate profile")
	}
	if instanceProfile.Driver == "sqlite" && !write {
		if _, err := os.Stat(instanceProfile.DSN); errors.Is(err, fs.ErrNotExist) {
			return nil, errors.Errorf("no SQLite database at %s; pass the instance's --data or --dsn", instanceProfile.DSN)
		}
	}
	dbDriver, err := db.NewDBDriver(instanceProfile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create database driver")
	}
	storeInstance := store.New(dbDriver, instanceProfile)
	check := storeInstance.CheckSchemaCurrent
	if write {
		check = storeInstance.Migrate
	}
	if err := check(ctx); err != nil {
		storeInstance.Close()
		return nil, err
	}
	return storeInstance, nil
}

func runConfigApply(ctx context.Context, dir string, resolver configuration.Resolver, s *store.Store, metadata configuration.ApplyMetadata, jsonOutput bool, stdout, stderr io.Writer) error {
	if _, err := os.Stat(dir); errors.Is(err, fs.ErrNotExist) {
		fmt.Fprintf(stderr, "warning: configuration directory %s does not exist; applying an empty configuration\n", dir)
	}
	desired, err := loadConfiguration(dir, resolver, stderr)
	if err != nil {
		return err
	}
	plan, state, err := configuration.Apply(ctx, desired, s, metadata)
	if err != nil {
		return err
	}
	if err := printPlan(stdout, plan.Message, jsonOutput); err != nil {
		return err
	}
	if !plan.Valid() {
		return errors.New("the plan cannot be applied; nothing was written")
	}
	if !jsonOutput && plan.HasChanges() {
		fmt.Fprintf(stdout, "\nApply complete. The state record is at serial %d.\n", state.Serial)
	}
	return nil
}

// printPlan writes a plan as text, or as the Plan message in JSON.
func printPlan(stdout io.Writer, plan *apipb.Plan, jsonOutput bool) error {
	if !jsonOutput {
		configuration.RenderPlan(stdout, plan)
		return nil
	}
	encoded, err := protojson.MarshalOptions{Multiline: true, Indent: "  "}.Marshal(plan)
	if err != nil {
		return errors.Wrap(err, "failed to encode the plan")
	}
	fmt.Fprintln(stdout, string(encoded))
	return nil
}

func runConfigState(ctx context.Context, s *store.Store, jsonOutput bool, stdout io.Writer) error {
	state, err := s.GetConfigurationState(ctx)
	if err != nil {
		return err
	}
	if jsonOutput {
		encoded, err := protojson.MarshalOptions{Multiline: true, Indent: "  "}.Marshal(state)
		if err != nil {
			return errors.Wrap(err, "failed to encode the state record")
		}
		fmt.Fprintln(stdout, string(encoded))
		return nil
	}
	if proto.Equal(state, &storepb.InstanceConfigurationState{}) {
		fmt.Fprintln(stdout, "No configuration has been applied; nothing is managed.")
		return nil
	}
	fmt.Fprintf(stdout, "Serial %d, applied %s by %s (Memos %s).\n", state.Serial,
		time.Unix(state.AppliedTs, 0).UTC().Format(time.RFC3339), state.AppliedBy, state.Version)
	width := 0
	for _, resource := range state.Resources {
		width = max(width, len(resource.Name))
	}
	for _, resource := range state.Resources {
		line := fmt.Sprintf("  %-*s  %-16s  %s  managed: %s", width, resource.Name, resource.Kind, resource.Source, strings.Join(resource.ManagedFields, ", "))
		if len(resource.IgnoredFields) > 0 {
			line += "; ignored: " + strings.Join(resource.IgnoredFields, ", ")
		}
		if resource.PreventDestroy {
			line += "; prevent destroy"
		}
		fmt.Fprintln(stdout, line)
	}
	return nil
}

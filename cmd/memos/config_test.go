package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/core/configuration"
	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

func TestConfigValidate(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "users.json"),
		[]byte(`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}]}`), 0o600))

	var stdout, stderr bytes.Buffer
	require.NoError(t, runConfigValidate(dir, configuration.OSResolver(), &stdout, &stderr))
	require.Contains(t, stdout.String(), "is valid: 0 identity providers, 0 instance settings, 1 users")
	require.Empty(t, stderr.String())

	require.NoError(t, os.WriteFile(filepath.Join(dir, "bad.json"), []byte(`{"users":[{"name":"users/root"}]}`), 0o600))
	stdout.Reset()
	err := runConfigValidate(dir, configuration.OSResolver(), &stdout, &stderr)
	require.ErrorContains(t, err, "is invalid: 2 problems")
	require.Contains(t, stderr.String(), "error: bad.json: users[0].username must equal")
	require.Contains(t, stderr.String(), "error: bad.json: users[0].role is required")
	require.Empty(t, stdout.String())

	stdout.Reset()
	require.NoError(t, runConfigValidate(filepath.Join(dir, "missing"), configuration.OSResolver(), &stdout, &stderr))
	require.Contains(t, stdout.String(), "does not exist")
}

func TestConfigCommandsDoNotInheritServerFlags(t *testing.T) {
	for _, cmd := range []*cobra.Command{configValidateCmd, configPlanCmd} {
		require.Nil(t, cmd.InheritedFlags().Lookup("port"), cmd.Name())
		require.Nil(t, cmd.InheritedFlags().Lookup("instance-url"), cmd.Name())
		require.NotNil(t, cmd.InheritedFlags().Lookup("config-dir"), cmd.Name())
		// The database flags are the config command's own, so binding them
		// does not unbind the server's.
		require.Equal(t, "database source name of the instance", cmd.InheritedFlags().Lookup("dsn").Usage, cmd.Name())
	}
}

func newMigratedStore(t *testing.T) (*store.Store, string) {
	t.Helper()
	data := t.TempDir()
	instanceProfile := &profile.Profile{Data: data, Driver: "sqlite", Version: version.GetCurrentVersion()}
	require.NoError(t, instanceProfile.Validate())
	dbDriver, err := db.NewDBDriver(instanceProfile)
	require.NoError(t, err)
	storeInstance := store.New(dbDriver, instanceProfile)
	t.Cleanup(func() { require.NoError(t, storeInstance.Close()) })
	require.NoError(t, storeInstance.Migrate(context.Background()))
	return storeInstance, data
}

func TestConfigPlan(t *testing.T) {
	ctx := context.Background()
	storeInstance, _ := newMigratedStore(t)
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "users.json"),
		[]byte(`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"${env:MEMOS_TEST_ADMIN_PASSWORD}"}]}`), 0o600))
	t.Setenv("MEMOS_TEST_ADMIN_PASSWORD", "correct horse")

	var stdout, stderr bytes.Buffer
	err := runConfigPlan(ctx, dir, configuration.OSResolver(), storeInstance, planOptions{detailedExitCode: true}, &stdout, &stderr)
	var exit exitCodeError
	require.ErrorAs(t, err, &exit)
	require.Equal(t, planExitChanges, exit.code)
	require.Contains(t, stdout.String(), "Plan: 1 to create, 0 to update, 0 to destroy.")
	require.Contains(t, stdout.String(), "+ users/admin  (users.json)")
	require.NotContains(t, stdout.String(), "correct horse")

	stdout.Reset()
	require.NoError(t, runConfigPlan(ctx, dir, configuration.OSResolver(), storeInstance, planOptions{json: true}, &stdout, &stderr),
		"changes exit 0 without --detailed-exitcode")
	plan := &apipb.Plan{}
	require.NoError(t, protojson.Unmarshal(stdout.Bytes(), plan))
	require.Equal(t, apipb.ResourceChange_CREATE, plan.ResourceChanges[0].Action)
	require.True(t, plan.StateRecordChanges)
	require.NotContains(t, stdout.String(), "correct horse")

	stdout.Reset()
	stderr.Reset()
	require.NoError(t, runConfigPlan(ctx, filepath.Join(dir, "missing"), configuration.OSResolver(), storeInstance, planOptions{detailedExitCode: true}, &stdout, &stderr))
	require.Contains(t, stderr.String(), "planning an empty configuration")
	require.Equal(t, "No changes. The instance matches the configuration.\n", stdout.String())

	require.NoError(t, os.WriteFile(filepath.Join(dir, "users.json"), []byte(`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}]}`), 0o600))
	stdout.Reset()
	err = runConfigPlan(ctx, dir, configuration.OSResolver(), storeInstance, planOptions{detailedExitCode: true}, &stdout, &stderr)
	require.ErrorContains(t, err, "the plan cannot be applied")
	require.Contains(t, stdout.String(), "Error: users/admin: password is required to create the user")
}

func TestConfigPlanRefusesMissingDatabase(t *testing.T) {
	var stdout, stderr bytes.Buffer
	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"config", "plan", "--data", t.TempDir(), "--config-dir", t.TempDir()})
	t.Cleanup(func() { rootCmd.SetArgs(nil) })
	err := rootCmd.ExecuteContext(context.Background())
	require.ErrorContains(t, err, "no SQLite database at")
}

func TestConfigApplyAndState(t *testing.T) {
	ctx := context.Background()
	storeInstance, _ := newMigratedStore(t)
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "users.json"),
		[]byte(`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"pw"}],"lifecycle":[{"resource":"users/admin","preventDestroy":true}]}`), 0o600))
	metadata := configuration.ApplyMetadata{AppliedBy: "cli test-host", Version: "test", Now: time.Unix(1_800_000_000, 0)}

	var stdout, stderr bytes.Buffer
	require.NoError(t, runConfigApply(ctx, dir, configuration.OSResolver(), storeInstance, metadata, false, &stdout, &stderr))
	require.Contains(t, stdout.String(), "+ users/admin  (users.json)")
	require.Contains(t, stdout.String(), "Apply complete. The state record is at serial 1.")

	stdout.Reset()
	require.NoError(t, runConfigApply(ctx, dir, configuration.OSResolver(), storeInstance, metadata, false, &stdout, &stderr))
	require.Equal(t, "No changes. The instance matches the configuration.\n", stdout.String())

	stdout.Reset()
	require.NoError(t, runConfigState(ctx, storeInstance, false, &stdout))
	require.Equal(t, "Serial 1, applied 2027-01-15T08:00:00Z by cli test-host (Memos test).\n"+
		"  users/admin  User              users.json  managed: username, role; prevent destroy\n", stdout.String())

	stdout.Reset()
	require.NoError(t, runConfigState(ctx, storeInstance, true, &stdout))
	state := &storepb.InstanceConfigurationState{}
	require.NoError(t, protojson.Unmarshal(stdout.Bytes(), state))
	require.Equal(t, int64(1), state.Serial)
}

func TestConfigApplyCreatesTheDatabase(t *testing.T) {
	data, dir := t.TempDir(), t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "users.json"),
		[]byte(`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"pw"}]}`), 0o600))
	var stdout, stderr bytes.Buffer
	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"config", "apply", "--data", data, "--config-dir", dir})
	t.Cleanup(func() { rootCmd.SetArgs(nil) })
	require.NoError(t, rootCmd.ExecuteContext(context.Background()), stderr.String())
	require.Contains(t, stdout.String(), "Apply complete.", "apply bootstraps a fresh instance")
	require.FileExists(t, filepath.Join(data, "memos_prod.db"))
}

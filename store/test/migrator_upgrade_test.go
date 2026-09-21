package test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

// prepareUpgradeFixture returns the container config needed to bootstrap a real
// schema for the given Memos version, plus the DSN the host uses to reach it.
func prepareUpgradeFixture(t *testing.T, driver, version string) (MemosContainerConfig, string) {
	t.Helper()

	switch driver {
	case "sqlite":
		dataDir := t.TempDir()
		return MemosContainerConfig{
			Version: version,
			Driver:  driver,
			DataDir: dataDir,
		}, fmt.Sprintf("%s/memos_prod.db", dataDir)
	case "mysql":
		hostDSN := GetMySQLDSN(t)
		containerDSN, err := getContainerDSN(driver, hostDSN)
		require.NoError(t, err)
		return MemosContainerConfig{
			Version: version,
			Driver:  driver,
			DSN:     containerDSN,
		}, hostDSN
	case "postgres":
		hostDSN := GetPostgresDSN(t)
		containerDSN, err := getContainerDSN(driver, hostDSN)
		require.NoError(t, err)
		return MemosContainerConfig{
			Version: version,
			Driver:  driver,
			DSN:     containerDSN,
		}, hostDSN
	case "d1":
		t.Skip("previous stable releases cannot run on D1; there is no schema to upgrade from")
		return MemosContainerConfig{}, ""
	default:
		t.Fatalf("unsupported driver: %s", driver)
		return MemosContainerConfig{}, ""
	}
}

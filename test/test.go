package test

import (
	"fmt"
	"testing"

	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
)

func GetTestingProfile(t *testing.T) *profile.Profile {
	// Get a temporary directory for the test data.
	dir := t.TempDir()
	mode := "prod"
	return &profile.Profile{
		Mode:    mode,
		Port:    8082,
		Data:    dir,
		DSN:     fmt.Sprintf("%s/memos_%s.db", dir, mode),
		Version: version.GetCurrentVersion(mode),
	}
}

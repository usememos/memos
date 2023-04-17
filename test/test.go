package test

import (
	"fmt"
	"net"
	"testing"

	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
)

func getUnusedPort() int {
	// Get a random unused port
	listener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		panic(err)
	}
	defer listener.Close()

	// Get the port number
	port := listener.Addr().(*net.TCPAddr).Port
	return port
}

func GetTestingProfile(t *testing.T) *profile.Profile {
	// Get a temporary directory for the test data.
	dir := t.TempDir()
	mode := "prod"
	port := getUnusedPort()
	return &profile.Profile{
		Mode:    mode,
		Port:    port,
		Data:    dir,
		DSN:     fmt.Sprintf("%s/memos_%s.db", dir, mode),
		Version: version.GetCurrentVersion(mode),
	}
}

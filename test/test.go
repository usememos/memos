package test

import (
	"fmt"
	"net"
	"os"
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
	mode := "dev"
	port := getUnusedPort()
	driver := getDriverFromEnv()
	dsn := os.Getenv("DSN")
	if driver == "sqlite" {
		dsn = fmt.Sprintf("%s/memos_%s.db", dir, mode)
	}
	println("dsn", dsn, driver)
	return &profile.Profile{
		Mode:    mode,
		Port:    port,
		Data:    dir,
		DSN:     dsn,
		Driver:  driver,
		Version: version.GetCurrentVersion(mode),
	}
}

func getDriverFromEnv() string {
	driver := os.Getenv("DRIVER")
	if driver == "" {
		driver = "sqlite"
	}
	return driver
}

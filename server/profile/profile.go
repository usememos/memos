package profile

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/usememos/memos/common"
)

// Profile is the configuration to start main server.
type Profile struct {
	// Mode can be "prod" or "dev"
	Mode string `json:"mode"`
	// Port is the binding port for server
	Port int `json:"port"`
	// DSN points to where Memos stores its own data
	DSN string `json:"dsn"`
	// Version is the current version of server
	Version string `json:"version"`
}

func checkDSN(dataDir string) (string, error) {
	// Convert to absolute path if relative path is supplied.
	if !filepath.IsAbs(dataDir) {
		absDir, err := filepath.Abs(filepath.Dir(os.Args[0]) + "/" + dataDir)
		if err != nil {
			return "", err
		}
		dataDir = absDir
	}

	// Trim trailing / in case user supplies
	dataDir = strings.TrimRight(dataDir, "/")

	if _, err := os.Stat(dataDir); err != nil {
		error := fmt.Errorf("unable to access -data %s, err %w", dataDir, err)
		return "", error
	}

	return dataDir, nil
}

// GetDevProfile will return a profile for dev.
func GetProfile() *Profile {
	mode := os.Getenv("mode")
	if mode != "dev" && mode != "prod" {
		mode = "dev"
	}

	port, err := strconv.Atoi(os.Getenv("port"))
	if err != nil {
		port = 8080
	}

	data := ""
	if mode == "prod" {
		data = "/var/opt/memos"
	}

	dataDir, err := checkDSN(data)
	if err != nil {
		fmt.Printf("Failed to check dsn: %s, err: %+v\n", dataDir, err)
		os.Exit(1)
	}

	dsn := fmt.Sprintf("%s/memos_%s.db", dataDir, mode)

	return &Profile{
		Mode:    mode,
		Port:    port,
		DSN:     dsn,
		Version: common.GetCurrentVersion(mode),
	}
}

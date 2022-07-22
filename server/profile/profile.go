package profile

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/usememos/memos/common"
)

// Profile is the configuration to start main server.
type Profile struct {
	// Mode can be "prod" or "dev"
	Mode string `json:"mode"`
	// Port is the binding port for server
	Port int `json:"port"`
	// Data is the data directory
	Data string `json:"data"`
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
		return "", fmt.Errorf("unable to access data folder %s, err %w", dataDir, err)
	}

	return dataDir, nil
}

// GetDevProfile will return a profile for dev or prod.
func GetProfile() *Profile {
	profile := Profile{}
	flag.StringVar(&profile.Mode, "mode", "dev", "mode of server")
	flag.IntVar(&profile.Port, "port", 8080, "port of server")
	flag.StringVar(&profile.Data, "data", "", "data directory")
	flag.Parse()

	if profile.Mode != "dev" && profile.Mode != "prod" {
		profile.Mode = "dev"
	}

	if profile.Mode == "prod" && profile.Data == "" {
		profile.Data = "/var/opt/memos"
	}

	dataDir, err := checkDSN(profile.Data)
	if err != nil {
		fmt.Printf("Failed to check dsn: %s, err: %+v\n", dataDir, err)
		os.Exit(1)
	}

	profile.Data = dataDir
	profile.DSN = fmt.Sprintf("%s/memos_%s.db", dataDir, profile.Mode)
	profile.Version = common.GetCurrentVersion(profile.Mode)

	return &profile
}

package profile

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/pkg/errors"
	"github.com/spf13/viper"

	"github.com/usememos/memos/server/version"
)

// Profile is the configuration to start main server.
type Profile struct {
	// Mode can be "prod" or "dev" or "demo"
	Mode string `json:"mode"`
	// Addr is the binding address for server
	Addr string `json:"-"`
	// Port is the binding port for server
	Port int `json:"-"`
	// Data is the data directory
	Data string `json:"-"`
	// DSN points to where memos stores its own data
	DSN string `json:"-"`
	// Driver is the database driver
	// sqlite, mysql
	Driver string `json:"-"`
	// Version is the current version of server
	Version string `json:"version"`
	// Pubic is the flag whether the instance is public for others.
	Public bool `json:"public"`
}

func (p *Profile) IsDev() bool {
	return p.Mode != "prod"
}

func checkDataDir(dataDir string) (string, error) {
	// Convert to absolute path if relative path is supplied.
	if !filepath.IsAbs(dataDir) {
		relativeDir := filepath.Join(filepath.Dir(os.Args[0]), dataDir)
		absDir, err := filepath.Abs(relativeDir)
		if err != nil {
			return "", err
		}
		dataDir = absDir
	}

	// Trim trailing \ or / in case user supplies
	dataDir = strings.TrimRight(dataDir, "\\/")
	if _, err := os.Stat(dataDir); err != nil {
		return "", errors.Wrapf(err, "unable to access data folder %s", dataDir)
	}
	return dataDir, nil
}

// GetProfile will return a profile for dev or prod.
func GetProfile() (*Profile, error) {
	profile := Profile{}
	err := viper.Unmarshal(&profile)
	if err != nil {
		return nil, err
	}

	if profile.Mode != "demo" && profile.Mode != "dev" && profile.Mode != "prod" {
		profile.Mode = "demo"
	}

	if profile.Mode == "prod" && profile.Data == "" {
		if runtime.GOOS == "windows" {
			profile.Data = filepath.Join(os.Getenv("ProgramData"), "memos")

			if _, err := os.Stat(profile.Data); os.IsNotExist(err) {
				if err := os.MkdirAll(profile.Data, 0770); err != nil {
					fmt.Printf("Failed to create data directory: %s, err: %+v\n", profile.Data, err)
					return nil, err
				}
			}
		} else {
			profile.Data = "/var/opt/memos"
		}
	}

	dataDir, err := checkDataDir(profile.Data)
	if err != nil {
		fmt.Printf("Failed to check dsn: %s, err: %+v\n", dataDir, err)
		return nil, err
	}

	profile.Data = dataDir
	if profile.Driver == "sqlite" && profile.DSN == "" {
		dbFile := fmt.Sprintf("memos_%s.db", profile.Mode)
		profile.DSN = filepath.Join(dataDir, dbFile)
	}
	profile.Version = version.GetCurrentVersion(profile.Mode)

	return &profile, nil
}

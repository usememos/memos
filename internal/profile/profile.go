package profile

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/pkg/errors"
)

// Profile is the configuration to start main server.
type Profile struct {
	// Demo indicates if the server is in demo mode
	Demo bool
	// Addr is the binding address for server
	Addr string
	// Port is the binding port for server
	Port int
	// UNIXSock is the IPC binding path. Overrides Addr and Port
	UNIXSock string
	// Data is the data directory
	Data string
	// DSN points to where memos stores its own data
	DSN string
	// Driver is the database driver
	// sqlite, mysql
	Driver string
	// Version is the current version of server
	Version string
	// InstanceURL is the url of your memos instance.
	InstanceURL string
}

func checkDataDir(dataDir string) (string, error) {
	// Convert to absolute path if relative path is supplied.
	if !filepath.IsAbs(dataDir) {
		// Use current working directory, not the binary's directory
		// This ensures we use the actual working directory where the process runs
		absDir, err := filepath.Abs(dataDir)
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

func (p *Profile) Validate() error {
	// Set default data directory if not specified
	if p.Data == "" {
		if runtime.GOOS == "windows" {
			p.Data = filepath.Join(os.Getenv("ProgramData"), "memos")
		} else {
			// On Linux/macOS, check if /var/opt/memos exists and is writable (Docker scenario)
			if info, err := os.Stat("/var/opt/memos"); err == nil && info.IsDir() {
				// Check if we can write to this directory
				testFile := filepath.Join("/var/opt/memos", ".write-test")
				if err := os.WriteFile(testFile, []byte("test"), 0600); err == nil {
					os.Remove(testFile)
					p.Data = "/var/opt/memos"
				} else {
					// /var/opt/memos exists but is not writable, use current directory
					slog.Warn("/var/opt/memos is not writable, using current directory")
					p.Data = "."
				}
			} else {
				// /var/opt/memos doesn't exist, use current directory (local development)
				p.Data = "."
			}
		}
	}

	// Create data directory if it doesn't exist
	if _, err := os.Stat(p.Data); os.IsNotExist(err) {
		if err := os.MkdirAll(p.Data, 0770); err != nil {
			slog.Error("failed to create data directory", slog.String("data", p.Data), slog.String("error", err.Error()))
			return err
		}
	}

	dataDir, err := checkDataDir(p.Data)
	if err != nil {
		slog.Error("failed to check dsn", slog.String("data", dataDir), slog.String("error", err.Error()))
		return err
	}

	p.Data = dataDir
	if p.Driver == "sqlite" && p.DSN == "" {
		mode := "prod"
		if p.Demo {
			mode = "demo"
		}
		dbFile := fmt.Sprintf("memos_%s.db", mode)
		p.DSN = filepath.Join(dataDir, dbFile)
	}

	return nil
}

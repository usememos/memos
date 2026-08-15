package profile

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"

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
	// Commit is the current build commit of server
	Commit string
	// InstanceURL is the url of your memos instance. It is used only for
	// canonical URL and link generation; it never controls anonymous access.
	InstanceURL string

	// allowAnonymous mirrors the persisted GENERAL instance setting
	// (allow_public_access). The zero value is false, so a fresh or
	// unconfigured instance is private.
	allowAnonymous atomic.Bool
}

// SetAllowAnonymous publishes the effective anonymous-access policy. It is
// called by the store whenever the GENERAL instance setting is read or updated,
// so an administrator toggle takes effect immediately without a restart.
func (p *Profile) SetAllowAnonymous(allowed bool) {
	if p == nil {
		return
	}
	p.allowAnonymous.Store(allowed)
}

// AllowAnonymous reports whether unauthenticated visitors may access the
// instance, per the persisted allow_public_access setting. Absent or unloaded
// state is private. Authenticated callers (session, access token, or personal
// access token) are never affected by this policy.
func (p *Profile) AllowAnonymous() bool {
	if p == nil {
		return false
	}
	return p.allowAnonymous.Load()
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

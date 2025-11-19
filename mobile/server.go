package mobile

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	"github.com/usememos/memos/server"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

// ServerConfig holds the configuration for the mobile server.
type ServerConfig struct {
	// DataDir is the directory where memos data will be stored
	DataDir string
	// Port is the port to bind the server to
	Port int
	// Addr is the address to bind to (use "0.0.0.0" for network access, "" for localhost only)
	Addr string
	// Mode can be "prod", "dev", or "demo"
	Mode string
}

// MobileServer wraps the memos server for use in mobile applications.
type MobileServer struct {
	server *server.Server
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.Mutex
	logger *slog.Logger
}

var (
	globalServer *MobileServer
	serverMu     sync.Mutex
)

// NewServer creates a new mobile server instance with the given configuration.
// Returns the server URL on success.
func NewServer(dataDir string, port int, addr string, mode string) (string, error) {
	serverMu.Lock()
	defer serverMu.Unlock()

	if globalServer != nil {
		return "", fmt.Errorf("server already running")
	}

	// Set up logger
	logLevel := slog.LevelInfo
	if mode == "dev" {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	// Ensure data directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create data directory: %w", err)
	}

	// Create profile
	instanceProfile := &profile.Profile{
		Mode:    mode,
		Addr:    addr,
		Port:    port,
		Data:    dataDir,
		Driver:  "sqlite",
		DSN:     "",
		Version: version.GetCurrentVersion(mode),
	}

	if err := instanceProfile.Validate(); err != nil {
		return "", fmt.Errorf("invalid profile: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Create database driver
	dbDriver, err := db.NewDBDriver(instanceProfile)
	if err != nil {
		cancel()
		return "", fmt.Errorf("failed to create db driver: %w", err)
	}

	// Create store and migrate
	storeInstance := store.New(dbDriver, instanceProfile)
	if err := storeInstance.Migrate(ctx); err != nil {
		cancel()
		return "", fmt.Errorf("failed to migrate: %w", err)
	}

	// Create server
	s, err := server.NewServer(ctx, instanceProfile, storeInstance)
	if err != nil {
		cancel()
		return "", fmt.Errorf("failed to create server: %w", err)
	}

	globalServer = &MobileServer{
		server: s,
		ctx:    ctx,
		cancel: cancel,
		logger: logger,
	}

	// Start server in background
	go func() {
		if err := s.Start(ctx); err != nil {
			logger.Error("server error", "error", err)
		}
	}()

	// Construct server URL
	serverURL := fmt.Sprintf("http://localhost:%d", port)
	if addr != "" && addr != "localhost" && addr != "127.0.0.1" {
		serverURL = fmt.Sprintf("http://%s:%d", addr, port)
	}

	logger.Info("Memos server started", "url", serverURL)

	return serverURL, nil
}

// StopServer stops the running server.
func StopServer() error {
	serverMu.Lock()
	defer serverMu.Unlock()

	if globalServer == nil {
		return fmt.Errorf("no server running")
	}

	globalServer.mu.Lock()
	defer globalServer.mu.Unlock()

	globalServer.logger.Info("Stopping memos server")
	globalServer.server.Shutdown(globalServer.ctx)
	globalServer.cancel()
	globalServer = nil

	return nil
}

// IsServerRunning returns true if the server is currently running.
func IsServerRunning() bool {
	serverMu.Lock()
	defer serverMu.Unlock()
	return globalServer != nil
}

// GetDataDirectory returns an appropriate data directory for iOS.
// This should be called from Swift/Objective-C with the app's document directory.
func GetDataDirectory(documentsDir string) string {
	return filepath.Join(documentsDir, "memos-data")
}

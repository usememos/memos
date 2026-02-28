package test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/pkg/errors"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/mysql"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/network"
	"github.com/testcontainers/testcontainers-go/wait"

	// Database drivers for connection verification.
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

const (
	testUser     = "root"
	testPassword = "test"

	// Memos container settings for migration testing.
	MemosDockerImage   = "neosmemo/memos"
	StableMemosVersion = "stable" // Always points to the latest stable release
)

var (
	mysqlContainer    atomic.Pointer[mysql.MySQLContainer]
	postgresContainer atomic.Pointer[postgres.PostgresContainer]
	mysqlOnce         sync.Once
	postgresOnce      sync.Once
	mysqlBaseDSN      atomic.Value // stores string
	postgresBaseDSN   atomic.Value // stores string
	dbCounter         atomic.Int64
	dbCreationMutex   sync.Mutex // Protects database creation operations

	// Network for container communication.
	testDockerNetwork atomic.Pointer[testcontainers.DockerNetwork]
	testNetworkOnce   sync.Once
)

// getTestNetwork creates or returns the shared Docker network for container communication.
func getTestNetwork(ctx context.Context) (*testcontainers.DockerNetwork, error) {
	var networkErr error
	testNetworkOnce.Do(func() {
		nw, err := network.New(ctx, network.WithDriver("bridge"))
		if err != nil {
			networkErr = err
			return
		}
		testDockerNetwork.Store(nw)
	})
	return testDockerNetwork.Load(), networkErr
}

// GetMySQLDSN starts a MySQL container (if not already running) and creates a fresh database for this test.
func GetMySQLDSN(t *testing.T) string {
	ctx := context.Background()

	mysqlOnce.Do(func() {
		nw, err := getTestNetwork(ctx)
		if err != nil {
			t.Fatalf("failed to create test network: %v", err)
		}

		container, err := mysql.Run(ctx,
			"mysql:8",
			mysql.WithDatabase("init_db"),
			mysql.WithUsername("root"),
			mysql.WithPassword(testPassword),
			testcontainers.WithEnv(map[string]string{
				"MYSQL_ROOT_PASSWORD": testPassword,
			}),
			testcontainers.WithWaitStrategy(
				wait.ForAll(
					wait.ForLog("ready for connections").WithOccurrence(2),
					wait.ForListeningPort("3306/tcp"),
				).WithDeadline(120*time.Second),
			),
			network.WithNetwork(nil, nw),
		)
		if err != nil {
			t.Fatalf("failed to start MySQL container: %v", err)
		}
		mysqlContainer.Store(container)

		dsn, err := container.ConnectionString(ctx, "multiStatements=true")
		if err != nil {
			t.Fatalf("failed to get MySQL connection string: %v", err)
		}

		if err := waitForDB("mysql", dsn, 30*time.Second); err != nil {
			t.Fatalf("MySQL not ready for connections: %v", err)
		}

		mysqlBaseDSN.Store(dsn)
	})

	dsn, ok := mysqlBaseDSN.Load().(string)
	if !ok || dsn == "" {
		t.Fatal("MySQL container failed to start in a previous test")
	}

	// Serialize database creation to avoid "table already exists" race conditions
	dbCreationMutex.Lock()
	defer dbCreationMutex.Unlock()

	// Create a fresh database for this test
	dbName := fmt.Sprintf("memos_test_%d", dbCounter.Add(1))
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatalf("failed to connect to MySQL: %v", err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE `%s`", dbName)); err != nil {
		t.Fatalf("failed to create database %s: %v", dbName, err)
	}

	// Return DSN pointing to the new database
	return strings.Replace(dsn, "/init_db?", "/"+dbName+"?", 1)
}

// waitForDB polls the database until it's ready or timeout is reached.
func waitForDB(driver, dsn string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	var lastErr error
	for {
		select {
		case <-ctx.Done():
			if lastErr != nil {
				return errors.Errorf("timeout waiting for %s database: %v", driver, lastErr)
			}
			return errors.Errorf("timeout waiting for %s database to be ready", driver)
		case <-ticker.C:
			db, err := sql.Open(driver, dsn)
			if err != nil {
				lastErr = err
				continue
			}
			err = db.PingContext(ctx)
			db.Close()
			if err == nil {
				return nil
			}
			lastErr = err
		}
	}
}

// GetPostgresDSN starts a PostgreSQL container (if not already running) and creates a fresh database for this test.
func GetPostgresDSN(t *testing.T) string {
	ctx := context.Background()

	postgresOnce.Do(func() {
		nw, err := getTestNetwork(ctx)
		if err != nil {
			t.Fatalf("failed to create test network: %v", err)
		}

		container, err := postgres.Run(ctx,
			"postgres:18",
			postgres.WithDatabase("init_db"),
			postgres.WithUsername(testUser),
			postgres.WithPassword(testPassword),
			testcontainers.WithWaitStrategy(
				wait.ForAll(
					wait.ForLog("database system is ready to accept connections").WithOccurrence(2),
					wait.ForListeningPort("5432/tcp"),
				).WithDeadline(120*time.Second),
			),
			network.WithNetwork(nil, nw),
		)
		if err != nil {
			t.Fatalf("failed to start PostgreSQL container: %v", err)
		}
		postgresContainer.Store(container)

		dsn, err := container.ConnectionString(ctx, "sslmode=disable")
		if err != nil {
			t.Fatalf("failed to get PostgreSQL connection string: %v", err)
		}

		if err := waitForDB("postgres", dsn, 30*time.Second); err != nil {
			t.Fatalf("PostgreSQL not ready for connections: %v", err)
		}

		postgresBaseDSN.Store(dsn)
	})

	dsn, ok := postgresBaseDSN.Load().(string)
	if !ok || dsn == "" {
		t.Fatal("PostgreSQL container failed to start in a previous test")
	}

	// Serialize database creation to avoid "table already exists" race conditions
	dbCreationMutex.Lock()
	defer dbCreationMutex.Unlock()

	// Create a fresh database for this test
	dbName := fmt.Sprintf("memos_test_%d", dbCounter.Add(1))
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("failed to connect to PostgreSQL: %v", err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE %s", dbName)); err != nil {
		t.Fatalf("failed to create database %s: %v", dbName, err)
	}

	// Return DSN pointing to the new database
	return strings.Replace(dsn, "/init_db?", "/"+dbName+"?", 1)
}

// TerminateContainers cleans up all running containers and network.
// This is typically called from TestMain.
func TerminateContainers() {
	ctx := context.Background()
	if container := mysqlContainer.Load(); container != nil {
		_ = container.Terminate(ctx)
	}
	if container := postgresContainer.Load(); container != nil {
		_ = container.Terminate(ctx)
	}
	if network := testDockerNetwork.Load(); network != nil {
		_ = network.Remove(ctx)
	}
}

// MemosContainerConfig holds configuration for starting a Memos container.
type MemosContainerConfig struct {
	Version string // Memos version tag (e.g., "0.24.0")
	Driver  string // Database driver: sqlite, mysql, postgres
	DSN     string // Database DSN (for mysql/postgres)
	DataDir string // Host directory to mount for SQLite data
}

// MemosStartupWaitStrategy defines the wait strategy for Memos container startup.
// Uses regex to match various log message formats across versions.
var MemosStartupWaitStrategy = wait.ForAll(
	wait.ForLog("(started successfully|has been started on port)").AsRegexp(),
	wait.ForListeningPort("5230/tcp"),
).WithDeadline(180 * time.Second)

// StartMemosContainer starts a Memos container for migration testing.
// For SQLite, it mounts the dataDir to /var/opt/memos.
func StartMemosContainer(ctx context.Context, cfg MemosContainerConfig) (testcontainers.Container, error) {
	env := map[string]string{
		"MEMOS_MODE": "prod",
	}

	var opts []testcontainers.ContainerCustomizer

	switch cfg.Driver {
	case "sqlite":
		env["MEMOS_DRIVER"] = "sqlite"
		opts = append(opts, testcontainers.WithHostConfigModifier(func(hc *container.HostConfig) {
			hc.Binds = append(hc.Binds, fmt.Sprintf("%s:%s", cfg.DataDir, "/var/opt/memos"))
		}))
	default:
		return nil, errors.Errorf("unsupported driver for migration testing: %s", cfg.Driver)
	}

	req := testcontainers.ContainerRequest{
		Image:        fmt.Sprintf("%s:%s", MemosDockerImage, cfg.Version),
		Env:          env,
		ExposedPorts: []string{"5230/tcp"},
		WaitingFor:   MemosStartupWaitStrategy,
		User:         fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()),
	}

	// Use local image if specified
	if cfg.Version == "local" {
		if os.Getenv("MEMOS_TEST_IMAGE_BUILT") == "1" {
			req.Image = "memos-test:local"
		} else {
			req.FromDockerfile = testcontainers.FromDockerfile{
				Context:    "../../",
				Dockerfile: "Dockerfile",
			}
		}
	}

	genericReq := testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	}

	// Apply options
	for _, opt := range opts {
		if err := opt.Customize(&genericReq); err != nil {
			return nil, errors.Wrap(err, "failed to apply container option")
		}
	}

	ctr, err := testcontainers.GenericContainer(ctx, genericReq)
	if err != nil {
		return nil, errors.Wrap(err, "failed to start memos container")
	}

	return ctr, nil
}

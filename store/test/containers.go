package test

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/mysql"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	// Database drivers for connection verification.
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

const (
	testUser     = "root"
	testPassword = "test"
)

var (
	mysqlContainer    *mysql.MySQLContainer
	postgresContainer *postgres.PostgresContainer
	mysqlOnce         sync.Once
	postgresOnce      sync.Once
	mysqlBaseDSN      string
	postgresBaseDSN   string
	dbCounter         atomic.Int64
)

// GetMySQLDSN starts a MySQL container (if not already running) and creates a fresh database for this test.
func GetMySQLDSN(t *testing.T) string {
	ctx := context.Background()

	mysqlOnce.Do(func() {
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
		)
		if err != nil {
			t.Fatalf("failed to start MySQL container: %v", err)
		}
		mysqlContainer = container

		dsn, err := container.ConnectionString(ctx, "multiStatements=true")
		if err != nil {
			t.Fatalf("failed to get MySQL connection string: %v", err)
		}

		if err := waitForDB("mysql", dsn, 30*time.Second); err != nil {
			t.Fatalf("MySQL not ready for connections: %v", err)
		}

		mysqlBaseDSN = dsn
	})

	if mysqlBaseDSN == "" {
		t.Fatal("MySQL container failed to start in a previous test")
	}

	// Create a fresh database for this test
	dbName := fmt.Sprintf("memos_test_%d", dbCounter.Add(1))
	db, err := sql.Open("mysql", mysqlBaseDSN)
	if err != nil {
		t.Fatalf("failed to connect to MySQL: %v", err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE `%s`", dbName)); err != nil {
		t.Fatalf("failed to create database %s: %v", dbName, err)
	}

	// Return DSN pointing to the new database
	return strings.Replace(mysqlBaseDSN, "/init_db?", "/"+dbName+"?", 1)
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
		)
		if err != nil {
			t.Fatalf("failed to start PostgreSQL container: %v", err)
		}
		postgresContainer = container

		dsn, err := container.ConnectionString(ctx, "sslmode=disable")
		if err != nil {
			t.Fatalf("failed to get PostgreSQL connection string: %v", err)
		}

		if err := waitForDB("postgres", dsn, 30*time.Second); err != nil {
			t.Fatalf("PostgreSQL not ready for connections: %v", err)
		}

		postgresBaseDSN = dsn
	})

	if postgresBaseDSN == "" {
		t.Fatal("PostgreSQL container failed to start in a previous test")
	}

	// Create a fresh database for this test
	dbName := fmt.Sprintf("memos_test_%d", dbCounter.Add(1))
	db, err := sql.Open("postgres", postgresBaseDSN)
	if err != nil {
		t.Fatalf("failed to connect to PostgreSQL: %v", err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE %s", dbName)); err != nil {
		t.Fatalf("failed to create database %s: %v", dbName, err)
	}

	// Return DSN pointing to the new database
	return strings.Replace(postgresBaseDSN, "/init_db?", "/"+dbName+"?", 1)
}

// TerminateContainers cleans up all running containers.
// This is typically called from TestMain.
func TerminateContainers() {
	ctx := context.Background()
	if mysqlContainer != nil {
		_ = mysqlContainer.Terminate(ctx)
	}
	if postgresContainer != nil {
		_ = postgresContainer.Terminate(ctx)
	}
}

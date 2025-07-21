package v1

import (
	"context"
	"testing"

	"github.com/usememos/memos/internal/profile"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// TestService holds the test service setup for API v1 services.
type TestService struct {
	Service *apiv1.APIV1Service
	Store   *store.Store
	Profile *profile.Profile
	Secret  string
}

// NewTestService creates a new test service with SQLite database.
func NewTestService(t *testing.T) *TestService {
	ctx := context.Background()

	// Create a test store with SQLite
	testStore := teststore.NewTestingStore(ctx, t)

	// Create a test profile
	testProfile := &profile.Profile{
		Mode:        "dev",
		Version:     "test-1.0.0",
		InstanceURL: "http://localhost:8080",
		Driver:      "sqlite",
		DSN:         ":memory:",
	}

	// Create APIV1Service with nil grpcServer since we're testing direct calls
	secret := "test-secret"
	service := &apiv1.APIV1Service{
		Secret:  secret,
		Profile: testProfile,
		Store:   testStore,
	}

	return &TestService{
		Service: service,
		Store:   testStore,
		Profile: testProfile,
		Secret:  secret,
	}
}

// Cleanup clears caches and closes resources after test.
func (ts *TestService) Cleanup() {
	ts.Store.Close()
	// Note: Owner cache is package-level in parent package, cannot clear from test package
}

// CreateHostUser creates a host user for testing.
func (ts *TestService) CreateHostUser(ctx context.Context, username string) (*store.User, error) {
	return ts.Store.CreateUser(ctx, &store.User{
		Username: username,
		Role:     store.RoleHost,
		Email:    username + "@example.com",
	})
}

// CreateRegularUser creates a regular user for testing.
func (ts *TestService) CreateRegularUser(ctx context.Context, username string) (*store.User, error) {
	return ts.Store.CreateUser(ctx, &store.User{
		Username: username,
		Role:     store.RoleUser,
		Email:    username + "@example.com",
	})
}

// CreateUserContext creates a context with the given user's ID for authentication.
func (*TestService) CreateUserContext(ctx context.Context, userID int32) context.Context {
	// Use the real context key from the parent package
	return apiv1.CreateTestUserContext(ctx, userID)
}

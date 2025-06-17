package v1

import (
	"context"
	"testing"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// TestService holds the test service setup for API v1 services.
type TestService struct {
	Service *APIV1Service
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
	service := &APIV1Service{
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
	// Clear the global owner cache for test isolation
	ownerCache = nil
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

// CreateUserContext creates a context with the given username for authentication.
func (ts *TestService) CreateUserContext(ctx context.Context, username string) context.Context {
	_ = ts                                                 // Silence unused receiver warning - method is part of TestService interface
	return context.WithValue(ctx, ContextKey(0), username) // usernameContextKey = 0
}

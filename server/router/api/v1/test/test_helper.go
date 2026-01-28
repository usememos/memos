package test

import (
	"context"
	"testing"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/plugin/markdown"
	"github.com/usememos/memos/server/auth"
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
		Demo:        true,
		Version:     "test-1.0.0",
		InstanceURL: "http://localhost:8080",
		Driver:      "sqlite",
		DSN:         ":memory:",
	}

	// Create APIV1Service with nil grpcServer since we're testing direct calls
	secret := "test-secret"
	markdownService := markdown.NewService(
		markdown.WithTagExtension(),
	)
	service := &apiv1.APIV1Service{
		Secret:          secret,
		Profile:         testProfile,
		Store:           testStore,
		MarkdownService: markdownService,
	}

	return &TestService{
		Service: service,
		Store:   testStore,
		Profile: testProfile,
		Secret:  secret,
	}
}

// Cleanup closes resources after test.
func (ts *TestService) Cleanup() {
	ts.Store.Close()
}

// CreateHostUser creates an admin user for testing.
func (ts *TestService) CreateHostUser(ctx context.Context, username string) (*store.User, error) {
	return ts.Store.CreateUser(ctx, &store.User{
		Username: username,
		Role:     store.RoleAdmin,
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
	// Use the context key from the auth package
	return context.WithValue(ctx, auth.UserIDContextKey, userID)
}

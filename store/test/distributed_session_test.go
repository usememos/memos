package teststore

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/cache"
	"github.com/usememos/memos/store/db"
)

// TestDistributedSessionStore tests the core business problem we solved:
// Multi-pod Kubernetes deployments sharing user sessions to fix SSO redirect issues
func TestDistributedSessionStore(t *testing.T) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		t.Skip("REDIS_URL not set, skipping distributed session tests - this tests the core K8s scaling feature")
	}

	ctx := context.Background()

	// Create two store instances to simulate multiple K8s pods
	store1 := createStoreWithRedisCache(ctx, t, "pod1")
	defer store1.Close()

	store2 := createStoreWithRedisCache(ctx, t, "pod2")
	defer store2.Close()

	// Give time for cache initialization
	time.Sleep(100 * time.Millisecond)

	// Test the core SSO redirect issue: session created in pod1 should be available in pod2
	t.Run("SSO_RedirectFix_SessionSharingAcrossPods", func(t *testing.T) {
		testSessionSharingAcrossPods(t, ctx, store1, store2)
	})

	// Test session cleanup works across pods
	t.Run("SessionInvalidationAcrossPods", func(t *testing.T) {
		testSessionInvalidationAcrossPods(t, ctx, store1, store2)
	})

	// Test user settings sync (part of session management)
	t.Run("UserSettingsSynchronization", func(t *testing.T) {
		testUserSettingsSynchronization(t, ctx, store1, store2)
	})
}

func createStoreWithRedisCache(ctx context.Context, t *testing.T, instanceID string) *store.Store {
	redisURL := os.Getenv("REDIS_URL")

	// Create profile for testing
	profile := getTestingProfile(t)
	profile.Data = fmt.Sprintf("%s_%s", profile.Data, instanceID)

	// Create database driver
	dbDriver, err := db.NewDBDriver(profile)
	require.NoError(t, err)

	// Reset and migrate database
	resetTestingDB(ctx, profile, dbDriver)

	// Create store with Redis cache
	testStore := store.New(dbDriver, profile)

	// Override cache with Redis-enabled cache for testing
	redisConfig := cache.RedisConfig{
		URL:          redisURL,
		PoolSize:     10,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		KeyPrefix:    fmt.Sprintf("test-%s", instanceID),
	}

	localConfig := cache.Config{
		MaxItems:        100,
		DefaultTTL:      time.Hour,
		CleanupInterval: time.Minute,
	}

	hybridCache, err := cache.NewHybridCache(redisConfig, localConfig)
	require.NoError(t, err)

	// Set the hybrid cache for user settings
	testStore.SetUserSettingCache(hybridCache)

	// Migrate database
	err = testStore.Migrate(ctx)
	require.NoError(t, err)

	return testStore
}

func testSessionSharingAcrossPods(t *testing.T, ctx context.Context, store1, store2 *store.Store) {
	// Create a user in store1
	user, err := createTestingHostUser(ctx, store1)
	require.NoError(t, err)

	// Add session to user in store1
	sessionID := "test-session-12345"
	now := timestamppb.Now()
	session := &storepb.SessionsUserSetting_Session{
		SessionId:        sessionID,
		CreateTime:       now,
		LastAccessedTime: now,
		ClientInfo:       &storepb.SessionsUserSetting_ClientInfo{},
	}

	err = store1.AddUserSession(ctx, user.ID, session)
	require.NoError(t, err)

	// Give time for cache synchronization
	time.Sleep(200 * time.Millisecond)

	// Verify session is available in store2
	sessions, err := store2.GetUserSessions(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, sessions, 1)
	require.Equal(t, sessionID, sessions[0].SessionId)
}

func testSessionInvalidationAcrossPods(t *testing.T, ctx context.Context, store1, store2 *store.Store) {
	// Create a user and add session
	user, err := createTestingHostUser(ctx, store1)
	require.NoError(t, err)

	sessionID1 := "test-session-invalidate-1"
	sessionID2 := "test-session-invalidate-2"

	session1 := &storepb.SessionsUserSetting_Session{
		SessionId:        sessionID1,
		CreateTime:       timestamppb.Now(),
		LastAccessedTime: timestamppb.Now(),
		ClientInfo:       &storepb.SessionsUserSetting_ClientInfo{},
	}
	session2 := &storepb.SessionsUserSetting_Session{
		SessionId:        sessionID2,
		CreateTime:       timestamppb.Now(),
		LastAccessedTime: timestamppb.Now(),
		ClientInfo:       &storepb.SessionsUserSetting_ClientInfo{},
	}

	err = store1.AddUserSession(ctx, user.ID, session1)
	require.NoError(t, err)

	err = store1.AddUserSession(ctx, user.ID, session2)
	require.NoError(t, err)

	// Give time for synchronization
	time.Sleep(200 * time.Millisecond)

	// Verify both sessions exist in store2
	sessions, err := store2.GetUserSessions(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, sessions, 2)

	// Remove one session from store1
	err = store1.RemoveUserSession(ctx, user.ID, sessionID1)
	require.NoError(t, err)

	// Give time for cache invalidation
	time.Sleep(200 * time.Millisecond)

	// Verify session is removed from store2 as well
	sessions, err = store2.GetUserSessions(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, sessions, 1)
	require.Equal(t, sessionID2, sessions[0].SessionId)
}

func testUserSettingsSynchronization(t *testing.T, ctx context.Context, store1, store2 *store.Store) {
	// Create a user
	user, err := createTestingHostUser(ctx, store1)
	require.NoError(t, err)

	// Create user setting in store1
	generalSetting := &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value: &storepb.UserSetting_General{
			General: &storepb.GeneralUserSetting{
				Locale: "en-US",
				Theme:  "dark",
			},
		},
	}

	_, err = store1.UpsertUserSetting(ctx, generalSetting)
	require.NoError(t, err)

	// Give time for cache synchronization
	time.Sleep(200 * time.Millisecond)

	// Verify setting is available in store2
	settings, err := store2.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	require.NoError(t, err)
	require.Len(t, settings, 1)
	require.Equal(t, "en-US", settings[0].GetGeneral().Locale)
	require.Equal(t, "dark", settings[0].GetGeneral().Theme)

	// Update setting in store2
	generalSetting.Value.(*storepb.UserSetting_General).General.Theme = "light"
	_, err = store2.UpsertUserSetting(ctx, generalSetting)
	require.NoError(t, err)

	// Give time for synchronization
	time.Sleep(200 * time.Millisecond)

	// Verify update is reflected in store1
	settings, err = store1.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	require.NoError(t, err)
	require.Len(t, settings, 1)
	require.Equal(t, "light", settings[0].GetGeneral().Theme)
}

func createTestingHostUserWithName(ctx context.Context, ts *store.Store, username string) (*store.User, error) {
	userCreate := &store.User{
		Username:    username,
		Role:        store.RoleHost,
		Email:       fmt.Sprintf("%s@test.com", username),
		Nickname:    fmt.Sprintf("%s_nickname", username),
		Description: fmt.Sprintf("%s_description", username),
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test_password"), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	userCreate.PasswordHash = string(passwordHash)
	user, err := ts.CreateUser(ctx, userCreate)
	return user, err
}

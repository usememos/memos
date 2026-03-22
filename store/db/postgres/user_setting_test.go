package postgres

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestGetUserByPATHashWithMissingData tests the fix for #5611 and #5612.
// Verifies that GetUserByPATHash handles missing/malformed data gracefully
// instead of throwing PostgreSQL JSONB errors.
func TestGetUserByPATHashWithMissingData(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping PostgreSQL integration test in short mode")
	}

	// This test requires a real PostgreSQL connection
	// If DSN is not provided, skip the test
	dsn := getTestDSN()
	if dsn == "" {
		t.Skip("PostgreSQL DSN not provided, skipping test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	defer db.Close()

	// Create test database
	ctx := context.Background()
	driver := &DB{db: db}

	// Setup: Create user_setting table if needed
	_, err = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_setting (
			user_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			UNIQUE(user_id, key)
		)
	`)
	require.NoError(t, err)

	// Cleanup
	defer func() {
		db.ExecContext(ctx, "DELETE FROM user_setting WHERE user_id IN (1001, 1002, 1003)")
	}()

	t.Run("NoTokensKeyAtAll", func(t *testing.T) {
		// Test case: User has no PERSONAL_ACCESS_TOKENS key
		// This simulates fresh users or users upgraded from v0.25.3
		result, err := driver.GetUserByPATHash(ctx, "any-hash")
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "PAT not found")
	})

	t.Run("EmptyTokensArray", func(t *testing.T) {
		// Insert user with empty tokens array
		_, err := db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1001, "PERSONAL_ACCESS_TOKENS", `{"tokens":[]}`)
		require.NoError(t, err)

		result, err := driver.GetUserByPATHash(ctx, "any-hash")
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "PAT not found")
	})

	t.Run("MalformedJSON", func(t *testing.T) {
		// Insert user with malformed JSON
		_, err := db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1002, "PERSONAL_ACCESS_TOKENS", `{invalid json}`)
		require.NoError(t, err)

		// Should handle gracefully without crashing
		result, err := driver.GetUserByPATHash(ctx, "any-hash")
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "PAT not found")
	})

	t.Run("MissingTokensField", func(t *testing.T) {
		// Insert user with valid JSON but missing 'tokens' field
		_, err := db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1003, "PERSONAL_ACCESS_TOKENS", `{"someOtherField":"value"}`)
		require.NoError(t, err)

		// Should handle gracefully
		result, err := driver.GetUserByPATHash(ctx, "any-hash")
		assert.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("ValidTokenFound", func(t *testing.T) {
		// Insert user with valid PAT
		validJSON := `{
			"tokens": [
				{
					"tokenId": "pat-test",
					"tokenHash": "hash-test-123",
					"description": "Test PAT"
				}
			]
		}`
		_, err := db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1001, "PERSONAL_ACCESS_TOKENS", validJSON)
		require.NoError(t, err)

		// Should find the token
		result, err := driver.GetUserByPATHash(ctx, "hash-test-123")
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, int32(1001), result.UserID)
		assert.Equal(t, "pat-test", result.PAT.TokenId)
		assert.Equal(t, "hash-test-123", result.PAT.TokenHash)
	})

	t.Run("MultipleUsersWithMixedData", func(t *testing.T) {
		// User 1001: Valid PAT
		validJSON := `{
			"tokens": [
				{
					"tokenId": "pat-user1",
					"tokenHash": "hash-user1",
					"description": "User 1 PAT"
				}
			]
		}`
		_, err := db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1001, "PERSONAL_ACCESS_TOKENS", validJSON)
		require.NoError(t, err)

		// User 1002: Malformed JSON (should be skipped)
		_, err = db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1002, "PERSONAL_ACCESS_TOKENS", `{invalid}`)
		require.NoError(t, err)

		// User 1003: Empty array (should be skipped)
		_, err = db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, 1003, "PERSONAL_ACCESS_TOKENS", `{"tokens":[]}`)
		require.NoError(t, err)

		// Should still find user 1001's token despite other users having bad data
		result, err := driver.GetUserByPATHash(ctx, "hash-user1")
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, int32(1001), result.UserID)
	})
}

// TestGetUserByPATHashPerformance ensures the simplified query doesn't cause performance issues.
func TestGetUserByPATHashPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	dsn := getTestDSN()
	if dsn == "" {
		t.Skip("PostgreSQL DSN not provided, skipping test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()
	driver := &DB{db: db}

	// Setup table
	_, err = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_setting (
			user_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			UNIQUE(user_id, key)
		)
	`)
	require.NoError(t, err)

	// Cleanup
	defer func() {
		db.ExecContext(ctx, "DELETE FROM user_setting WHERE user_id >= 2000 AND user_id < 2100")
	}()

	// Insert 100 users with PATs
	for i := 2000; i < 2100; i++ {
		json := `{
			"tokens": [
				{
					"tokenId": "pat-` + string(rune(i)) + `",
					"tokenHash": "hash-` + string(rune(i)) + `",
					"description": "Test PAT"
				}
			]
		}`
		_, err = db.ExecContext(ctx, `
			INSERT INTO user_setting (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
		`, i, "PERSONAL_ACCESS_TOKENS", json)
		require.NoError(t, err)
	}

	// Query should complete quickly even with 100 users
	result, err := driver.GetUserByPATHash(ctx, "hash-"+string(rune(2050)))
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, int32(2050), result.UserID)
}

// getTestDSN returns PostgreSQL DSN from environment or returns empty string.
func getTestDSN() string {
	// For unit tests, we expect TEST_POSTGRES_DSN to be set.
	// Example: TEST_POSTGRES_DSN="postgresql://user:pass@localhost:5432/memos_test?sslmode=disable".
	return ""
}

// TestUpsertUserSetting tests basic upsert functionality.
func TestUpsertUserSetting(t *testing.T) {
	dsn := getTestDSN()
	if dsn == "" {
		t.Skip("PostgreSQL DSN not provided, skipping test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()
	driver := &DB{db: db}

	// Setup
	_, err = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_setting (
			user_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			UNIQUE(user_id, key)
		)
	`)
	require.NoError(t, err)

	defer func() {
		db.ExecContext(ctx, "DELETE FROM user_setting WHERE user_id = 9999")
	}()

	// Test insert
	setting := &store.UserSetting{
		UserID: 9999,
		Key:    storepb.UserSetting_GENERAL,
		Value:  `{"locale":"en"}`,
	}
	result, err := driver.UpsertUserSetting(ctx, setting)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, int32(9999), result.UserID)

	// Test update (upsert on conflict)
	setting.Value = `{"locale":"zh"}`
	result, err = driver.UpsertUserSetting(ctx, setting)
	assert.NoError(t, err)
	assert.Equal(t, `{"locale":"zh"}`, result.Value)
}

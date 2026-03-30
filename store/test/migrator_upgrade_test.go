package test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestMigrationFromV0262PreservesLegacyData(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping container-based upgrade test in short mode")
	}
	if os.Getenv("SKIP_CONTAINER_TESTS") == "1" {
		t.Skip("skipping container-based test (SKIP_CONTAINER_TESTS=1)")
	}

	ctx := context.Background()
	driver := getDriverFromEnv()

	cfg, hostDSN := prepareV0262MigrationTest(t, driver)
	t.Logf("Starting Memos %s container for %s schema bootstrap...", cfg.Version, driver)
	container, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start v0.26.2 memos container")
	t.Cleanup(func() {
		if container != nil {
			_ = container.Terminate(ctx)
		}
	})

	legacyStore := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)
	require.Eventually(t, func() bool {
		setting, err := legacyStore.GetInstanceBasicSetting(ctx)
		return err == nil && setting != nil && setting.SchemaVersion != ""
	}, 45*time.Second, 500*time.Millisecond, "legacy schema should be initialized by old container")

	settingBeforeSeed, err := legacyStore.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	t.Logf("Legacy schema version before migration: %s", settingBeforeSeed.SchemaVersion)

	err = container.Terminate(ctx)
	require.NoError(t, err, "failed to stop v0.26.2 memos container")
	container = nil

	db := openMigrationSQLDB(t, driver, hostDSN)
	defer db.Close()

	seedLegacyMigrationData(ctx, t, driver, db)

	count, err := countSystemSetting(ctx, db, "STORAGE")
	require.NoError(t, err)
	require.Zero(t, count, "v0.26.2 database should not have a STORAGE setting before migration")

	ts := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)
	err = ts.Migrate(ctx)
	require.NoError(t, err, "migration from v0.26.2 should succeed for %s", driver)

	currentVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	currentSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentVersion, currentSetting.SchemaVersion, "schema version should be updated")

	storageSetting, err := ts.GetInstanceStorageSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, storepb.InstanceStorageSetting_DATABASE, storageSetting.StorageType, "existing installs should stay on DATABASE storage")

	idps, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Len(t, idps, 2)
	idpUIDsByName := map[string]string{}
	for _, idp := range idps {
		idpUIDsByName[idp.Name] = idp.Uid
	}
	require.Equal(t, "00000191", idpUIDsByName["Legacy Google"])
	require.Equal(t, "00000192", idpUIDsByName["Legacy GitHub"])

	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.NotNil(t, inboxes[0].Message)
	require.Equal(t, storepb.InboxMessage_MEMO_COMMENT, inboxes[0].Message.Type)
	require.Equal(t, int32(102), inboxes[0].Message.GetMemoComment().MemoId)
	require.Equal(t, int32(101), inboxes[0].Message.GetMemoComment().RelatedMemoId)

	activityExists, err := tableExists(ctx, db, driver, "activity")
	require.NoError(t, err)
	require.False(t, activityExists, "activity table should be removed after migration")

	memoShareExists, err := tableExists(ctx, db, driver, "memo_share")
	require.NoError(t, err)
	require.True(t, memoShareExists, "memo_share table should be created")

	share, err := ts.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "post-upgrade-share",
		MemoID:    101,
		CreatorID: 11,
	})
	require.NoError(t, err)
	require.Equal(t, "post-upgrade-share", share.UID)

	postUpgradeUser, err := createTestingUserWithRole(ctx, ts, "postupgrade", store.RoleUser)
	require.NoError(t, err)
	postUpgradeMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "post-upgrade-memo-v0262",
		CreatorID:  postUpgradeUser.ID,
		Content:    "created after v0.26.2 migration",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.Equal(t, "created after v0.26.2 migration", postUpgradeMemo.Content)
}

func prepareV0262MigrationTest(t *testing.T, driver string) (MemosContainerConfig, string) {
	t.Helper()

	const version = "0.26.2"

	switch driver {
	case "sqlite":
		dataDir := t.TempDir()
		return MemosContainerConfig{
			Version: version,
			Driver:  driver,
			DataDir: dataDir,
		}, fmt.Sprintf("%s/memos_prod.db", dataDir)
	case "mysql":
		hostDSN := GetMySQLDSN(t)
		containerDSN, err := getContainerDSN(driver, hostDSN)
		require.NoError(t, err)
		return MemosContainerConfig{
			Version: version,
			Driver:  driver,
			DSN:     containerDSN,
		}, hostDSN
	case "postgres":
		hostDSN := GetPostgresDSN(t)
		containerDSN, err := getContainerDSN(driver, hostDSN)
		require.NoError(t, err)
		return MemosContainerConfig{
			Version: version,
			Driver:  driver,
			DSN:     containerDSN,
		}, hostDSN
	default:
		t.Fatalf("unsupported driver: %s", driver)
		return MemosContainerConfig{}, ""
	}
}

func openMigrationSQLDB(t *testing.T, driver, dsn string) *sql.DB {
	t.Helper()

	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)
	require.NoError(t, db.Ping())
	return db
}

func seedLegacyMigrationData(ctx context.Context, t *testing.T, driver string, db *sql.DB) {
	t.Helper()

	execMigrationSQL(t, db, legacyInsertUserSQL(driver, 11, "owner"))
	execMigrationSQL(t, db, legacyInsertUserSQL(driver, 12, "commenter"))
	execMigrationSQL(t, db, legacyInsertMemoSQL(101, 11, "legacy-parent", "parent memo"))
	execMigrationSQL(t, db, legacyInsertMemoSQL(102, 12, "legacy-comment", "comment memo"))
	execMigrationSQL(t, db, legacyInsertActivitySQL(201, 12))
	execMigrationSQL(t, db, legacyInsertInboxSQL(301, 12, 11, 201))
	execMigrationSQL(t, db, legacyInsertIDPSQL(401, "Legacy Google"))
	execMigrationSQL(t, db, legacyInsertIDPSQL(402, "Legacy GitHub"))

	var message string
	err := db.QueryRowContext(ctx, "SELECT message FROM inbox WHERE id = 301").Scan(&message)
	require.NoError(t, err)
	require.Contains(t, message, "\"activityId\":201")
	require.NotContains(t, message, "\"memoComment\"")
}

func execMigrationSQL(t *testing.T, db *sql.DB, query string) {
	t.Helper()
	_, err := db.Exec(query)
	require.NoError(t, err, "failed to execute SQL: %s", query)
}

func legacyInsertUserSQL(driver string, id int, username string) string {
	table := "user"
	switch driver {
	case "mysql":
		table = "`user`"
	case "postgres", "sqlite":
		table = `"user"`
	default:
		// Keep the unquoted fallback for unknown test drivers.
	}

	return fmt.Sprintf(
		"INSERT INTO %s (id, username, role, email, nickname, password_hash, avatar_url, description) VALUES (%d, '%s', 'USER', '%s@example.com', '%s', 'legacy-hash', '', 'legacy user')",
		table, id, username, username, username,
	)
}

func legacyInsertMemoSQL(id, creatorID int, uid, content string) string {
	payload := "{}"
	return fmt.Sprintf(
		"INSERT INTO memo (id, uid, creator_id, content, visibility, payload) VALUES (%d, '%s', %d, '%s', 'PRIVATE', '%s')",
		id, uid, creatorID, content, payload,
	)
}

func legacyInsertActivitySQL(id, creatorID int) string {
	payload := `{"memoComment":{"memoId":102,"relatedMemoId":101}}`
	return fmt.Sprintf(
		"INSERT INTO activity (id, creator_id, type, level, payload) VALUES (%d, %d, 'MEMO_COMMENT', 'INFO', '%s')",
		id, creatorID, payload,
	)
}

func legacyInsertInboxSQL(id, senderID, receiverID, activityID int) string {
	message := fmt.Sprintf(`{"type":"MEMO_COMMENT","activityId":%d}`, activityID)
	return fmt.Sprintf(
		"INSERT INTO inbox (id, sender_id, receiver_id, status, message) VALUES (%d, %d, %d, 'UNREAD', '%s')",
		id, senderID, receiverID, message,
	)
}

func legacyInsertIDPSQL(id int, name string) string {
	config := `{"clientId":"legacy-client","clientSecret":"legacy-secret","authUrl":"https://example.com/auth","tokenUrl":"https://example.com/token","userInfoUrl":"https://example.com/userinfo"}`
	return fmt.Sprintf(
		"INSERT INTO idp (id, name, type, identifier_filter, config) VALUES (%d, '%s', 'OAUTH2', '', '%s')",
		id, name, config,
	)
}

func countSystemSetting(ctx context.Context, db *sql.DB, name string) (int, error) {
	var count int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM system_setting WHERE name = ?", name).Scan(&count)
	if err == nil {
		return count, nil
	}

	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM system_setting WHERE name = $1", name).Scan(&count)
	return count, err
}

func tableExists(ctx context.Context, db *sql.DB, driver, table string) (bool, error) {
	switch driver {
	case "sqlite":
		var name string
		err := db.QueryRowContext(ctx, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table).Scan(&name)
		if err == sql.ErrNoRows {
			return false, nil
		}
		return err == nil, err
	case "mysql":
		var count int
		err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", table).Scan(&count)
		return count > 0, err
	case "postgres":
		var regclass sql.NullString
		err := db.QueryRowContext(ctx, "SELECT to_regclass($1)", "public."+table).Scan(&regclass)
		return regclass.Valid && strings.EqualFold(regclass.String, table), err
	default:
		return false, errors.Errorf("unsupported driver: %s", driver)
	}
}

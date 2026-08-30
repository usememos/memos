package test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/testutil/minio"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	storedb "github.com/usememos/memos/store/db"
)

type delayedInstanceSettingCreateDriver struct {
	store.Driver
	entered chan<- struct{}
	release <-chan struct{}
}

func (d *delayedInstanceSettingCreateDriver) CreateInstanceSettingIfNotExists(ctx context.Context, create *store.InstanceSetting) (bool, error) {
	d.entered <- struct{}{}
	<-d.release
	return d.Driver.CreateInstanceSettingIfNotExists(ctx, create)
}

func requireQueryError(ctx context.Context, t *testing.T, db *sql.DB, query, message string) {
	t.Helper()
	rows, err := db.QueryContext(ctx, query)
	if rows != nil {
		defer rows.Close()
		require.NoError(t, rows.Err())
	}
	require.Error(t, err, message)
}

// TestFreshInstall verifies that LATEST.sql applies correctly on a fresh database.
// This is essentially what NewTestingStore already does, but we make it explicit.
func TestFreshInstall(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	// NewTestingStore creates a fresh database and runs Migrate()
	// which applies LATEST.sql for uninitialized databases
	ts := NewTestingStore(ctx, t)

	// Verify migration completed successfully
	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.NotEmpty(t, currentSchemaVersion, "schema version should be set after fresh install")

	// Verify we can read instance settings (basic sanity check)
	instanceSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentSchemaVersion, instanceSetting.SchemaVersion)

	// The fresh schema supports memo-local Space placement without adding a
	// canonical thread shape. COMMENT remains an ordinary relation row.
	driver := getDriverFromEnv()
	insertSpace := "INSERT INTO space (id, uid, title, description) VALUES (?, ?, ?, ?)"
	insertMemo := "INSERT INTO memo (id, uid, creator_id, content, visibility, payload, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
	insertRelation := "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES (?, ?, ?)"
	if driver == "postgres" {
		insertSpace = "INSERT INTO space (id, uid, title, description) VALUES ($1, $2, $3, $4)"
		insertMemo = "INSERT INTO memo (id, uid, creator_id, content, visibility, payload, space_id) VALUES ($1, $2, $3, $4, $5, $6, $7)"
		insertRelation = "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES ($1, $2, $3)"
	}
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertSpace, 900001, "fresh-space", "Fresh Space", "schema fixture")
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertMemo, 900001, "fresh-context", 1, "context", store.Public, `{}`, nil)
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertMemo, 900002, "fresh-comment", 1, "comment", store.SpaceAudience, `{}`, 900001)
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertRelation, 900002, 900001, store.MemoRelationComment)
	require.NoError(t, err)

	var relationCount int
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM memo_relation WHERE memo_id = 900002 AND related_memo_id = 900001 AND type = 'COMMENT'",
	).Scan(&relationCount))
	require.Equal(t, 1, relationCount)

	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT parent_memo_id, root_memo_id FROM memo LIMIT 0", "fresh memo schema must not contain canonical-root columns")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT row_status FROM space LIMIT 0", "fresh Space schema has no archived state")
	if driver == "sqlite" {
		var indexName string
		require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_memo_creator_id'",
		).Scan(&indexName))
		require.Equal(t, "idx_memo_creator_id", indexName)
	}
}

// TestMigrationReRun verifies that re-running the migration on an already
// migrated database does not fail or cause issues. This simulates a
// scenario where the server is restarted.
func TestMigrationReRun(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	// Use the shared testing store which already runs migrations on init
	ts := NewTestingStore(ctx, t)

	// Get current version
	initialVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)

	// Manually trigger migration again
	err = ts.Migrate(ctx)
	require.NoError(t, err, "re-running migration should not fail")

	// Verify version hasn't changed (or at least is valid)
	finalVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, initialVersion, finalVersion, "version should match after re-run")
}

// TestMigrationWithData verifies that migration preserves data integrity.
// Creates data, then re-runs migration and verifies data is still accessible.
func TestMigrationWithData(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create a user and memo before re-running migration
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err, "should create user")

	originalMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "migration-data-test",
		CreatorID:  user.ID,
		Content:    "Data before migration re-run",
		Visibility: store.Public,
	})
	require.NoError(t, err, "should create memo")

	// Re-run migration
	err = ts.Migrate(ctx)
	require.NoError(t, err, "re-running migration should not fail")

	// Verify data is still accessible
	memo, err := ts.GetMemo(ctx, &store.FindMemo{UID: &originalMemo.UID})
	require.NoError(t, err, "should retrieve memo after migration")
	require.Equal(t, "Data before migration re-run", memo.Content, "memo content should be preserved")
}

func TestMigrationMultiSpacesPreservesMemosAndRelations(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	dsn := getTestingProfileForDriver(t, driver).DSN
	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSetting, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.31.3"})
	require.NoError(t, err)
	insertSetting := "INSERT INTO system_setting (name, value, description) VALUES (?, ?, '')"
	insertMemo := "INSERT INTO memo (id, uid, content, visibility, row_status, pinned, payload) VALUES (?, ?, ?, ?, ?, ?, ?)"
	insertRelation := "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES (?, ?, ?)"
	if driver == "postgres" {
		insertSetting = "INSERT INTO system_setting (name, value, description) VALUES ($1, $2, '')"
		insertMemo = "INSERT INTO memo (id, uid, content, visibility, row_status, pinned, payload) VALUES ($1, $2, $3, $4, $5, $6, $7)"
		insertRelation = "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES ($1, $2, $3)"
	}
	_, err = db.ExecContext(ctx, insertSetting, "BASIC", string(basicSetting))
	require.NoError(t, err)
	for _, memo := range []struct {
		id         int32
		uid        string
		visibility store.Visibility
		rowStatus  store.RowStatus
		pinned     bool
		payload    string
	}{
		{id: 1, uid: "legacy-root", visibility: store.Public, rowStatus: store.Normal, pinned: true, payload: `{"property":{"hasLink":true}}`},
		{id: 2, uid: "legacy-direct-comment", visibility: store.Public, rowStatus: store.Normal, payload: `{}`},
		{id: 3, uid: "legacy-nested-comment", visibility: store.Protected, rowStatus: store.Archived, payload: `{"property":{"hasTaskList":true}}`},
		{id: 4, uid: "legacy-reference-target", visibility: store.Private, rowStatus: store.Normal, payload: `{}`},
	} {
		_, err = db.ExecContext(ctx, insertMemo, memo.id, memo.uid, memo.uid, memo.visibility, memo.rowStatus, memo.pinned, memo.payload)
		require.NoError(t, err)
	}
	_, err = db.ExecContext(ctx, insertMemo, 100, "deleted-high-memo", "deleted", store.Private, store.Normal, false, `{}`)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, "DELETE FROM memo WHERE id = 100")
	require.NoError(t, err)
	if driver == "postgres" {
		_, err = db.ExecContext(ctx, "SELECT setval(pg_get_serial_sequence('memo', 'id'), 100, true)")
		require.NoError(t, err)
	}
	for _, relation := range []struct {
		memoID, relatedMemoID int32
		typeName              store.MemoRelationType
	}{
		{memoID: 2, relatedMemoID: 1, typeName: store.MemoRelationComment},
		{memoID: 3, relatedMemoID: 2, typeName: store.MemoRelationComment},
		{memoID: 1, relatedMemoID: 4, typeName: store.MemoRelationReference},
	} {
		_, err = db.ExecContext(ctx, insertRelation, relation.memoID, relation.relatedMemoID, relation.typeName)
		require.NoError(t, err)
	}
	if driver == "sqlite" {
		_, err = db.ExecContext(ctx, "CREATE INDEX idx_memo_creator_id ON memo(creator_id)")
		require.NoError(t, err)
	}
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	assertMemo := func(id int32, uid string, visibility store.Visibility, rowStatus store.RowStatus, pinned bool, payload string) {
		t.Helper()
		var gotUID, content string
		var gotVisibility store.Visibility
		var gotRowStatus store.RowStatus
		var gotPinned bool
		var gotPayload []byte
		var spaceID sql.NullInt64
		query := "SELECT uid, content, visibility, row_status, pinned, payload, space_id FROM memo WHERE id = ?"
		if driver == "postgres" {
			query = "SELECT uid, content, visibility, row_status, pinned, payload, space_id FROM memo WHERE id = $1"
		}
		require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, query, id).Scan(
			&gotUID, &content, &gotVisibility, &gotRowStatus, &gotPinned, &gotPayload, &spaceID,
		))
		require.Equal(t, uid, gotUID)
		require.Equal(t, uid, content)
		require.Equal(t, visibility, gotVisibility)
		require.Equal(t, rowStatus, gotRowStatus)
		require.Equal(t, pinned, gotPinned)
		require.JSONEq(t, payload, string(gotPayload))
		require.False(t, spaceID.Valid)
	}
	assertMemo(1, "legacy-root", store.Public, store.Normal, true, `{"property":{"hasLink":true}}`)
	assertMemo(2, "legacy-direct-comment", store.Public, store.Normal, false, `{}`)
	assertMemo(3, "legacy-nested-comment", store.Protected, store.Archived, false, `{"property":{"hasTaskList":true}}`)
	assertMemo(4, "legacy-reference-target", store.Private, store.Normal, false, `{}`)

	type relationRow struct {
		memoID, relatedMemoID int32
		typeName              store.MemoRelationType
	}
	rows, err := ts.GetDriver().GetDB().QueryContext(ctx, "SELECT memo_id, related_memo_id, type FROM memo_relation ORDER BY memo_id, related_memo_id, type")
	require.NoError(t, err)
	defer rows.Close()
	var relations []relationRow
	for rows.Next() {
		var relation relationRow
		require.NoError(t, rows.Scan(&relation.memoID, &relation.relatedMemoID, &relation.typeName))
		relations = append(relations, relation)
	}
	require.NoError(t, rows.Err())
	require.Equal(t, []relationRow{
		{memoID: 1, relatedMemoID: 4, typeName: store.MemoRelationReference},
		{memoID: 2, relatedMemoID: 1, typeName: store.MemoRelationComment},
		{memoID: 3, relatedMemoID: 2, typeName: store.MemoRelationComment},
	}, relations)

	insertNextMemo := "INSERT INTO memo (uid, creator_id, content, visibility, payload) VALUES (?, ?, ?, ?, ?)"
	if driver == "postgres" {
		var nextID int64
		err = ts.GetDriver().GetDB().QueryRowContext(ctx,
			"INSERT INTO memo (uid, creator_id, content, visibility, payload) VALUES ($1, $2, $3, $4, $5) RETURNING id",
			"after-migration", 0, "after", store.Private, `{}`,
		).Scan(&nextID)
		require.NoError(t, err)
		require.Equal(t, int64(101), nextID)
	} else {
		result, err := ts.GetDriver().GetDB().ExecContext(ctx, insertNextMemo, "after-migration", 0, "after", store.Private, `{}`)
		require.NoError(t, err)
		nextID, err := result.LastInsertId()
		require.NoError(t, err)
		require.Equal(t, int64(101), nextID)
	}

	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT parent_memo_id, root_memo_id FROM memo LIMIT 0", "memo-local schema must not add canonical-root columns")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT row_status FROM space LIMIT 0", "Space has no archived state")
	if driver == "sqlite" {
		var indexName string
		require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_memo_creator_id'",
		).Scan(&indexName))
		require.Equal(t, "idx_memo_creator_id", indexName, "memo rebuild must preserve the creator lookup index")
	}
}

func TestMigrationSpaceMemberStatusBackfillsActive(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{
		UID:   "status-migration-space",
		Title: "Status migration",
	}, owner.ID)
	require.NoError(t, err)

	db := ts.GetDriver().GetDB()
	_, err = db.ExecContext(ctx, "ALTER TABLE space_member DROP COLUMN status")
	require.NoError(t, err)

	basicSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	basicSetting.SchemaVersion = "0.31.4"
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: basicSetting},
	})
	require.NoError(t, err)

	require.NoError(t, ts.Migrate(ctx))

	query := "SELECT status FROM space_member WHERE space_id = ? AND user_id = ?"
	if getDriverFromEnv() == "postgres" {
		query = "SELECT status FROM space_member WHERE space_id = $1 AND user_id = $2"
	}
	var status store.SpaceMemberStatus
	require.NoError(t, db.QueryRowContext(ctx, query, space.ID, owner.ID).Scan(&status))
	require.Equal(t, store.SpaceMemberStatusActive, status)
}

// TestMigrationMultipleReRuns verifies that migration is idempotent
// even when run multiple times in succession.
func TestMigrationMultipleReRuns(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get initial version
	initialVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)

	// Run migration multiple times
	for i := 0; i < 3; i++ {
		err = ts.Migrate(ctx)
		require.NoError(t, err, "migration run %d should not fail", i+1)
	}

	// Verify version is still correct
	finalVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, initialVersion, finalVersion, "version should remain unchanged after multiple re-runs")
}

func TestConcurrentInstanceAccessInitializationKeepsFirstInsert(t *testing.T) {
	ctx := context.Background()
	driverName := getDriverFromEnv()
	baseProfile := getTestingProfileForDriver(t, driverName)

	baseDriver, err := storedb.NewDBDriver(baseProfile)
	require.NoError(t, err)
	baseStore := store.New(baseDriver, baseProfile)
	require.NoError(t, baseStore.Migrate(ctx))
	require.NoError(t, baseStore.DeleteInstanceSetting(ctx, &store.DeleteInstanceSetting{
		Name: storepb.InstanceSettingKey_ACCESS.String(),
	}))
	require.NoError(t, baseStore.Close())

	publicProfile := *baseProfile
	publicProfile.InstanceURL = "https://public.example.com"
	publicDriver, err := storedb.NewDBDriver(&publicProfile)
	require.NoError(t, err)
	entered := make(chan struct{}, 1)
	release := make(chan struct{})
	delayedPublicDriver := &delayedInstanceSettingCreateDriver{
		Driver:  publicDriver,
		entered: entered,
		release: release,
	}
	publicStore := store.New(delayedPublicDriver, &publicProfile)
	defer publicStore.Close()

	privateProfile := *baseProfile
	privateProfile.InstanceURL = ""
	privateDriver, err := storedb.NewDBDriver(&privateProfile)
	require.NoError(t, err)
	privateStore := store.New(privateDriver, &privateProfile)
	defer privateStore.Close()

	publicMigration := make(chan error, 1)
	go func() {
		publicMigration <- publicStore.Migrate(ctx)
	}()
	<-entered
	released := false
	defer func() {
		if !released {
			close(release)
		}
	}()

	// The private instance reaches the database first. The delayed public
	// initializer must lose the unique-key race without overwriting it.
	require.NoError(t, privateStore.Migrate(ctx))
	close(release)
	released = true
	require.NoError(t, <-publicMigration)

	setting, err := privateStore.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_ACCESS.String(),
	})
	require.NoError(t, err)
	require.NotNil(t, setting)
	require.Equal(t, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, setting.GetAccessSetting().AccessMode)

	// Re-running either initializer is also a no-op once ACCESS is persisted.
	require.NoError(t, publicStore.Migrate(ctx))
	setting, err = publicStore.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_ACCESS.String(),
	})
	require.NoError(t, err)
	require.Equal(t, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, setting.GetAccessSetting().AccessMode)
}

// TestMigrationStorageSetting verifies that the legacy singleton storage
// configuration is expanded into a named storage without removing fields used
// by older clients and rollback versions.
func TestMigrationStorageSetting(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()

	legacyDatabase, err := protojson.Marshal(&storepb.InstanceStorageSetting{
		StorageType: storepb.InstanceStorageSetting_DATABASE,
	})
	require.NoError(t, err)
	legacyLocal, err := protojson.Marshal(&storepb.InstanceStorageSetting{
		StorageType:      storepb.InstanceStorageSetting_LOCAL,
		FilepathTemplate: "assets/{filename}",
	})
	require.NoError(t, err)
	legacyS3, err := protojson.Marshal(&storepb.InstanceStorageSetting{
		StorageType: storepb.InstanceStorageSetting_S3,
		S3Config: &storepb.StorageS3Config{
			AccessKeyId:     "access-key",
			AccessKeySecret: "secret",
			Endpoint:        "https://s3.example.com",
			Region:          "us-east-1",
			Bucket:          "memos",
		},
	})
	require.NoError(t, err)
	alreadyNamed, err := protojson.Marshal(&storepb.InstanceStorageSetting{
		StorageType:      storepb.InstanceStorageSetting_S3,
		DefaultStorageId: "custom-s3",
		S3Config: &storepb.StorageS3Config{
			AccessKeyId:     "access-key",
			AccessKeySecret: "secret",
			Endpoint:        "https://s3.example.com",
			Region:          "us-east-1",
			Bucket:          "memos",
		},
		Storages: []*storepb.Storage{
			{
				Id:   "custom-s3",
				Name: "Primary",
				Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
					AccessKeyId:     "access-key",
					AccessKeySecret: "secret",
					Endpoint:        "https://s3.example.com",
					Region:          "us-east-1",
					Bucket:          "memos",
				}},
			},
		},
	})
	require.NoError(t, err)

	tests := []struct {
		name             string
		value            string
		wantStorageID    string
		wantStorageType  storepb.StorageType
		wantLegacyType   storepb.InstanceStorageSetting_StorageType
		wantName         string
		wantRawUnchanged bool
	}{
		{
			name:            "database",
			value:           string(legacyDatabase),
			wantStorageID:   "database",
			wantStorageType: storepb.StorageType_STORAGE_TYPE_DATABASE,
			wantLegacyType:  storepb.InstanceStorageSetting_DATABASE,
			wantName:        "Database",
		},
		{
			name:            "local",
			value:           string(legacyLocal),
			wantStorageID:   "local",
			wantStorageType: storepb.StorageType_STORAGE_TYPE_LOCAL,
			wantLegacyType:  storepb.InstanceStorageSetting_LOCAL,
			wantName:        "Local",
		},
		{
			name:            "s3",
			value:           string(legacyS3),
			wantStorageID:   "s3",
			wantStorageType: storepb.StorageType_STORAGE_TYPE_S3,
			wantLegacyType:  storepb.InstanceStorageSetting_S3,
			wantName:        "S3",
		},
		{
			name:            "already named",
			value:           string(alreadyNamed),
			wantStorageID:   "custom-s3",
			wantStorageType: storepb.StorageType_STORAGE_TYPE_S3,
			wantLegacyType:  storepb.InstanceStorageSetting_S3,
			wantName:        "Primary",
		},
		{
			name:             "invalid JSON",
			value:            `{oops}`,
			wantRawUnchanged: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			dsn := getTestingProfileForDriver(t, driver).DSN
			db, err := sql.Open(driver, dsn)
			require.NoError(t, err)
			_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
			require.NoError(t, err)

			basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.31.1"})
			require.NoError(t, err)
			insertSetting := "INSERT INTO system_setting (name, value, description) VALUES (?, ?, '')"
			if driver == "postgres" {
				insertSetting = "INSERT INTO system_setting (name, value, description) VALUES ($1, $2, '')"
			}
			_, err = db.ExecContext(ctx, insertSetting, "BASIC", string(basicSettingBytes))
			require.NoError(t, err)
			_, err = db.ExecContext(ctx, insertSetting, "STORAGE", test.value)
			require.NoError(t, err)
			if test.name == "s3" {
				insertStorageMigrationAttachments(ctx, t, db, driver)
			}
			require.NoError(t, db.Close())

			ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
			require.NoError(t, ts.Migrate(ctx))
			defer ts.Close()
			if test.wantRawUnchanged {
				query := "SELECT value FROM system_setting WHERE name = ?"
				if driver == "postgres" {
					query = "SELECT value FROM system_setting WHERE name = $1"
				}
				var raw string
				require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, query, "STORAGE").Scan(&raw))
				require.Equal(t, test.value, raw)
				return
			}

			stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_STORAGE.String()})
			require.NoError(t, err)
			require.NotNil(t, stored)
			setting := stored.GetStorageSetting()
			require.Equal(t, test.wantLegacyType, setting.GetStorageType(), "legacy storage type must be preserved")
			require.Equal(t, test.wantStorageID, setting.GetDefaultStorageId())
			require.Len(t, setting.GetStorages(), 1)
			require.Equal(t, test.wantStorageID, setting.GetStorages()[0].GetId())
			require.Equal(t, test.wantName, setting.GetStorages()[0].GetName())
			require.Equal(t, test.wantStorageType, setting.GetStorages()[0].GetType())
			if test.wantStorageType == storepb.StorageType_STORAGE_TYPE_S3 {
				require.Equal(t, "secret", setting.GetS3Config().GetAccessKeySecret(), "legacy S3 config must be preserved")
				require.Equal(t, "secret", setting.GetStorages()[0].GetS3Config().GetAccessKeySecret())
			}
			if test.name == "s3" {
				assertStorageMigrationAttachments(ctx, t, ts)
			}
		})
	}
}

func insertStorageMigrationAttachments(ctx context.Context, t *testing.T, db *sql.DB, driver string) {
	t.Helper()
	legacyPayload, err := protojson.Marshal(&storepb.AttachmentPayload{
		Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{Key: "legacy/no-config.txt"},
		},
	})
	require.NoError(t, err)
	embeddedPayload, err := protojson.Marshal(&storepb.AttachmentPayload{
		Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{
				Key: "legacy/embedded-config.txt",
				S3Config: &storepb.StorageS3Config{
					Endpoint: "https://old-s3.example.com",
					Region:   "us-east-1",
					Bucket:   "old-bucket",
				},
			},
		},
	})
	require.NoError(t, err)
	namedPayload, err := protojson.Marshal(&storepb.AttachmentPayload{
		Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{Key: "named/object.txt", StorageId: "existing-s3"},
		},
	})
	require.NoError(t, err)

	insertAttachment := "INSERT INTO attachment (uid, creator_id, filename, type, size, storage_type, reference, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
	if driver == "postgres" {
		insertAttachment = "INSERT INTO attachment (uid, creator_id, filename, type, size, storage_type, reference, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
	}
	for _, attachment := range []struct {
		uid     string
		payload []byte
	}{
		{uid: "legacy-s3-no-config", payload: legacyPayload},
		{uid: "legacy-s3-embedded-config", payload: embeddedPayload},
		{uid: "legacy-s3-existing-id", payload: namedPayload},
	} {
		_, err := db.ExecContext(ctx, insertAttachment, attachment.uid, 1, attachment.uid+".txt", "text/plain", 1, "S3", "", string(attachment.payload))
		require.NoError(t, err)
	}
}

func assertStorageMigrationAttachments(ctx context.Context, t *testing.T, ts *store.Store) {
	t.Helper()
	find := func(uid string) *storepb.AttachmentPayload_S3Object {
		query := "SELECT payload FROM attachment WHERE uid = ?"
		if getDriverFromEnv() == "postgres" {
			query = "SELECT payload FROM attachment WHERE uid = $1"
		}
		var rawPayload []byte
		err := ts.GetDriver().GetDB().QueryRowContext(ctx, query, uid).Scan(&rawPayload)
		require.NoError(t, err)
		payload := &storepb.AttachmentPayload{}
		require.NoError(t, protojson.Unmarshal(rawPayload, payload))
		require.NotNil(t, payload.GetS3Object())
		return payload.GetS3Object()
	}

	legacy := find("legacy-s3-no-config")
	require.Equal(t, "s3", legacy.GetStorageId())
	require.Nil(t, legacy.GetS3Config())

	embedded := find("legacy-s3-embedded-config")
	require.Empty(t, embedded.GetStorageId(), "embedded namespace must not be rebound to the current storage")
	require.Equal(t, "old-bucket", embedded.GetS3Config().GetBucket())

	named := find("legacy-s3-existing-id")
	require.Equal(t, "existing-s3", named.GetStorageId())
}

// TestMigrationReactionMemoID verifies that the reaction migration resolves
// legacy memo resource names to internal memo IDs and discards orphaned rows.
func TestMigrationReactionMemoID(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	dsn := getTestingProfileForDriver(t, driver).DSN

	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSetting, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.31.2"})
	require.NoError(t, err)
	insertSetting := "INSERT INTO system_setting (name, value, description) VALUES (?, ?, '')"
	insertMemo := "INSERT INTO memo (id, uid) VALUES (?, ?)"
	insertReaction := "INSERT INTO reaction (id, creator_id, content_id, reaction_type) VALUES (?, ?, ?, ?)"
	if driver == "postgres" {
		insertSetting = "INSERT INTO system_setting (name, value, description) VALUES ($1, $2, '')"
		insertMemo = "INSERT INTO memo (id, uid) VALUES ($1, $2)"
		insertReaction = "INSERT INTO reaction (id, creator_id, content_id, reaction_type) VALUES ($1, $2, $3, $4)"
	}
	_, err = db.ExecContext(ctx, insertSetting, "BASIC", string(basicSetting))
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, insertMemo, 42, "reaction-migration-target")
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, insertReaction, 100, 7, "memos/reaction-migration-target", "valid")
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, insertReaction, 101, 7, "memos/missing-target", "orphan")
	require.NoError(t, err)
	if driver == "postgres" {
		_, err = db.ExecContext(ctx, "SELECT setval(pg_get_serial_sequence('reaction', 'id'), 101, true)")
		require.NoError(t, err)
	}
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	var reactionID, creatorID, memoID int32
	var reactionType string
	err = ts.GetDriver().GetDB().QueryRowContext(
		ctx,
		"SELECT id, creator_id, memo_id, reaction_type FROM reaction",
	).Scan(&reactionID, &creatorID, &memoID, &reactionType)
	require.NoError(t, err)
	require.Equal(t, int32(100), reactionID)
	require.Equal(t, int32(7), creatorID)
	require.Equal(t, int32(42), memoID)
	require.Equal(t, "valid", reactionType)

	var reactionCount int
	err = ts.GetDriver().GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM reaction").Scan(&reactionCount)
	require.NoError(t, err)
	require.Equal(t, 1, reactionCount, "orphaned reactions must be discarded")

	insertNextReaction := "INSERT INTO reaction (creator_id, memo_id, reaction_type) VALUES (?, ?, ?)"
	findNextReaction := "SELECT id FROM reaction WHERE creator_id = ? AND memo_id = ? AND reaction_type = ?"
	if driver == "postgres" {
		insertNextReaction = "INSERT INTO reaction (creator_id, memo_id, reaction_type) VALUES ($1, $2, $3)"
		findNextReaction = "SELECT id FROM reaction WHERE creator_id = $1 AND memo_id = $2 AND reaction_type = $3"
	}
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertNextReaction, 8, 42, "after-migration")
	require.NoError(t, err)
	var nextReactionID int32
	err = ts.GetDriver().GetDB().QueryRowContext(ctx, findNextReaction, 8, 42, "after-migration").Scan(&nextReactionID)
	require.NoError(t, err)
	require.Equal(t, int32(102), nextReactionID)
}

// TestMigrationLegacyS3AttachmentMinIO verifies the storage upgrade path for an
// attachment created before storage IDs existed. The migration must bind the
// payload to the migrated registry entry, after which the production resolver
// and driver must read and delete it using the real S3 protocol.
func TestMigrationLegacyS3AttachmentMinIO(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	server := minio.New(t, "legacy-attachments")
	config := server.Config("legacy-attachments")
	content := []byte("attachment uploaded before named storage migration")
	const objectKey = "legacy/no-storage-id.txt"
	require.NoError(t, server.PutObject(config.Bucket, objectKey, "text/plain", content))

	storageSetting, err := protojson.Marshal(&storepb.InstanceStorageSetting{
		StorageType: storepb.InstanceStorageSetting_S3,
		S3Config:    config,
	})
	require.NoError(t, err)
	attachmentPayload, err := protojson.Marshal(&storepb.AttachmentPayload{
		Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{Key: objectKey},
		},
	})
	require.NoError(t, err)

	dsn := getTestingProfileForDriver(t, driver).DSN
	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSetting, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.31.1"})
	require.NoError(t, err)
	insertSetting := "INSERT INTO system_setting (name, value, description) VALUES (?, ?, '')"
	insertAttachment := "INSERT INTO attachment (uid, creator_id, filename, type, size, storage_type, reference, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
	if driver == "postgres" {
		insertSetting = "INSERT INTO system_setting (name, value, description) VALUES ($1, $2, '')"
		insertAttachment = "INSERT INTO attachment (uid, creator_id, filename, type, size, storage_type, reference, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
	}
	_, err = db.ExecContext(ctx, insertSetting, "BASIC", string(basicSetting))
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, insertSetting, "STORAGE", string(storageSetting))
	require.NoError(t, err)
	_, err = db.ExecContext(
		ctx,
		insertAttachment,
		"legacy-s3-minio",
		1,
		"legacy.txt",
		"text/plain",
		len(content),
		"S3",
		"",
		string(attachmentPayload),
	)
	require.NoError(t, err)
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	query := "SELECT payload FROM attachment WHERE uid = ?"
	if driver == "postgres" {
		query = "SELECT payload FROM attachment WHERE uid = $1"
	}
	var rawPayload []byte
	err = ts.GetDriver().GetDB().QueryRowContext(ctx, query, "legacy-s3-minio").Scan(&rawPayload)
	require.NoError(t, err)
	migratedPayload := &storepb.AttachmentPayload{}
	require.NoError(t, protojson.Unmarshal(rawPayload, migratedPayload))
	s3Object := migratedPayload.GetS3Object()
	require.NotNil(t, s3Object)
	require.Equal(t, "s3", s3Object.GetStorageId())
	require.Nil(t, s3Object.GetS3Config())

	storedSetting, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_STORAGE.String()})
	require.NoError(t, err)
	require.NotNil(t, storedSetting)
	storageDriver, err := ts.ResolveStorageDriver(ctx, storedSetting.GetStorageSetting(), s3Object.StorageId, s3Object.S3Config)
	require.NoError(t, err)
	downloaded, err := storageDriver.GetObject(ctx, s3Object.Key)
	require.NoError(t, err)
	require.Equal(t, content, downloaded)

	require.NoError(t, storageDriver.DeleteObject(ctx, s3Object.Key))
	_, err = server.GetObject(config.Bucket, objectKey)
	require.Error(t, err, "deleting the migrated attachment must remove its MinIO object")
}

// TestMigrationMemoViewSetting verifies the 0.31 rename of the SHORTCUTS user setting
// to MEMO_VIEWS on every driver, since each one rewrites the stored JSON with its own
// dialect-specific functions.
func TestMigrationMemoViewSetting(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	var dsn string
	switch driver {
	case "sqlite":
		dsn = fmt.Sprintf("%s/memos_memo_view_migration.db", t.TempDir())
	case "mysql":
		dsn = GetMySQLDSN(t)
	case "postgres":
		dsn = GetPostgresDSN(t)
	default:
		t.Fatalf("unsupported driver: %s", driver)
	}

	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.30.1"})
	require.NoError(t, err)
	insertBasicSetting := "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', ?, '')"
	if driver == "postgres" {
		insertBasicSetting = "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', $1, '')"
	}
	_, err = db.ExecContext(ctx, insertBasicSetting, string(basicSettingBytes))
	require.NoError(t, err)

	settingKeyColumn := "key"
	if driver == "mysql" {
		settingKeyColumn = "`key`"
	}
	// Bound rather than inlined: MySQL treats backslash as an escape character inside
	// string literals, so an inlined \" would collapse and corrupt the fixture's JSON.
	insertSetting := fmt.Sprintf("INSERT INTO user_setting (user_id, %[1]s, value) VALUES (?, ?, ?)", settingKeyColumn)
	if driver == "postgres" {
		insertSetting = fmt.Sprintf("INSERT INTO user_setting (user_id, %[1]s, value) VALUES ($1, $2, $3)", settingKeyColumn)
	}
	settingRows := []struct {
		userID int
		key    string
		value  string
	}{
		// A normal legacy row, must be renamed and rewritten.
		{1, "SHORTCUTS", `{"shortcuts":[{"id":"work","title":"shortcuts","filter":"tag in [\"work\"]"}]}`},
		// A corrupt value, must be left alone rather than aborting the upgrade.
		{2, "SHORTCUTS", `{oops}`},
		// Already has a MEMO_VIEWS row, must not trip UNIQUE(user_id, key).
		{3, "SHORTCUTS", `{"shortcuts":[{"id":"old","title":"old","filter":"tag in [\"old\"]"}]}`},
		{3, "MEMO_VIEWS", `{"memoViews":[{"id":"new","title":"new","filter":"tag in [\"new\"]"}]}`},
		{4, "SHORTCUTS", `"scalar"`},
		{5, "SHORTCUTS", `[]`},
		{6, "SHORTCUTS", `null`},
	}
	for _, row := range settingRows {
		_, err = db.ExecContext(ctx, insertSetting, row.userID, row.key, row.value)
		require.NoError(t, err)
	}
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	migratedUserID := int32(1)
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &migratedUserID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.NotNil(t, setting)
	require.Len(t, setting.GetMemoViews().GetMemoViews(), 1)
	require.Equal(t, "work", setting.GetMemoViews().GetMemoViews()[0].GetId())
	require.Equal(t, "shortcuts", setting.GetMemoViews().GetMemoViews()[0].GetTitle())
	require.Equal(t, `tag in ["work"]`, setting.GetMemoViews().GetMemoViews()[0].GetFilter())

	// Malformed object-like JSON must neither abort the migration nor be renamed.
	findCorruptSetting := fmt.Sprintf("SELECT value FROM user_setting WHERE user_id = ? AND %s = ?", settingKeyColumn)
	if driver == "postgres" {
		findCorruptSetting = fmt.Sprintf("SELECT value FROM user_setting WHERE user_id = $1 AND %s = $2", settingKeyColumn)
	}
	var corruptValue string
	err = ts.GetDriver().GetDB().QueryRowContext(ctx, findCorruptSetting, 2, "SHORTCUTS").Scan(&corruptValue)
	require.NoError(t, err)
	require.Equal(t, `{oops}`, corruptValue)
	for userID, rawValue := range map[int]string{4: `"scalar"`, 5: `[]`, 6: `null`} {
		var value string
		err = ts.GetDriver().GetDB().QueryRowContext(ctx, findCorruptSetting, userID, "SHORTCUTS").Scan(&value)
		require.NoError(t, err)
		require.Equal(t, rawValue, value)
	}

	// The pre-existing MEMO_VIEWS row wins; the legacy row is left behind untouched.
	conflictUserID := int32(3)
	conflicting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &conflictUserID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.NotNil(t, conflicting)
	require.Len(t, conflicting.GetMemoViews().GetMemoViews(), 1)
	require.Equal(t, "new", conflicting.GetMemoViews().GetMemoViews()[0].GetId())
}

// TestMigrationCopiesInstanceTagsToUserSettings verifies instance tag metadata is copied into user settings.
func TestMigrationCopiesInstanceTagsToUserSettings(t *testing.T) {
	if getDriverFromEnv() != "sqlite" {
		t.Skip("skipping focused migration fixture for non-sqlite driver")
	}

	ctx := context.Background()
	dsn := fmt.Sprintf("%s/memos_tag_migration.db", t.TempDir())

	db, err := sql.Open("sqlite", dsn)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, legacySchemaFixture("sqlite"))
	require.NoError(t, err)

	basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.29.1"})
	require.NoError(t, err)
	tagsSettingBytes, err := protojson.Marshal(&storepb.InstanceTagsSetting{
		Tags: map[string]*storepb.InstanceTagMetadata{
			"bug": {
				BackgroundColor: &colorpb.Color{Red: 0.9, Green: 0.1, Blue: 0.1},
			},
			"private/.*": {
				BlurContent: true,
			},
		},
	})
	require.NoError(t, err)
	existingUserTagsBytes, err := protojson.Marshal(&storepb.TagsUserSetting{
		Tags: map[string]*storepb.UserTagMetadata{
			"existing": {
				BlurContent: true,
			},
		},
	})
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, "INSERT INTO system_setting (name, value) VALUES ('BASIC', ?), ('TAGS', ?)", string(basicSettingBytes), string(tagsSettingBytes))
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, `
		INSERT INTO user (id, username, role, password_hash, avatar_url)
		VALUES (1, 'tag-owner', 'USER', 'legacy-hash', ''), (2, 'keeps-existing', 'USER', 'legacy-hash', '')
	`)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, "INSERT INTO user_setting (user_id, key, value) VALUES (2, 'TAGS', ?)", string(existingUserTagsBytes))
	require.NoError(t, err)
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, "sqlite", dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	copiedUserID := int32(1)
	copied, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &copiedUserID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.Contains(t, copied.GetTags().GetTags(), "bug")
	bugMetadata := copied.GetTags().GetTags()["bug"]
	require.NotNil(t, bugMetadata.GetBackgroundColor())
	require.InDelta(t, 0.9, bugMetadata.GetBackgroundColor().GetRed(), 1e-6)
	require.InDelta(t, 0.1, bugMetadata.GetBackgroundColor().GetGreen(), 1e-6)
	require.InDelta(t, 0.1, bugMetadata.GetBackgroundColor().GetBlue(), 1e-6)
	require.True(t, copied.GetTags().GetTags()["private/.*"].GetBlurContent())

	existingUserID := int32(2)
	existing, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &existingUserID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.Contains(t, existing.GetTags().GetTags(), "existing")
	require.NotContains(t, existing.GetTags().GetTags(), "bug")
}

// TestMigrationCaseSensitiveUsername is named to match the smoke workflow's
// -run 'TestMigration|...' filter so its per-driver assertions run on every driver.
func TestMigrationCaseSensitiveUsername(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	var dsn string
	switch driver {
	case "sqlite":
		dsn = fmt.Sprintf("%s/memos_username_migration.db", t.TempDir())
	case "mysql":
		dsn = GetMySQLDSN(t)
	case "postgres":
		dsn = GetPostgresDSN(t)
	default:
		t.Fatalf("unsupported driver: %s", driver)
	}

	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.30.1"})
	require.NoError(t, err)
	insertBasicSetting := "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', ?, '')"
	if driver == "postgres" {
		insertBasicSetting = "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', $1, '')"
	}
	_, err = db.ExecContext(ctx, insertBasicSetting, string(basicSettingBytes))
	require.NoError(t, err)
	insertUser := "INSERT INTO user (username, role, password_hash, avatar_url) VALUES ('Alice', 'USER', 'legacy-hash', '')"
	if driver == "mysql" {
		insertUser = "INSERT INTO `user` (username, role, password_hash, avatar_url) VALUES ('Alice', 'USER', 'legacy-hash', '')"
	} else if driver == "postgres" {
		insertUser = `INSERT INTO "user" (username, role, password_hash, avatar_url) VALUES ('Alice', 'USER', 'legacy-hash', '')`
	}
	_, err = db.ExecContext(ctx, insertUser)
	require.NoError(t, err)
	insertHighUser := "INSERT INTO user (id, username, role, password_hash, avatar_url) VALUES (100, 'deleted-high-user', 'USER', 'legacy-hash', '')"
	deleteHighUser := "DELETE FROM user WHERE id = 100"
	if driver == "mysql" {
		insertHighUser = "INSERT INTO `user` (id, username, role, password_hash, avatar_url) VALUES (100, 'deleted-high-user', 'USER', 'legacy-hash', '')"
		deleteHighUser = "DELETE FROM `user` WHERE id = 100"
	} else if driver == "postgres" {
		insertHighUser = `INSERT INTO "user" (id, username, role, password_hash, avatar_url) VALUES (100, 'deleted-high-user', 'USER', 'legacy-hash', '')`
		deleteHighUser = `DELETE FROM "user" WHERE id = 100`
	}
	_, err = db.ExecContext(ctx, insertHighUser)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, deleteHighUser)
	require.NoError(t, err)
	if driver == "postgres" {
		_, err = db.ExecContext(ctx, `SELECT setval(pg_get_serial_sequence('"user"', 'id'), 100, true)`)
		require.NoError(t, err)
	}
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	lower, err := createTestingUserWithRole(ctx, ts, "alice", store.RoleUser)
	require.NoError(t, err)
	require.Equal(t, int32(101), lower.ID)

	upperUsername := "Alice"
	upper, err := ts.GetUser(ctx, &store.FindUser{Username: &upperUsername})
	require.NoError(t, err)
	require.NotEqual(t, upper.ID, lower.ID)
	require.Equal(t, "Alice", upper.Username)
}

func legacySchemaFixture(driver string) string {
	switch driver {
	case "mysql":
		return `
			CREATE TABLE system_setting (
				name VARCHAR(256) NOT NULL PRIMARY KEY,
				value LONGTEXT NOT NULL,
				description TEXT NOT NULL
			);
			CREATE TABLE ` + "`user`" + ` (
				id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
				created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				row_status VARCHAR(256) NOT NULL DEFAULT 'NORMAL',
				username VARCHAR(256) NOT NULL UNIQUE,
				role VARCHAR(256) NOT NULL DEFAULT 'USER',
				email VARCHAR(256) NOT NULL DEFAULT '',
				nickname VARCHAR(256) NOT NULL DEFAULT '',
				password_hash VARCHAR(256) NOT NULL,
				avatar_url LONGTEXT NOT NULL,
				description VARCHAR(256) NOT NULL DEFAULT ''
			);
			CREATE TABLE user_setting (
				user_id INT NOT NULL,
				` + "`key`" + ` VARCHAR(256) NOT NULL,
				value LONGTEXT NOT NULL,
				UNIQUE(user_id, ` + "`key`" + `)
			);
			CREATE TABLE memo (
				id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
				uid VARCHAR(256) NOT NULL UNIQUE,
				creator_id INT NOT NULL DEFAULT 0,
				created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				row_status VARCHAR(256) NOT NULL DEFAULT 'NORMAL',
				content TEXT NOT NULL DEFAULT (''),
				visibility VARCHAR(256) NOT NULL DEFAULT 'PRIVATE',
				pinned BOOLEAN NOT NULL DEFAULT FALSE,
				payload JSON NOT NULL DEFAULT (JSON_OBJECT())
			);
			CREATE TABLE memo_relation (
				memo_id INT NOT NULL,
				related_memo_id INT NOT NULL,
				type VARCHAR(256) NOT NULL,
				UNIQUE(memo_id, related_memo_id, type)
			);
			CREATE TABLE reaction (
				id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
				created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				creator_id INT NOT NULL,
				content_id VARCHAR(256) NOT NULL,
				reaction_type VARCHAR(256) NOT NULL,
				UNIQUE(creator_id, content_id, reaction_type)
			);
			CREATE TABLE attachment (
				id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
				uid VARCHAR(256) NOT NULL UNIQUE,
				creator_id INT NOT NULL,
				created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				filename TEXT NOT NULL,
				type VARCHAR(256) NOT NULL DEFAULT '',
				size INT NOT NULL DEFAULT 0,
				memo_id INT DEFAULT NULL,
				storage_type VARCHAR(256) NOT NULL DEFAULT '',
				reference TEXT NOT NULL,
				payload TEXT NOT NULL
			);
		`
	case "postgres":
		return `
			CREATE TABLE system_setting (
				name TEXT NOT NULL PRIMARY KEY,
				value TEXT NOT NULL,
				description TEXT NOT NULL
			);
			CREATE TABLE "user" (
				id SERIAL PRIMARY KEY,
				created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				row_status TEXT NOT NULL DEFAULT 'NORMAL',
				username TEXT NOT NULL UNIQUE,
				role TEXT NOT NULL DEFAULT 'USER',
				email TEXT NOT NULL DEFAULT '',
				nickname TEXT NOT NULL DEFAULT '',
				password_hash TEXT NOT NULL,
				avatar_url TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT ''
			);
			CREATE TABLE user_setting (
				user_id INTEGER NOT NULL,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				UNIQUE(user_id, key)
			);
			CREATE TABLE memo (
				id SERIAL PRIMARY KEY,
				uid TEXT NOT NULL UNIQUE,
				creator_id INTEGER NOT NULL DEFAULT 0,
				created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				row_status TEXT NOT NULL DEFAULT 'NORMAL',
				content TEXT NOT NULL DEFAULT '',
				visibility TEXT NOT NULL DEFAULT 'PRIVATE',
				pinned BOOLEAN NOT NULL DEFAULT FALSE,
				payload JSONB NOT NULL DEFAULT '{}'
			);
			CREATE TABLE memo_relation (
				memo_id INTEGER NOT NULL,
				related_memo_id INTEGER NOT NULL,
				type TEXT NOT NULL,
				UNIQUE(memo_id, related_memo_id, type)
			);
			CREATE TABLE reaction (
				id SERIAL PRIMARY KEY,
				created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				creator_id INTEGER NOT NULL,
				content_id TEXT NOT NULL,
				reaction_type TEXT NOT NULL,
				UNIQUE(creator_id, content_id, reaction_type)
			);
			CREATE TABLE attachment (
				id SERIAL PRIMARY KEY,
				uid TEXT NOT NULL UNIQUE,
				creator_id INTEGER NOT NULL,
				created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				filename TEXT NOT NULL,
				blob BYTEA,
				type TEXT NOT NULL DEFAULT '',
				size INTEGER NOT NULL DEFAULT 0,
				memo_id INTEGER DEFAULT NULL,
				storage_type TEXT NOT NULL DEFAULT '',
				reference TEXT NOT NULL DEFAULT '',
				payload TEXT NOT NULL DEFAULT '{}'
			);
		`
	case "sqlite":
		return `
			CREATE TABLE system_setting (
				name TEXT NOT NULL,
				value TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				UNIQUE(name)
			);
			CREATE TABLE user (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
				username TEXT NOT NULL UNIQUE,
				role TEXT NOT NULL DEFAULT 'USER',
				email TEXT NOT NULL DEFAULT '',
				nickname TEXT NOT NULL DEFAULT '',
				password_hash TEXT NOT NULL,
				avatar_url TEXT NOT NULL DEFAULT '',
				description TEXT NOT NULL DEFAULT ''
			);
			CREATE TABLE user_setting (
				user_id INTEGER NOT NULL,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				UNIQUE(user_id, key)
			);
			CREATE TABLE memo (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				uid TEXT NOT NULL UNIQUE,
				creator_id INTEGER NOT NULL DEFAULT 0,
				created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
				content TEXT NOT NULL DEFAULT '',
				visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE')) DEFAULT 'PRIVATE',
				pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
				payload TEXT NOT NULL DEFAULT '{}'
			);
			CREATE TABLE memo_relation (
				memo_id INTEGER NOT NULL,
				related_memo_id INTEGER NOT NULL,
				type TEXT NOT NULL,
				UNIQUE(memo_id, related_memo_id, type)
			);
			CREATE TABLE reaction (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				creator_id INTEGER NOT NULL,
				content_id TEXT NOT NULL,
				reaction_type TEXT NOT NULL,
				UNIQUE(creator_id, content_id, reaction_type)
			);
			CREATE TABLE attachment (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				uid TEXT NOT NULL UNIQUE,
				creator_id INTEGER NOT NULL,
				created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				filename TEXT NOT NULL DEFAULT '',
				blob BLOB DEFAULT NULL,
				type TEXT NOT NULL DEFAULT '',
				size INTEGER NOT NULL DEFAULT 0,
				memo_id INTEGER,
				storage_type TEXT NOT NULL DEFAULT '',
				reference TEXT NOT NULL DEFAULT '',
				payload TEXT NOT NULL DEFAULT '{}'
			);
		`
	default:
		return ""
	}
}

// TestMigrationFromStableVersion verifies that upgrading from a stable Memos version
// to the current version works correctly. This is the critical upgrade path test.
//
// Test flow:
// 1. Start a stable Memos container to create a database with the old schema
// 2. Stop the container and wait for cleanup
// 3. Use the store directly to run migration with current code
// 4. Verify the migration succeeded and data can be written
//
// Note: This test is skipped when running with -race flag because testcontainers
// has known race conditions in its reaper code that are outside our control.
func TestMigrationFromStableVersion(t *testing.T) {
	// Skip for non-SQLite drivers (simplifies the test)
	if getDriverFromEnv() != "sqlite" {
		t.Skip("skipping upgrade test for non-sqlite driver")
	}

	skipIfContainerProviderUnavailable(t)

	ctx := context.Background()
	dataDir := t.TempDir()

	// 1. Start stable Memos container to create database with old schema
	cfg := MemosContainerConfig{
		Driver:  "sqlite",
		DataDir: dataDir,
		Version: StableMemosVersion,
	}

	t.Logf("Starting Memos %s container to create old-schema database...", cfg.Version)
	container, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start stable memos container")

	// Wait for the container to fully initialize the database
	time.Sleep(10 * time.Second)

	// Stop the container gracefully
	t.Log("Stopping stable Memos container...")
	err = container.Terminate(ctx)
	require.NoError(t, err, "failed to stop memos container")

	// Wait for file handles to be released
	time.Sleep(2 * time.Second)

	// 2. Connect to the database directly and run migration with current code
	dsn := fmt.Sprintf("%s/memos_prod.db", dataDir)
	t.Logf("Connecting to database at %s...", dsn)

	ts := NewTestingStoreWithDSN(ctx, t, "sqlite", dsn)

	// Get the schema version before migration
	oldSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	t.Logf("Old schema version: %s", oldSetting.SchemaVersion)

	// 3. Run migration with current code
	t.Log("Running migration with current code...")
	err = ts.Migrate(ctx)
	require.NoError(t, err, "migration from stable version should succeed")

	// 4. Verify migration succeeded
	newVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	t.Logf("New schema version: %s", newVersion)

	newSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, newVersion, newSetting.SchemaVersion, "schema version should be updated")

	// Verify we can write data to the migrated database
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err, "should create user after migration")

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "post-upgrade-memo",
		CreatorID:  user.ID,
		Content:    "Content after upgrade from stable",
		Visibility: store.Public,
	})
	require.NoError(t, err, "should create memo after migration")
	require.Equal(t, "Content after upgrade from stable", memo.Content)

	t.Logf("Migration successful: %s -> %s", oldSetting.SchemaVersion, newVersion)
}

package test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestUpgradeThroughBaselineRelease verifies the required intermediate upgrade
// using released binaries, including data transformations owned by v0.31.0.
func TestUpgradeThroughBaselineRelease(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping container-based upgrade test in short mode")
	}
	skipIfContainerProviderUnavailable(t)

	ctx := context.Background()
	driver := getDriverFromEnv()

	cfg, hostDSN := prepareUpgradeFixture(t, driver, PreBaselineMemosVersion)
	t.Logf("Starting Memos %s container for %s schema bootstrap...", cfg.Version, driver)
	container, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start memos %s container", PreBaselineMemosVersion)
	t.Cleanup(func() {
		if container != nil {
			_ = container.Terminate(ctx)
		}
	})

	legacyStore := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)
	require.Eventually(t, func() bool {
		setting, err := legacyStore.GetInstanceBasicSetting(ctx)
		return err == nil && setting != nil && setting.SchemaVersion != ""
	}, 45*time.Second, 500*time.Millisecond, "previous stable should initialize its schema")

	settingBeforeUpgrade, err := legacyStore.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	t.Logf("Schema version written by %s: %s", PreBaselineMemosVersion, settingBeforeUpgrade.SchemaVersion)

	require.NoError(t, container.Terminate(ctx), "failed to stop memos %s container", PreBaselineMemosVersion)
	container = nil
	require.NoError(t, legacyStore.Close())

	// Seed through the store API where the schema is shared by v0.30.0 and the
	// current build. The legacy SHORTCUTS rows predate the current proto, so
	// they are seeded with raw SQL exactly as the previous release stored them.
	seedStore := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)

	renamedUser, err := createTestingUserWithRole(ctx, seedStore, "legacyviews", store.RoleUser)
	require.NoError(t, err)
	keepsOwnUser, err := createTestingUserWithRole(ctx, seedStore, "keepsown", store.RoleUser)
	require.NoError(t, err)

	settingKeyColumn := "key"
	if driver == "mysql" {
		settingKeyColumn = "`key`"
	}
	// Bound rather than inlined: MySQL treats backslash as an escape character
	// inside string literals, so an inlined \" would collapse and corrupt the
	// seeded JSON.
	insertSetting := fmt.Sprintf("INSERT INTO user_setting (user_id, %[1]s, value) VALUES (?, ?, ?)", settingKeyColumn)
	if driver == "postgres" {
		insertSetting = fmt.Sprintf("INSERT INTO user_setting (user_id, %[1]s, value) VALUES ($1, $2, $3)", settingKeyColumn)
	}
	db := seedStore.GetDriver().GetDB()
	insertMemo := "INSERT INTO memo (uid, creator_id, content, payload) VALUES (?, ?, ?, '{}')"
	if driver == "postgres" {
		insertMemo = "INSERT INTO memo (uid, creator_id, content, payload) VALUES ($1, $2, $3, '{}')"
	}
	_, err = db.ExecContext(ctx, insertMemo, "before-baseline", renamedUser.ID, "memo from v0.30.0")
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, insertSetting, renamedUser.ID, "SHORTCUTS",
		`{"shortcuts":[{"id":"legacy","title":"legacy shortcut","filter":"tag in [\"legacy\"]"}]}`)
	require.NoError(t, err, "should seed a legacy SHORTCUTS setting")
	_, err = db.ExecContext(ctx, insertSetting, keepsOwnUser.ID, "SHORTCUTS",
		`{"shortcuts":[{"id":"stale","title":"stale","filter":"tag in [\"stale\"]"}]}`)
	require.NoError(t, err, "should seed a conflicting legacy SHORTCUTS setting")

	// One user already has a MEMO_VIEWS setting; the migration must not clobber it.
	_, err = seedStore.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: keepsOwnUser.ID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
		Value: &storepb.UserSetting_MemoViews{
			MemoViews: &storepb.MemoViewsUserSetting{
				MemoViews: []*storepb.MemoViewsUserSetting_MemoView{
					{Id: "own", Title: "own view", Filter: `tag in ["own"]`},
				},
			},
		},
	})
	require.NoError(t, err, "should seed a pre-existing MEMO_VIEWS setting")

	// The user whose setting should be renamed must not have one yet.
	preExisting, err := seedStore.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &renamedUser.ID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.Nil(t, preExisting, "the seeded user should not have a MEMO_VIEWS setting before the upgrade")

	// The current binary must refuse the old schema before modifying settings.
	before, err := seedStore.GetDriver().ListInstanceSettings(ctx, &store.FindInstanceSetting{})
	require.NoError(t, err)
	require.ErrorContains(t, seedStore.Migrate(ctx), "First upgrade to v0.31.0")
	after, err := seedStore.GetDriver().ListInstanceSettings(ctx, &store.FindInstanceSetting{})
	require.NoError(t, err)
	require.ElementsMatch(t, before, after)
	var preservedContent string
	require.NoError(t, db.QueryRowContext(ctx, "SELECT content FROM memo WHERE uid = 'before-baseline'").Scan(&preservedContent))
	require.Equal(t, "memo from v0.30.0", preservedContent)
	require.NoError(t, seedStore.Close())

	// Only the released intermediate binary carries the historical migrations.
	cfg.Version = "0.31.0"
	container, err = StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start the required intermediate release")
	require.NoError(t, container.Terminate(ctx))
	container = nil

	// Upgrade with current code.
	ts := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)
	defer ts.Close()
	baseline, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "0.31.8", baseline.SchemaVersion, "v0.31.0 must establish the fixed baseline")
	require.NoError(t, ts.Migrate(ctx), "upgrade from v0.31.0 should succeed for %s", driver)

	currentVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	upgradedSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentVersion, upgradedSetting.SchemaVersion, "schema version should advance")
	memoUID := "before-baseline"
	preservedMemo, err := ts.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, preservedMemo)
	require.Equal(t, "memo from v0.30.0", preservedMemo.Content)
	require.Equal(t, renamedUser.ID, preservedMemo.CreatorID)

	// The legacy SHORTCUTS setting is now readable as MEMO_VIEWS.
	renamed, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &renamedUser.ID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.NotNil(t, renamed, "legacy shortcuts should be renamed to memo views")
	require.Len(t, renamed.GetMemoViews().GetMemoViews(), 1)
	require.Equal(t, "legacy", renamed.GetMemoViews().GetMemoViews()[0].GetId())
	require.Equal(t, "legacy shortcut", renamed.GetMemoViews().GetMemoViews()[0].GetTitle())
	require.Equal(t, `tag in ["legacy"]`, renamed.GetMemoViews().GetMemoViews()[0].GetFilter())

	// The user with their own setting keeps it untouched.
	kept, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &keepsOwnUser.ID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.NotNil(t, kept)
	require.Len(t, kept.GetMemoViews().GetMemoViews(), 1)
	require.Equal(t, "own", kept.GetMemoViews().GetMemoViews()[0].GetId(), "existing memo views should not be overwritten")

	// Re-running the upgrade must stay a no-op, which is what a container
	// restart on an already-upgraded volume does.
	require.NoError(t, ts.Migrate(ctx), "re-running the upgrade should be idempotent")

	// The upgraded database must still accept writes.
	postUpgradeMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "post-stable-upgrade-memo",
		CreatorID:  renamedUser.ID,
		Content:    "created after upgrading from previous stable",
		Visibility: store.Private,
	})
	require.NoError(t, err)
	require.Equal(t, "created after upgrading from previous stable", postUpgradeMemo.Content)
}

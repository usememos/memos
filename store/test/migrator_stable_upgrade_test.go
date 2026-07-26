package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestUpgradeFromPreviousStableCopiesTagsToUserSettings covers the upgrade path
// users actually take: previous stable release to the current build, with data
// already in the database.
//
// The 0.30 tag migration is hand-written per driver with three different
// conflict forms (INSERT OR IGNORE, INSERT IGNORE, ON CONFLICT DO NOTHING) and
// different quoting of the reserved words "user" and "key". The existing
// fixture test for it only runs on SQLite, so this test drives the real
// previous-stable schema on whichever driver DRIVER selects.
func TestUpgradeFromPreviousStableCopiesTagsToUserSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping container-based upgrade test in short mode")
	}
	skipIfContainerProviderUnavailable(t)

	ctx := context.Background()
	driver := getDriverFromEnv()

	cfg, hostDSN := prepareUpgradeFixture(t, driver, StableMemosVersion)
	t.Logf("Starting Memos %s container for %s schema bootstrap...", cfg.Version, driver)
	container, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start memos %s container", StableMemosVersion)
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
	t.Logf("Schema version written by %s: %s", StableMemosVersion, settingBeforeUpgrade.SchemaVersion)

	require.NoError(t, container.Terminate(ctx), "failed to stop memos %s container", StableMemosVersion)
	container = nil

	// Seed through the store API. 0.29 shipped no migrations and 0.30 adds no
	// DDL, so current store code reads and writes the previous stable schema.
	seedStore := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)

	copiedUser, err := createTestingUserWithRole(ctx, seedStore, "tagcopy", store.RoleUser)
	require.NoError(t, err)
	keepsOwnUser, err := createTestingUserWithRole(ctx, seedStore, "keepsown", store.RoleUser)
	require.NoError(t, err)

	_, err = seedStore.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_TAGS,
		Value: &storepb.InstanceSetting_TagsSetting{
			TagsSetting: &storepb.InstanceTagsSetting{
				Tags: map[string]*storepb.InstanceTagMetadata{
					"bug": {
						BackgroundColor: &colorpb.Color{Red: 0.9, Green: 0.1, Blue: 0.1},
					},
					"private/.*": {
						BlurContent: true,
					},
				},
			},
		},
	})
	require.NoError(t, err, "should seed the instance-level TAGS setting")

	// One user already has their own TAGS setting; the migration must not clobber it.
	_, err = seedStore.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: keepsOwnUser.ID,
		Key:    storepb.UserSetting_TAGS,
		Value: &storepb.UserSetting_Tags{
			Tags: &storepb.TagsUserSetting{
				Tags: map[string]*storepb.UserTagMetadata{
					"existing": {BlurContent: true},
				},
			},
		},
	})
	require.NoError(t, err, "should seed a pre-existing user TAGS setting")

	// The user that should receive a copy must not have one yet.
	preExisting, err := seedStore.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &copiedUser.ID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.Nil(t, preExisting, "the seeded user should not have a TAGS setting before the upgrade")

	// Upgrade with current code.
	ts := NewTestingStoreWithDSN(ctx, t, driver, hostDSN)
	require.NoError(t, ts.Migrate(ctx), "upgrade from %s should succeed for %s", StableMemosVersion, driver)

	currentVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	upgradedSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentVersion, upgradedSetting.SchemaVersion, "schema version should advance")

	// The instance tags should now exist on the user that had none.
	copied, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &copiedUser.ID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.NotNil(t, copied, "instance tags should be copied to the user")
	require.Contains(t, copied.GetTags().GetTags(), "bug")
	bugMetadata := copied.GetTags().GetTags()["bug"]
	require.NotNil(t, bugMetadata.GetBackgroundColor())
	require.InDelta(t, 0.9, bugMetadata.GetBackgroundColor().GetRed(), 1e-6)
	require.InDelta(t, 0.1, bugMetadata.GetBackgroundColor().GetGreen(), 1e-6)
	require.InDelta(t, 0.1, bugMetadata.GetBackgroundColor().GetBlue(), 1e-6)
	require.True(t, copied.GetTags().GetTags()["private/.*"].GetBlurContent())

	// The user with their own setting keeps it untouched.
	kept, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &keepsOwnUser.ID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.NotNil(t, kept)
	require.Contains(t, kept.GetTags().GetTags(), "existing")
	require.NotContains(t, kept.GetTags().GetTags(), "bug", "existing user tags should not be overwritten")

	// Re-running the upgrade must stay a no-op, which is what a container
	// restart on an already-upgraded volume does.
	require.NoError(t, ts.Migrate(ctx), "re-running the upgrade should be idempotent")

	// The upgraded database must still accept writes.
	postUpgradeMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "post-stable-upgrade-memo",
		CreatorID:  copiedUser.ID,
		Content:    "created after upgrading from previous stable",
		Visibility: store.Private,
	})
	require.NoError(t, err)
	require.Equal(t, "created after upgrading from previous stable", postUpgradeMemo.Content)
}

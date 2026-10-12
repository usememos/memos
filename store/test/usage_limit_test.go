package test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/emptypb"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	storedb "github.com/usememos/memos/store/db"
)

func usageLimit(uid string, metric storepb.InstanceUsageLimitsSetting_Metric, userID int32, value int64) *storepb.InstanceUsageLimitsSetting_UsageLimit {
	limit := &storepb.InstanceUsageLimitsSetting_UsageLimit{
		Uid: uid, Metric: metric, Value: value,
		Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_AllUsers{AllUsers: &emptypb.Empty{}},
	}
	if userID != 0 {
		limit.Target = &storepb.InstanceUsageLimitsSetting_UsageLimit_UserId{UserId: userID}
	}
	return limit
}

func storedUsageLimitUIDs(ctx context.Context, t *testing.T, ts *store.Store) []string {
	t.Helper()
	setting, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	uids := []string{}
	for _, limit := range setting.Limits {
		uids = append(uids, limit.Uid)
	}
	return uids
}

func TestCountUserMemos(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "count-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	other, err := ts.CreateUser(ctx, &store.User{Username: "count-other", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	count, err := ts.CountUserMemos(ctx, owner.ID)
	require.NoError(t, err)
	require.Zero(t, count)

	root, err := ts.CreateMemo(ctx, &store.Memo{UID: "count-root", CreatorID: owner.ID, Content: "root", Visibility: store.Public})
	require.NoError(t, err)
	archived, err := ts.CreateMemo(ctx, &store.Memo{UID: "count-archived", CreatorID: owner.ID, Content: "archived", Visibility: store.Private})
	require.NoError(t, err)
	archivedStatus := store.Archived
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: archived.ID, RowStatus: &archivedStatus}))
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "count-space", Title: "Count"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateMemo(ctx, &store.Memo{UID: "count-space-memo", CreatorID: owner.ID, Content: "space", Visibility: store.SpaceAudience, SpaceID: &space.ID})
	require.NoError(t, err)
	_, err = ts.CreateMemoComment(ctx, &store.Memo{UID: "count-comment", CreatorID: owner.ID, Content: "comment", Visibility: store.Public}, root.ID, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateMemo(ctx, &store.Memo{UID: "count-other-memo", CreatorID: other.ID, Content: "other", Visibility: store.Public})
	require.NoError(t, err)

	count, err = ts.CountUserMemos(ctx, owner.ID)
	require.NoError(t, err)
	require.Equal(t, int64(4), count, "archived memos, Space memos, and comments count; other users' memos do not")

	require.NoError(t, ts.DeleteMemo(ctx, &store.DeleteMemo{ID: archived.ID}))
	count, err = ts.CountUserMemos(ctx, owner.ID)
	require.NoError(t, err)
	require.Equal(t, int64(3), count, "deleting a memo frees a slot")
}

func TestUpdateInstanceSettingIfUnchanged(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	driver := ts.GetDriver()

	updated, err := driver.UpdateInstanceSettingIfUnchanged(ctx, "CONDITIONAL_TEST", "", "first")
	require.NoError(t, err)
	require.False(t, updated, "a missing row is never updated")

	created, err := driver.CreateInstanceSettingIfNotExists(ctx, &store.InstanceSetting{Name: "CONDITIONAL_TEST", Value: "first"})
	require.NoError(t, err)
	require.True(t, created)

	updated, err = driver.UpdateInstanceSettingIfUnchanged(ctx, "CONDITIONAL_TEST", "stale", "second")
	require.NoError(t, err)
	require.False(t, updated, "a stale old value must not overwrite")
	updated, err = driver.UpdateInstanceSettingIfUnchanged(ctx, "CONDITIONAL_TEST", "FIRST", "second")
	require.NoError(t, err)
	require.False(t, updated, "the comparison is exact, including case")

	updated, err = driver.UpdateInstanceSettingIfUnchanged(ctx, "CONDITIONAL_TEST", "first", "second")
	require.NoError(t, err)
	require.True(t, updated)
	updated, err = driver.UpdateInstanceSettingIfUnchanged(ctx, "CONDITIONAL_TEST", "second", "second")
	require.NoError(t, err)
	require.True(t, updated, "writing the stored value again succeeds")

	settings, err := driver.ListInstanceSettings(ctx, &store.FindInstanceSetting{Name: "CONDITIONAL_TEST"})
	require.NoError(t, err)
	require.Len(t, settings, 1)
	require.Equal(t, "second", settings[0].Value)
}

func TestUsageLimitLifecycle(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	alice, err := ts.CreateUser(ctx, &store.User{Username: "limit-alice", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	setting, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Len(t, setting.Limits, 2)
	require.Equal(t, "default-upload", setting.Limits[0].Uid)
	require.Equal(t, store.DefaultUploadBytes, setting.Limits[0].Value)

	created, err := ts.CreateUsageLimit(ctx, usageLimit("default-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, 0, 1000))
	require.NoError(t, err)
	require.NotNil(t, created.CreateTime)
	require.Equal(t, created.CreateTime.AsTime(), created.UpdateTime.AsTime())
	_, err = ts.CreateUsageLimit(ctx, usageLimit("alice-storage", storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, alice.ID, 5<<30))
	require.NoError(t, err)
	require.Equal(t, []string{"default-upload", "default-memo-content", "default-memos", "alice-storage"}, storedUsageLimitUIDs(ctx, t, ts))

	_, err = ts.CreateUsageLimit(ctx, usageLimit("default-memos", storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, 0, 1))
	require.ErrorIs(t, err, store.ErrUsageLimitAlreadyExists, "IDs are unique")
	_, err = ts.CreateUsageLimit(ctx, usageLimit("other-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, 0, 1))
	require.ErrorIs(t, err, store.ErrUsageLimitAlreadyExists, "one default per metric")
	_, err = ts.CreateUsageLimit(ctx, usageLimit("alice-storage-2", storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, alice.ID, 1))
	require.ErrorIs(t, err, store.ErrUsageLimitAlreadyExists, "one limit per metric and user")
	_, err = ts.CreateUsageLimit(ctx, usageLimit("negative", storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES, alice.ID, -1))
	require.ErrorIs(t, err, store.ErrInvalidUsageLimit)
	_, err = ts.CreateUsageLimit(ctx, usageLimit("Bad_ID", storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES, alice.ID, 1))
	require.ErrorIs(t, err, store.ErrInvalidUsageLimit)
	_, err = ts.CreateUsageLimit(ctx, usageLimit("no-metric", storepb.InstanceUsageLimitsSetting_METRIC_UNSPECIFIED, 0, 1))
	require.ErrorIs(t, err, store.ErrInvalidUsageLimit)

	updated, err := ts.UpdateUsageLimit(ctx, "default-memos", 2000)
	require.NoError(t, err)
	require.Equal(t, int64(2000), updated.Value)
	require.False(t, updated.UpdateTime.AsTime().Before(updated.CreateTime.AsTime()))
	_, err = ts.UpdateUsageLimit(ctx, "missing", 1)
	require.ErrorIs(t, err, store.ErrUsageLimitNotFound)

	require.NoError(t, ts.DeleteUsageLimit(ctx, "alice-storage"))
	require.ErrorIs(t, ts.DeleteUsageLimit(ctx, "alice-storage"), store.ErrUsageLimitNotFound)
	require.Equal(t, []string{"default-upload", "default-memo-content", "default-memos"}, storedUsageLimitUIDs(ctx, t, ts))

	// The row is store only: the generic setting reads see it, but its key has
	// no API counterpart, and it round-trips through the raw conversion.
	stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.Equal(t, int64(2000), stored.GetUsageLimitsSetting().Limits[2].Value)
}

func TestUsageLimitDefaultSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	setting, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Len(t, setting.Limits, 2)
	require.Equal(t, storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES, setting.Limits[0].Metric)
	require.NotNil(t, setting.Limits[0].GetAllUsers())
	require.Equal(t, store.DefaultUploadBytes, setting.Limits[0].Value)
	require.Equal(t, store.DefaultMemoContentBytes, setting.Limits[1].Value)
	require.Equal(t, storepb.InstanceUsageLimitsSetting_MEMO_CONTENT_BYTES, setting.Limits[1].Metric)
	stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.Nil(t, stored, "reading defaults does not persist a setting")

	setting.Limits[0].Value = 1
	setting, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, store.DefaultUploadBytes, setting.Limits[0].Value, "each read returns fresh defaults")

	updated, err := ts.UpdateUsageLimit(ctx, "default-upload", 0)
	require.NoError(t, err)
	require.Zero(t, updated.Value)
	setting, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Zero(t, setting.Limits[0].Value, "an explicit zero remains unlimited")

	require.NoError(t, ts.DeleteUsageLimit(ctx, "default-upload"))
	require.NoError(t, ts.DeleteUsageLimit(ctx, "default-memo-content"))
	setting, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Empty(t, setting.Limits, "a stored empty setting does not restore defaults")
}

func TestUsageLimitCap(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	limits := make([]*storepb.InstanceUsageLimitsSetting_UsageLimit, 0, store.MaxUsageLimits)
	for i := range store.MaxUsageLimits {
		// Writes prune limits of missing users, so the cap is checked on the
		// validator that every write runs.
		limits = append(limits, usageLimit(fmt.Sprintf("limit-%d", i), storepb.InstanceUsageLimitsSetting_MEMO_COUNT, int32(i), 1))
	}
	require.NoError(t, store.ValidateInstanceUsageLimitsSetting(&storepb.InstanceUsageLimitsSetting{Limits: limits}))
	limits = append(limits, usageLimit("one-too-many", storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, 0, 1))
	require.ErrorIs(t, store.ValidateInstanceUsageLimitsSetting(&storepb.InstanceUsageLimitsSetting{Limits: limits}), store.ErrInvalidUsageLimit)
}

func TestUsageLimitTargetValidation(t *testing.T) {
	for name, target := range map[string]*storepb.InstanceUsageLimitsSetting_UsageLimit{
		"missing target": {Uid: "invalid-target", Metric: storepb.InstanceUsageLimitsSetting_MEMO_COUNT, Value: 1},
		"zero user": {Uid: "invalid-target", Metric: storepb.InstanceUsageLimitsSetting_MEMO_COUNT, Value: 1,
			Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_UserId{UserId: 0}},
		"negative user": usageLimit("invalid-target", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, -1, 1),
		"nil all users": {Uid: "invalid-target", Metric: storepb.InstanceUsageLimitsSetting_MEMO_COUNT, Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_AllUsers{}},
	} {
		t.Run(name, func(t *testing.T) {
			err := store.ValidateInstanceUsageLimitsSetting(&storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{target}})
			require.ErrorIs(t, err, store.ErrInvalidUsageLimit)
		})
	}
	for name, userID := range map[string]int32{"duplicate default": 0, "duplicate user": 7} {
		t.Run(name, func(t *testing.T) {
			err := store.ValidateInstanceUsageLimitsSetting(&storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
				usageLimit("first", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, userID, 1),
				usageLimit("second", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, userID, 0),
			}})
			require.ErrorIs(t, err, store.ErrUsageLimitAlreadyExists)
		})
	}
}

func TestUsageLimitsRejectMissingTarget(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	invalid := &storepb.InstanceUsageLimitsSetting_UsageLimit{Uid: "missing-target", Metric: storepb.InstanceUsageLimitsSetting_MEMO_COUNT, Value: 1}
	_, err := ts.CreateUsageLimit(ctx, invalid)
	require.ErrorIs(t, err, store.ErrInvalidUsageLimit)
	_, err = ts.GetDriver().UpsertInstanceSetting(ctx, &store.InstanceSetting{
		Name:  storepb.InstanceSettingKey_USAGE_LIMITS.String(),
		Value: `{"limits":[{"uid":"missing-target","metric":"MEMO_COUNT","value":"1"}]}`,
	})
	require.NoError(t, err)
	_, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.ErrorIs(t, err, store.ErrInvalidUsageLimit, "a missing target fails closed instead of removing a limit")
	_, err = ts.UpdateUsageLimit(ctx, "missing-target", 2)
	require.ErrorIs(t, err, store.ErrInvalidUsageLimit)
}

func TestDeleteUserRemovesUsageLimits(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	alice, err := ts.CreateUser(ctx, &store.User{Username: "delete-alice", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	bob, err := ts.CreateUser(ctx, &store.User{Username: "delete-bob", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	for _, limit := range []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		usageLimit("default-storage", storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, 0, 1<<30),
		usageLimit("alice-storage", storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, alice.ID, 5<<30),
		usageLimit("alice-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, alice.ID, 10),
		usageLimit("bob-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, bob.ID, 20),
	} {
		_, err := ts.CreateUsageLimit(ctx, limit)
		require.NoError(t, err)
	}

	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: alice.ID})
	require.NoError(t, err)
	require.Equal(t, []string{"default-upload", "default-memo-content", "default-storage", "bob-memos"}, storedUsageLimitUIDs(ctx, t, ts))
}

func TestUsageLimitWritesPruneMissingUsers(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	alice, err := ts.CreateUser(ctx, &store.User{Username: "prune-alice", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	// An entry for a user that no longer exists, as a failed cleanup would leave.
	_, err = ts.GetDriver().UpsertInstanceSetting(ctx, &store.InstanceSetting{
		Name:  storepb.InstanceSettingKey_USAGE_LIMITS.String(),
		Value: `{"limits":[{"uid":"ghost-memos","metric":"MEMO_COUNT","userId":99999,"value":"1"}]}`,
	})
	require.NoError(t, err)

	_, err = ts.CreateUsageLimit(ctx, usageLimit("alice-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, alice.ID, 5))
	require.NoError(t, err)
	require.Equal(t, []string{"alice-memos"}, storedUsageLimitUIDs(ctx, t, ts))
}

func TestUsageLimitsDeploymentFile(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	alice, err := ts.CreateUser(ctx, &store.User{Username: "alice", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	_, err = ts.CreateUsageLimit(ctx, usageLimit("stored-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, 0, 10))
	require.NoError(t, err)

	dir := t.TempDir()
	path := filepath.Join(dir, "memos-instance-setting-usage-limits.json")
	require.NoError(t, os.WriteFile(path, []byte(`{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[
		{"uid":"default-storage","metric":"STORAGE_BYTES","allUsers":{},"value":"1073741824"},
		{"uid":"alice-storage","metric":"STORAGE_BYTES","userId":`+fmt.Sprint(alice.ID)+`,"value":"5368709120"}
	]}}`), 0o600))
	require.NoError(t, ts.LoadDeploymentConfigurationDir(ctx, dir))

	require.Equal(t, []string{"default-storage", "alice-storage"}, storedUsageLimitUIDs(ctx, t, ts), "the file shadows the stored row")
	effective, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, effective.Limits[0].GetAllUsers())
	require.Equal(t, alice.ID, effective.Limits[1].GetUserId())
	_, err = ts.CreateUsageLimit(ctx, usageLimit("new-memos", storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES, 0, 1))
	require.ErrorIs(t, err, store.ErrUsageLimitsDeploymentConfigured)
	require.ErrorIs(t, ts.DeleteUsageLimit(ctx, "default-storage"), store.ErrUsageLimitsDeploymentConfigured)
	require.NoError(t, ts.DeleteUsageLimitsForUser(ctx, alice.ID), "user deletion cleanup skips file-provided limits")

	stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.Equal(t, "stored-memos", stored.GetUsageLimitsSetting().Limits[2].Uid, "the stored row is unchanged")

	for name, content := range map[string]string{
		"missing value":  `{"key":"USAGE_LIMITS"}`,
		"negative value": `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"uid":"bad","metric":"MEMO_COUNT","allUsers":{},"value":"-1"}]}}`,
		"duplicate pair": `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"uid":"a","metric":"MEMO_COUNT","allUsers":{},"value":"1"},{"uid":"b","metric":"MEMO_COUNT","allUsers":{},"value":"2"}]}}`,
		"unknown field":  `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"uid":"a","metric":"MEMO_COUNT","value":"1","plan":"pro"}]}}`,
	} {
		invalidDir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(invalidDir, "memos-instance-setting-usage-limits.json"), []byte(content), 0o600))
		require.Error(t, ts.LoadDeploymentConfigurationDir(ctx, invalidDir), name)
	}
}

// TestUsageLimitsAcrossReplicas runs two stores on one database, as two
// server replicas do. A change through one is read by the other at once, and
// concurrent writes never lose an update or break uniqueness.
func TestUsageLimitsAcrossReplicas(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	profile := getTestingProfileForDriver(t, getDriverFromEnv())
	openReplica := func() *store.Store {
		driver, err := storedb.NewDBDriver(profile)
		require.NoError(t, err)
		replica := store.New(driver, profile)
		t.Cleanup(func() { _ = replica.Close() })
		require.NoError(t, replica.Migrate(ctx))
		return replica
	}
	first := openReplica()
	second := openReplica()

	// Warm the second replica's settings cache; usage limit reads must bypass it.
	_, err := second.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	_, err = first.CreateUsageLimit(ctx, usageLimit("default-memos", storepb.InstanceUsageLimitsSetting_MEMO_COUNT, 0, 3))
	require.NoError(t, err)
	require.Equal(t, []string{"default-upload", "default-memo-content", "default-memos"}, storedUsageLimitUIDs(ctx, t, second))

	users := make([]*store.User, 6)
	for i := range users {
		users[i], err = first.CreateUser(ctx, &store.User{Username: fmt.Sprintf("replica-user-%d", i), Role: store.RoleUser, PasswordHash: "hash"})
		require.NoError(t, err)
	}

	// Concurrent creates for the same metric and user leave exactly one limit.
	var wg sync.WaitGroup
	var mu sync.Mutex
	succeeded := 0
	for i := range 6 {
		replica := first
		if i%2 == 1 {
			replica = second
		}
		wg.Go(func() {
			_, err := replica.CreateUsageLimit(ctx, usageLimit(fmt.Sprintf("same-target-%d", i), storepb.InstanceUsageLimitsSetting_STORAGE_BYTES, users[0].ID, int64(i+1)))
			if err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
				return
			}
			if !isExpectedUsageLimitRace(err) {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
	wg.Wait()
	require.Equal(t, 1, succeeded)

	// Concurrent creates for different users never lose an update: every
	// create that reports success is stored.
	created := []string{}
	for i, user := range users {
		replica := first
		if i%2 == 1 {
			replica = second
		}
		uid := fmt.Sprintf("memos-user-%d", i)
		wg.Go(func() {
			_, err := replica.CreateUsageLimit(ctx, usageLimit(uid, storepb.InstanceUsageLimitsSetting_MEMO_COUNT, user.ID, 5))
			if err == nil {
				mu.Lock()
				created = append(created, uid)
				mu.Unlock()
				return
			}
			if !isExpectedUsageLimitRace(err) {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
	wg.Wait()
	require.NotEmpty(t, created)
	stored := storedUsageLimitUIDs(ctx, t, first)
	for _, uid := range created {
		require.Contains(t, stored, uid)
	}
	require.Len(t, stored, 4+len(created))
}

// isExpectedUsageLimitRace reports the errors a losing concurrent writer may
// see: the pair is taken, or the retries ran out.
func isExpectedUsageLimitRace(err error) bool {
	return errors.Is(err, store.ErrUsageLimitAlreadyExists) || errors.Is(err, store.ErrUsageLimitWriteConflict)
}

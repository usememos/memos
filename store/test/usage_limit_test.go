package test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type usageLimitEntry = storepb.InstanceUsageLimitsSetting_UsageLimit

func usageLimitsSetting(limits ...*usageLimitEntry) *storepb.InstanceUsageLimitsSetting {
	return &storepb.InstanceUsageLimitsSetting{Limits: limits}
}

// writeUsageLimits stores limits through the generic instance setting write,
// which is the only write path the API has.
func writeUsageLimits(ctx context.Context, t *testing.T, ts *store.Store, limits ...*usageLimitEntry) {
	t.Helper()
	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_USAGE_LIMITS,
		Value: &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: usageLimitsSetting(limits...)},
	})
	require.NoError(t, err)
}

func storedUserIDs(ctx context.Context, t *testing.T, ts *store.Store) [][]int32 {
	t.Helper()
	setting, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	ids := [][]int32{}
	for _, limit := range setting.Limits {
		ids = append(ids, limit.UserIds)
	}
	return ids
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

func TestUsageLimitsDefaultSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	setting, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Len(t, setting.Limits, 1)
	require.True(t, setting.Limits[0].AllUsers)
	require.Equal(t, store.DefaultUploadBytes, setting.Limits[0].GetUploadBytes())
	require.Equal(t, store.DefaultMemoContentBytes, setting.Limits[0].GetMemoContentBytes())
	require.Nil(t, setting.Limits[0].MemoCount)
	require.Nil(t, setting.Limits[0].StorageBytes)
	stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.Nil(t, stored, "reading defaults does not persist a setting")

	*setting.Limits[0].UploadBytes = 1
	setting, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, store.DefaultUploadBytes, setting.Limits[0].GetUploadBytes(), "each read returns fresh defaults")

	writeUsageLimits(ctx, t, ts, &usageLimitEntry{AllUsers: true, UploadBytes: new(int64(0))})
	setting, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Len(t, setting.Limits, 1)
	require.Zero(t, setting.Limits[0].GetUploadBytes(), "an explicit zero is stored")
	require.Nil(t, setting.Limits[0].MemoContentBytes, "the stored list is the whole truth; built-in defaults do not come back")

	// The row round-trips through the generic setting reads too.
	stored, err = ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.True(t, proto.Equal(setting, stored.GetUsageLimitsSetting()))
}

func TestValidateInstanceUsageLimitsSetting(t *testing.T) {
	tooMany := make([]*usageLimitEntry, 0, store.MaxUsageLimitEntries+1)
	for i := range store.MaxUsageLimitEntries {
		tooMany = append(tooMany, &usageLimitEntry{UserIds: []int32{int32(i + 1)}})
	}
	tooMany = append(tooMany, &usageLimitEntry{AllUsers: true})
	tooManyUsers := make([]int32, 0, store.MaxUsageLimitUsers+1)
	for i := range store.MaxUsageLimitUsers + 1 {
		tooManyUsers = append(tooManyUsers, int32(i+1))
	}

	require.NoError(t, store.ValidateInstanceUsageLimitsSetting(usageLimitsSetting(
		&usageLimitEntry{UserIds: []int32{1, 2}, MemoCount: new(int64(0))},
		&usageLimitEntry{UserIds: []int32{2}, StorageBytes: new(int64(1))},
		&usageLimitEntry{AllUsers: true},
	)), "a user may appear in several entries; the first wins")
	require.NoError(t, store.ValidateInstanceUsageLimitsSetting(usageLimitsSetting(tooMany[1:]...)))

	for name, setting := range map[string]*storepb.InstanceUsageLimitsSetting{
		"nil":                      nil,
		"empty":                    usageLimitsSetting(),
		"no all-users entry":       usageLimitsSetting(&usageLimitEntry{UserIds: []int32{1}}),
		"all users not last":       usageLimitsSetting(&usageLimitEntry{AllUsers: true}, &usageLimitEntry{UserIds: []int32{1}}),
		"two all-users entries":    usageLimitsSetting(&usageLimitEntry{AllUsers: true}, &usageLimitEntry{AllUsers: true}),
		"users and all users":      usageLimitsSetting(&usageLimitEntry{AllUsers: true, UserIds: []int32{1}}),
		"entry without users":      usageLimitsSetting(&usageLimitEntry{}, &usageLimitEntry{AllUsers: true}),
		"nil entry":                usageLimitsSetting(nil, &usageLimitEntry{AllUsers: true}),
		"zero user ID":             usageLimitsSetting(&usageLimitEntry{UserIds: []int32{0}}, &usageLimitEntry{AllUsers: true}),
		"negative user ID":         usageLimitsSetting(&usageLimitEntry{UserIds: []int32{-1}}, &usageLimitEntry{AllUsers: true}),
		"repeated user in entry":   usageLimitsSetting(&usageLimitEntry{UserIds: []int32{1, 1}}, &usageLimitEntry{AllUsers: true}),
		"negative memo count":      usageLimitsSetting(&usageLimitEntry{AllUsers: true, MemoCount: new(int64(-1))}),
		"negative content bytes":   usageLimitsSetting(&usageLimitEntry{AllUsers: true, MemoContentBytes: new(int64(-1))}),
		"negative storage bytes":   usageLimitsSetting(&usageLimitEntry{AllUsers: true, StorageBytes: new(int64(-1))}),
		"negative upload bytes":    usageLimitsSetting(&usageLimitEntry{AllUsers: true, UploadBytes: new(int64(-1))}),
		"too many entries":         usageLimitsSetting(tooMany...),
		"too many users":           usageLimitsSetting(&usageLimitEntry{UserIds: tooManyUsers}, &usageLimitEntry{AllUsers: true}),
		"too many users in total":  usageLimitsSetting(&usageLimitEntry{UserIds: tooManyUsers[:600]}, &usageLimitEntry{UserIds: tooManyUsers[600:]}, &usageLimitEntry{AllUsers: true}),
		"all users with user list": usageLimitsSetting(&usageLimitEntry{UserIds: []int32{1}}, &usageLimitEntry{AllUsers: true, UserIds: []int32{2}}),
	} {
		t.Run(name, func(t *testing.T) {
			require.ErrorIs(t, store.ValidateInstanceUsageLimitsSetting(setting), store.ErrInvalidUsageLimits)
		})
	}
}

func TestUpsertInstanceSettingValidatesUsageLimits(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_USAGE_LIMITS,
		Value: &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: usageLimitsSetting(&usageLimitEntry{UserIds: []int32{1}})},
	})
	require.ErrorIs(t, err, store.ErrInvalidUsageLimits)
	stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.Nil(t, stored, "an invalid write stores nothing")

	// A row that became invalid outside the store fails closed instead of
	// silently removing every limit.
	_, err = ts.GetDriver().UpsertInstanceSetting(ctx, &store.InstanceSetting{
		Name:  storepb.InstanceSettingKey_USAGE_LIMITS.String(),
		Value: `{"limits":[{"userIds":[1],"memoCount":"1"}]}`,
	})
	require.NoError(t, err)
	_, err = ts.GetInstanceUsageLimitsSetting(ctx)
	require.ErrorIs(t, err, store.ErrInvalidUsageLimits)
}

func TestDeleteUserRemovesFromUsageLimits(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	alice, err := ts.CreateUser(ctx, &store.User{Username: "delete-alice", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	bob, err := ts.CreateUser(ctx, &store.User{Username: "delete-bob", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	writeUsageLimits(ctx, t, ts,
		&usageLimitEntry{UserIds: []int32{alice.ID, bob.ID}, StorageBytes: new(int64(5 << 30))},
		&usageLimitEntry{UserIds: []int32{alice.ID}, MemoCount: new(int64(10))},
		&usageLimitEntry{UserIds: []int32{bob.ID}, MemoCount: new(int64(20))},
		&usageLimitEntry{AllUsers: true, StorageBytes: new(int64(1 << 30))},
	)

	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: alice.ID})
	require.NoError(t, err)
	require.Equal(t, [][]int32{{bob.ID}, {bob.ID}, nil}, storedUserIDs(ctx, t, ts), "the user leaves shared entries and takes entries of their own with them")
	setting, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(5<<30), setting.Limits[0].GetStorageBytes())
	require.True(t, setting.Limits[2].AllUsers)

	require.NoError(t, ts.RemoveUserFromUsageLimits(ctx, 99999), "an unknown user is a no-op")
	require.Equal(t, [][]int32{{bob.ID}, {bob.ID}, nil}, storedUserIDs(ctx, t, ts))
}

func TestUsageLimitsDeploymentFile(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	alice, err := ts.CreateUser(ctx, &store.User{Username: "alice", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	writeUsageLimits(ctx, t, ts, &usageLimitEntry{AllUsers: true, MemoCount: new(int64(10))})

	dir := t.TempDir()
	path := filepath.Join(dir, "memos-instance-setting-usage-limits.json")
	require.NoError(t, os.WriteFile(path, []byte(`{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[
		{"userIds":[`+fmt.Sprint(alice.ID)+`],"storageBytes":"5368709120"},
		{"allUsers":true,"storageBytes":"1073741824"}
	]}}`), 0o600))
	require.NoError(t, ts.LoadDeploymentConfigurationDir(ctx, dir))

	effective, err := ts.GetInstanceUsageLimitsSetting(ctx)
	require.NoError(t, err)
	require.Len(t, effective.Limits, 2, "the file shadows the stored row")
	require.Equal(t, []int32{alice.ID}, effective.Limits[0].UserIds)
	require.Equal(t, int64(5<<30), effective.Limits[0].GetStorageBytes())
	require.True(t, effective.Limits[1].AllUsers)
	require.Nil(t, effective.Limits[1].MemoCount)
	require.True(t, ts.IsInstanceSettingDeploymentConfigured(storepb.InstanceSettingKey_USAGE_LIMITS))
	require.NoError(t, ts.RemoveUserFromUsageLimits(ctx, alice.ID), "user deletion cleanup skips file-provided limits")

	stored, err := ts.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_USAGE_LIMITS.String()})
	require.NoError(t, err)
	require.Equal(t, int64(10), stored.GetUsageLimitsSetting().Limits[0].GetMemoCount(), "the stored row is unchanged")

	for name, content := range map[string]string{
		"missing value":        `{"key":"USAGE_LIMITS"}`,
		"negative value":       `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"allUsers":true,"memoCount":"-1"}]}}`,
		"no all-users entry":   `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"userIds":[1],"memoCount":"1"}]}}`,
		"all users not last":   `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"allUsers":true},{"userIds":[1]}]}}`,
		"users and all users":  `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"allUsers":true,"userIds":[1]}]}}`,
		"user resource names":  `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"users":["users/alice"]},{"allUsers":true}]}}`,
		"unknown field":        `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"allUsers":true,"plan":"pro"}]}}`,
		"old per-metric shape": `{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"uid":"a","metric":"MEMO_COUNT","allUsers":{},"value":"1"}]}}`,
	} {
		invalidDir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(invalidDir, "memos-instance-setting-usage-limits.json"), []byte(content), 0o600))
		require.Error(t, ts.LoadDeploymentConfigurationDir(ctx, invalidDir), name)
		effective, err := ts.GetInstanceUsageLimitsSetting(ctx)
		require.NoError(t, err)
		require.Len(t, effective.Limits, 2, "an invalid reload preserves the active configuration: %s", name)
	}
}

package usagelimit

import (
	"context"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type fakeStore struct {
	setting     *storepb.InstanceUsageLimitsSetting
	memos       int64
	storage     int64
	countCalls  int
	sumCalls    int
	settingErr  error
	countingErr error
}

func (f *fakeStore) GetInstanceUsageLimitsSetting(context.Context) (*storepb.InstanceUsageLimitsSetting, error) {
	if f.settingErr != nil {
		return nil, f.settingErr
	}
	if f.setting == nil {
		return &storepb.InstanceUsageLimitsSetting{}, nil
	}
	return f.setting, nil
}

func (f *fakeStore) CountUserMemos(context.Context, int32) (int64, error) {
	f.countCalls++
	return f.memos, f.countingErr
}

func (f *fakeStore) GetAttachmentStorageUsage(context.Context, int32) (int64, error) {
	f.sumCalls++
	return f.storage, f.countingErr
}

type entry = storepb.InstanceUsageLimitsSetting_UsageLimit

func setting(limits ...*entry) *storepb.InstanceUsageLimitsSetting {
	return &storepb.InstanceUsageLimitsSetting{Limits: limits}
}

func TestResolve(t *testing.T) {
	const alice, bob, carol = int32(7), int32(8), int32(9)
	aliceEntry := &entry{UserIds: []int32{alice}, StorageBytes: new(int64(5 << 30)), MemoCount: new(int64(0))}
	pairEntry := &entry{UserIds: []int32{bob, alice}, StorageBytes: new(int64(2 << 30)), MemoCount: new(int64(10))}
	defaultEntry := &entry{AllUsers: true, StorageBytes: new(int64(1 << 30)), MemoCount: new(int64(1000)), UploadBytes: new(int64(10 << 20))}
	s := setting(aliceEntry, pairEntry, defaultEntry)

	got := Resolve(s, alice)
	require.Same(t, aliceEntry, got.Entry, "the first entry naming the user applies")
	require.Equal(t, 0, got.Index)
	require.Equal(t, int64(5<<30), got.Entry.GetStorageBytes())
	require.Zero(t, got.Entry.GetMemoCount(), "an explicit zero is unlimited")
	require.Zero(t, got.Entry.GetUploadBytes(), "an unset value is unlimited; nothing is inherited from later entries")

	got = Resolve(s, bob)
	require.Same(t, pairEntry, got.Entry)
	require.Equal(t, 1, got.Index)
	require.Equal(t, int64(10), got.Entry.GetMemoCount())

	got = Resolve(s, carol)
	require.Same(t, defaultEntry, got.Entry, "the all-users entry is the default")
	require.Equal(t, 2, got.Index)
	require.Equal(t, int64(10<<20), got.Entry.GetUploadBytes())

	got = Resolve(&storepb.InstanceUsageLimitsSetting{}, alice)
	require.Nil(t, got.Entry, "no entries means unlimited")
	require.Equal(t, -1, got.Index)
	require.Zero(t, got.Entry.GetStorageBytes(), "a nil entry reads as unlimited")
	require.Nil(t, Resolve(setting(nil, &entry{UserIds: []int32{bob}}), alice).Entry, "a nil entry is skipped")
}

func TestCheckMemoCreate(t *testing.T) {
	ctx := context.Background()

	unlimited := &fakeStore{memos: 1 << 20}
	require.NoError(t, CheckMemoCreate(ctx, unlimited, 1))
	require.Zero(t, unlimited.countCalls, "no count query runs without a memo limit")

	limited := &fakeStore{memos: 2, setting: setting(&entry{AllUsers: true, MemoCount: new(int64(3))})}
	require.NoError(t, CheckMemoCreate(ctx, limited, 1))
	limited.memos = 3
	require.Equal(t, &Refusal{Metric: MetricMemoCount, Limit: 3, Usage: 3, Index: 0}, AsRefusal(CheckMemoCreate(ctx, limited, 1)))

	limited.countingErr = errors.New("database down")
	err := CheckMemoCreate(ctx, limited, 1)
	require.Error(t, err)
	require.Nil(t, AsRefusal(err), "a failed count is an error, not a refusal")
}

func TestCheckUpload(t *testing.T) {
	ctx := context.Background()

	unlimited := &fakeStore{storage: 1 << 40}
	require.NoError(t, CheckUpload(ctx, unlimited, 1, 1<<40), "no limits means any file size")
	require.Zero(t, unlimited.sumCalls, "no sum query runs without a storage limit")

	s := &fakeStore{storage: 900, setting: setting(
		&entry{UserIds: []int32{2}, UploadBytes: new(int64(500))},
		&entry{AllUsers: true, StorageBytes: new(int64(1000)), UploadBytes: new(int64(200))},
	)}
	require.NoError(t, CheckUpload(ctx, s, 1, 100), "exactly at the storage limit is allowed")
	require.Equal(t, &Refusal{Metric: MetricStorageBytes, Limit: 1000, Usage: 900, Index: 1}, AsRefusal(CheckUpload(ctx, s, 1, 101)))
	require.Equal(t, &Refusal{Metric: MetricUploadBytes, Limit: 200, Usage: 201, Index: 1}, AsRefusal(CheckUpload(ctx, s, 1, 201)))

	// The user's own entry is the whole limit set: a higher per-file limit and
	// no storage limit at all.
	require.NoError(t, CheckUpload(ctx, s, 2, 500))
	require.Equal(t, &Refusal{Metric: MetricUploadBytes, Limit: 500, Usage: 501, Index: 0}, AsRefusal(CheckUpload(ctx, s, 2, 501)))
	s.sumCalls = 0
	require.NoError(t, CheckUpload(ctx, s, 2, 400))
	require.Zero(t, s.sumCalls, "no storage limit in the user's entry, so no sum query")
}

func TestCheckFileSize(t *testing.T) {
	ctx := context.Background()
	s := &fakeStore{storage: 1 << 40, setting: setting(&entry{AllUsers: true, StorageBytes: new(int64(1)), UploadBytes: new(int64(200))})}
	require.NoError(t, CheckFileSize(ctx, s, 1, 200), "the storage limit is not checked")
	require.Equal(t, &Refusal{Metric: MetricUploadBytes, Limit: 200, Usage: 201, Index: 0}, AsRefusal(CheckFileSize(ctx, s, 1, 201)))
	require.Zero(t, s.sumCalls, "no sum query runs for a per-file check")
}

func TestCheckMemoContentSize(t *testing.T) {
	ctx := context.Background()
	s := &fakeStore{setting: setting(
		&entry{UserIds: []int32{2}, MemoContentBytes: new(int64(6))},
		&entry{UserIds: []int32{3}, MemoContentBytes: new(int64(0))},
		&entry{AllUsers: true, MemoContentBytes: new(int64(8192))},
	)}
	require.NoError(t, CheckMemoContentSize(ctx, s, 1, 8192))
	require.Equal(t, &Refusal{Metric: MetricMemoContentBytes, Limit: 8192, Usage: 8193, Index: 2}, AsRefusal(CheckMemoContentSize(ctx, s, 1, 8193)))
	require.NoError(t, CheckMemoContentSize(ctx, s, 2, int64(len("中文"))))
	require.Equal(t, &Refusal{Metric: MetricMemoContentBytes, Limit: 6, Usage: 9, Index: 0}, AsRefusal(CheckMemoContentSize(ctx, s, 2, int64(len("中文字")))))
	require.NoError(t, CheckMemoContentSize(ctx, s, 3, 1<<20), "an explicit zero is unlimited")
	require.NoError(t, CheckMemoContentSize(ctx, &fakeStore{}, 1, 1<<20), "no entries means unlimited")
	require.Zero(t, s.countCalls)
	require.Zero(t, s.sumCalls)
	s.settingErr = errors.New("database down")
	require.Error(t, CheckMemoContentSize(ctx, s, 1, 1), "setting read failures do not bypass limits")
}

func TestUsageFor(t *testing.T) {
	ctx := context.Background()
	s := &fakeStore{memos: 4, storage: 99, setting: setting(&entry{AllUsers: true, MemoCount: new(int64(10))})}
	usage, err := UsageFor(ctx, s, 1)
	require.NoError(t, err)
	require.Equal(t, int64(4), usage.MemoCount)
	require.Equal(t, int64(99), usage.StorageBytes)
	require.Equal(t, 0, usage.Limits.Index)
	require.Equal(t, int64(10), usage.Limits.Entry.GetMemoCount())
}

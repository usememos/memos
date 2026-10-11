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

func limit(uid string, metric Metric, userID int32, value int64) *storepb.InstanceUsageLimitsSetting_UsageLimit {
	return &storepb.InstanceUsageLimitsSetting_UsageLimit{Uid: uid, Metric: metric, UserId: userID, Value: value}
}

func TestResolve(t *testing.T) {
	const alice, bob = int32(7), int32(8)
	setting := &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		// A user's limit listed before the default still wins.
		limit("alice-storage", MetricStorageBytes, alice, 5<<30),
		limit("default-storage", MetricStorageBytes, 0, 1<<30),
		limit("default-memos", MetricMemos, 0, 1000),
		limit("alice-memos", MetricMemos, alice, 0),
		limit("bob-upload", MetricUploadBytes, bob, 10<<20),
	}}

	require.Equal(t, Effective{
		Memos:        Limit{Value: 0, Source: "alice-memos"},
		StorageBytes: Limit{Value: 5 << 30, Source: "alice-storage"},
	}, Resolve(setting, alice), "a user's own limit, even unlimited, replaces the default")
	require.Equal(t, Effective{
		Memos:        Limit{Value: 1000, Source: "default-memos"},
		StorageBytes: Limit{Value: 1 << 30, Source: "default-storage"},
		UploadBytes:  Limit{Value: 10 << 20, Source: "bob-upload"},
	}, Resolve(setting, bob))
	require.Equal(t, Effective{}, Resolve(&storepb.InstanceUsageLimitsSetting{}, alice), "no limits means unlimited")
}

func TestCheckMemoCreate(t *testing.T) {
	ctx := context.Background()

	unlimited := &fakeStore{memos: 1 << 20}
	require.NoError(t, CheckMemoCreate(ctx, unlimited, 1))
	require.Zero(t, unlimited.countCalls, "no count query runs without a memo limit")

	limited := &fakeStore{memos: 2, setting: &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		limit("default-memos", MetricMemos, 0, 3),
	}}}
	require.NoError(t, CheckMemoCreate(ctx, limited, 1))
	limited.memos = 3
	refusal := AsRefusal(CheckMemoCreate(ctx, limited, 1))
	require.Equal(t, &Refusal{Metric: MetricMemos, Limit: 3, Usage: 3, Source: "default-memos"}, refusal)

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

	s := &fakeStore{storage: 900, setting: &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		limit("default-storage", MetricStorageBytes, 0, 1000),
		limit("default-upload", MetricUploadBytes, 0, 200),
		limit("alice-upload", MetricUploadBytes, 2, 500),
	}}}
	require.NoError(t, CheckUpload(ctx, s, 1, 100), "exactly at the storage limit is allowed")
	require.Equal(t, &Refusal{Metric: MetricStorageBytes, Limit: 1000, Usage: 900, Source: "default-storage"}, AsRefusal(CheckUpload(ctx, s, 1, 101)))
	require.Equal(t, &Refusal{Metric: MetricUploadBytes, Limit: 200, Usage: 201, Source: "default-upload"}, AsRefusal(CheckUpload(ctx, s, 1, 201)))

	// A user's own per-file limit replaces the default, even when it is higher.
	s.storage = 0
	require.NoError(t, CheckUpload(ctx, s, 2, 500))
	require.Equal(t, &Refusal{Metric: MetricUploadBytes, Limit: 500, Usage: 501, Source: "alice-upload"}, AsRefusal(CheckUpload(ctx, s, 2, 501)))
}

func TestCheckFileSize(t *testing.T) {
	ctx := context.Background()
	s := &fakeStore{storage: 1 << 40, setting: &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		limit("default-storage", MetricStorageBytes, 0, 1),
		limit("default-upload", MetricUploadBytes, 0, 200),
	}}}
	require.NoError(t, CheckFileSize(ctx, s, 1, 200), "the storage limit is not checked")
	require.Equal(t, &Refusal{Metric: MetricUploadBytes, Limit: 200, Usage: 201, Source: "default-upload"}, AsRefusal(CheckFileSize(ctx, s, 1, 201)))
	require.Zero(t, s.sumCalls, "no sum query runs for a per-file check")
}

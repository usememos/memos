package usagelimit

import (
	"context"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/emptypb"

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
	limit := &storepb.InstanceUsageLimitsSetting_UsageLimit{
		Uid: uid, Metric: metric, Value: value,
		Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_AllUsers{AllUsers: &emptypb.Empty{}},
	}
	if userID != 0 {
		limit.Target = &storepb.InstanceUsageLimitsSetting_UsageLimit_UserId{UserId: userID}
	}
	return limit
}

func TestResolve(t *testing.T) {
	const alice, bob = int32(7), int32(8)
	setting := &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		// A user's limit listed before the default still wins.
		limit("alice-storage", MetricStorageBytes, alice, 5<<30),
		limit("default-storage", MetricStorageBytes, 0, 1<<30),
		limit("default-memos", MetricMemoCount, 0, 1000),
		limit("alice-memos", MetricMemoCount, alice, 0),
		limit("bob-upload", MetricUploadBytes, bob, 10<<20),
	}}

	require.Equal(t, Effective{
		MemoCount:    Limit{Value: 0, Source: "alice-memos"},
		StorageBytes: Limit{Value: 5 << 30, Source: "alice-storage"},
	}, Resolve(setting, alice), "a user's own limit, even unlimited, replaces the default")
	require.Equal(t, Effective{
		MemoCount:    Limit{Value: 1000, Source: "default-memos"},
		StorageBytes: Limit{Value: 1 << 30, Source: "default-storage"},
		UploadBytes:  Limit{Value: 10 << 20, Source: "bob-upload"},
	}, Resolve(setting, bob))
	require.Equal(t, Effective{}, Resolve(&storepb.InstanceUsageLimitsSetting{}, alice), "no limits means unlimited")
	invalid := &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		{Uid: "missing-target", Metric: MetricMemoCount, Value: 1},
		{Uid: "zero-user", Metric: MetricStorageBytes, Value: 1, Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_UserId{UserId: 0}},
	}}
	require.Equal(t, Effective{}, Resolve(invalid, alice), "an absent target or user ID zero never becomes an all-users rule")
}

func TestCheckMemoCreate(t *testing.T) {
	ctx := context.Background()

	unlimited := &fakeStore{memos: 1 << 20}
	require.NoError(t, CheckMemoCreate(ctx, unlimited, 1))
	require.Zero(t, unlimited.countCalls, "no count query runs without a memo limit")

	limited := &fakeStore{memos: 2, setting: &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		limit("default-memos", MetricMemoCount, 0, 3),
	}}}
	require.NoError(t, CheckMemoCreate(ctx, limited, 1))
	limited.memos = 3
	refusal := AsRefusal(CheckMemoCreate(ctx, limited, 1))
	require.Equal(t, &Refusal{Metric: MetricMemoCount, Limit: 3, Usage: 3, Source: "default-memos"}, refusal)

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

func TestCheckMemoContentSize(t *testing.T) {
	ctx := context.Background()
	s := &fakeStore{setting: &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
		limit("default-content", MetricMemoContentBytes, 0, 8192),
		limit("alice-content", MetricMemoContentBytes, 2, 6),
		limit("bob-content", MetricMemoContentBytes, 3, 0),
	}}}
	require.NoError(t, CheckMemoContentSize(ctx, s, 1, 8192))
	require.Equal(t, &Refusal{Metric: MetricMemoContentBytes, Limit: 8192, Usage: 8193, Source: "default-content"}, AsRefusal(CheckMemoContentSize(ctx, s, 1, 8193)))
	require.NoError(t, CheckMemoContentSize(ctx, s, 2, int64(len("中文"))))
	require.Equal(t, &Refusal{Metric: MetricMemoContentBytes, Limit: 6, Usage: 9, Source: "alice-content"}, AsRefusal(CheckMemoContentSize(ctx, s, 2, int64(len("中文字")))))
	require.NoError(t, CheckMemoContentSize(ctx, s, 3, 1<<20), "a user's explicit zero overrides the default")
	require.NoError(t, CheckMemoContentSize(ctx, &fakeStore{}, 1, 1<<20), "no content limit means unlimited")
	require.Zero(t, s.countCalls)
	require.Zero(t, s.sumCalls)
	s.settingErr = errors.New("database down")
	require.Error(t, CheckMemoContentSize(ctx, s, 1, 1), "setting read failures do not bypass limits")
}

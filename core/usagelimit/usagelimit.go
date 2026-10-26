// Package usagelimit resolves the limit set that applies to a user and decides
// whether creating or editing a memo, or uploading a file, stays within it.
//
// The usage limits setting is an ordered list of entries. Each entry names the
// users it applies to, or applies to every user, and carries an optional limit
// per metric. The first entry that names a user is that user's limit set,
// whole; the last entry applies to every user and is the default. An unset
// limit is unlimited, as is 0. Usage is counted live on every check, so there
// are no stored counters that can drift; concurrent requests can therefore
// overshoot a limit by the number of requests in flight.
package usagelimit

import (
	"context"
	"fmt"
	"slices"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Metric is what a usage limit counts.
type Metric string

// The metrics a usage limit can set.
const (
	MetricMemoCount        Metric = "MEMO_COUNT"
	MetricMemoContentBytes Metric = "MEMO_CONTENT_BYTES"
	MetricStorageBytes     Metric = "STORAGE_BYTES"
	MetricUploadBytes      Metric = "UPLOAD_BYTES"
)

// Store is the data the checks read. *store.Store implements it.
type Store interface {
	GetInstanceUsageLimitsSetting(ctx context.Context) (*storepb.InstanceUsageLimitsSetting, error)
	CountUserMemos(ctx context.Context, creatorID int32) (int64, error)
	GetAttachmentStorageUsage(ctx context.Context, creatorID int32) (int64, error)
}

// Effective is the limit set in effect for one user.
type Effective struct {
	// Entry is the usage limits entry that applies, or nil when none does, in
	// which case every metric is unlimited. Its getters are nil-safe and return
	// 0, unlimited, for an unset value.
	Entry *storepb.InstanceUsageLimitsSetting_UsageLimit
	// Index is the position of Entry in the setting, or -1 when Entry is nil.
	Index int
}

// Resolve returns the limit set in effect for userID: the first entry that
// names the user, else the first entry for all users, else no entry.
func Resolve(setting *storepb.InstanceUsageLimitsSetting, userID int32) Effective {
	for i, limit := range setting.GetLimits() {
		if limit == nil {
			continue
		}
		if limit.AllUsers || slices.Contains(limit.UserIds, userID) {
			return Effective{Entry: limit, Index: i}
		}
	}
	return Effective{Index: -1}
}

// Refusal is returned when an action would exceed a usage limit.
type Refusal struct {
	Metric Metric
	// Limit is the value of the limit that applied.
	Limit int64
	// Usage is the current usage: the memo count, the stored bytes, or for
	// UPLOAD_BYTES the size of the refused file, or for MEMO_CONTENT_BYTES the
	// size of the refused memo content.
	Usage int64
	// Index is the position of the entry that applied in the setting.
	Index int
}

func (r *Refusal) Error() string {
	return fmt.Sprintf("usage limit exceeded: %s limit %d, usage %d (entry %d)", r.Metric, r.Limit, r.Usage, r.Index)
}

// AsRefusal returns the refusal in err's chain, or nil.
func AsRefusal(err error) *Refusal {
	var refusal *Refusal
	if errors.As(err, &refusal) {
		return refusal
	}
	return nil
}

// EffectiveFor reads the usage limits and resolves them for userID.
func EffectiveFor(ctx context.Context, s Store, userID int32) (Effective, error) {
	setting, err := s.GetInstanceUsageLimitsSetting(ctx)
	if err != nil {
		return Effective{}, err
	}
	return Resolve(setting, userID), nil
}

func (e Effective) refuse(metric Metric, limit, usage int64) error {
	return &Refusal{Metric: metric, Limit: limit, Usage: usage, Index: e.Index}
}

// CheckMemoCreate returns a *Refusal when userID has reached the memo limit.
// With no memo limit in effect it runs no count query.
func CheckMemoCreate(ctx context.Context, s Store, userID int32) error {
	effective, err := EffectiveFor(ctx, s, userID)
	if err != nil {
		return err
	}
	limit := effective.Entry.GetMemoCount()
	if limit <= 0 {
		return nil
	}
	count, err := s.CountUserMemos(ctx, userID)
	if err != nil {
		return errors.Wrap(err, "failed to count memos")
	}
	if count >= limit {
		return effective.refuse(MetricMemoCount, limit, count)
	}
	return nil
}

// CheckFileSize returns a *Refusal when a file of size bytes is larger than
// the per-file limit of userID. It runs no count or sum query.
func CheckFileSize(ctx context.Context, s Store, userID int32, size int64) error {
	effective, err := EffectiveFor(ctx, s, userID)
	if err != nil {
		return err
	}
	return effective.checkFileSize(size)
}

// CheckMemoContentSize returns a *Refusal when content of size bytes is larger
// than the per-memo content limit of userID. It runs no count or sum query.
func CheckMemoContentSize(ctx context.Context, s Store, userID int32, size int64) error {
	effective, err := EffectiveFor(ctx, s, userID)
	if err != nil {
		return err
	}
	if limit := effective.Entry.GetMemoContentBytes(); limit > 0 && size > limit {
		return effective.refuse(MetricMemoContentBytes, limit, size)
	}
	return nil
}

func (e Effective) checkFileSize(size int64) error {
	if limit := e.Entry.GetUploadBytes(); limit > 0 && size > limit {
		return e.refuse(MetricUploadBytes, limit, size)
	}
	return nil
}

// CheckUpload returns a *Refusal when storing a file of size bytes would break
// the per-file limit or the storage limit of userID. With no storage limit in
// effect it runs no sum query.
func CheckUpload(ctx context.Context, s Store, userID int32, size int64) error {
	effective, err := EffectiveFor(ctx, s, userID)
	if err != nil {
		return err
	}
	if err := effective.checkFileSize(size); err != nil {
		return err
	}
	limit := effective.Entry.GetStorageBytes()
	if limit <= 0 {
		return nil
	}
	used, err := s.GetAttachmentStorageUsage(ctx, userID)
	if err != nil {
		return errors.Wrap(err, "failed to sum storage usage")
	}
	if used+size > limit {
		return effective.refuse(MetricStorageBytes, limit, used)
	}
	return nil
}

// Usage is a user's usage and the limit set in effect for the user.
type Usage struct {
	MemoCount    int64
	StorageBytes int64
	Limits       Effective
}

// UsageFor counts userID's memos and stored bytes and resolves the limits.
func UsageFor(ctx context.Context, s Store, userID int32) (*Usage, error) {
	effective, err := EffectiveFor(ctx, s, userID)
	if err != nil {
		return nil, err
	}
	count, err := s.CountUserMemos(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to count memos")
	}
	used, err := s.GetAttachmentStorageUsage(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to sum storage usage")
	}
	return &Usage{MemoCount: count, StorageBytes: used, Limits: effective}, nil
}

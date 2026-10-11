// Package usagelimit resolves the usage limits that apply to a user and
// decides whether creating a memo or uploading a file stays within them.
//
// A usage limit sets one value for one metric, for every user (a default) or
// for one user. For each metric, the user's own limit applies if there is
// one, otherwise the default, otherwise the metric is unlimited. A value of 0
// is unlimited. Usage is counted live on every check, so there are no stored
// counters that can drift; concurrent requests can therefore overshoot a limit
// by the number of requests in flight.
package usagelimit

import (
	"context"
	"fmt"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Metric is what a usage limit counts.
type Metric = storepb.InstanceUsageLimitsSetting_Metric

// The metrics a usage limit can set.
const (
	MetricMemos        = storepb.InstanceUsageLimitsSetting_MEMOS
	MetricStorageBytes = storepb.InstanceUsageLimitsSetting_STORAGE_BYTES
	MetricUploadBytes  = storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES
)

// Store is the data the checks read. *store.Store implements it.
type Store interface {
	GetInstanceUsageLimitsSetting(ctx context.Context) (*storepb.InstanceUsageLimitsSetting, error)
	CountUserMemos(ctx context.Context, creatorID int32) (int64, error)
	GetAttachmentStorageUsage(ctx context.Context, creatorID int32) (int64, error)
}

// Limit is the limit in effect for one metric.
type Limit struct {
	// Value is the limit. 0 means unlimited.
	Value int64
	// Source is the ID of the usage limit the value comes from, or empty when
	// no usage limit applies.
	Source string
}

// Limited reports whether the limit restricts anything.
func (l Limit) Limited() bool {
	return l.Value > 0
}

// Effective is the limit in effect for each metric of one user.
type Effective struct {
	Memos        Limit
	StorageBytes Limit
	UploadBytes  Limit
}

// Resolve returns the limits in effect for userID: for each metric, the user's
// own limit, otherwise the default, otherwise unlimited.
func Resolve(setting *storepb.InstanceUsageLimitsSetting, userID int32) Effective {
	var effective Effective
	for _, limit := range setting.GetLimits() {
		if limit.UserId != 0 && limit.UserId != userID {
			continue
		}
		target := effective.get(limit.Metric)
		if target == nil {
			continue
		}
		// A user's own limit replaces the default, whatever the order.
		if limit.UserId == 0 && target.Source != "" {
			continue
		}
		*target = Limit{Value: limit.Value, Source: limit.Uid}
	}
	return effective
}

func (e *Effective) get(metric Metric) *Limit {
	switch metric {
	case MetricMemos:
		return &e.Memos
	case MetricStorageBytes:
		return &e.StorageBytes
	case MetricUploadBytes:
		return &e.UploadBytes
	default:
		return nil
	}
}

// Refusal is returned when an action would exceed a usage limit.
type Refusal struct {
	Metric Metric
	// Limit is the value of the usage limit that applied.
	Limit int64
	// Usage is the current usage: the memo count, the stored bytes, or for
	// UPLOAD_BYTES the size of the refused file.
	Usage int64
	// Source is the ID of the usage limit that applied.
	Source string
}

func (r *Refusal) Error() string {
	return fmt.Sprintf("usage limit %s exceeded: %s limit %d, usage %d", r.Source, r.Metric, r.Limit, r.Usage)
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

// CheckMemoCreate returns a *Refusal when userID has reached the memo limit.
// With no memo limit in effect it runs no count query.
func CheckMemoCreate(ctx context.Context, s Store, userID int32) error {
	effective, err := EffectiveFor(ctx, s, userID)
	if err != nil {
		return err
	}
	if !effective.Memos.Limited() {
		return nil
	}
	count, err := s.CountUserMemos(ctx, userID)
	if err != nil {
		return errors.Wrap(err, "failed to count memos")
	}
	if count >= effective.Memos.Value {
		return &Refusal{Metric: MetricMemos, Limit: effective.Memos.Value, Usage: count, Source: effective.Memos.Source}
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

func (e Effective) checkFileSize(size int64) error {
	if upload := e.UploadBytes; upload.Limited() && size > upload.Value {
		return &Refusal{Metric: MetricUploadBytes, Limit: upload.Value, Usage: size, Source: upload.Source}
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
	if !effective.StorageBytes.Limited() {
		return nil
	}
	used, err := s.GetAttachmentStorageUsage(ctx, userID)
	if err != nil {
		return errors.Wrap(err, "failed to sum storage usage")
	}
	if used+size > effective.StorageBytes.Value {
		return &Refusal{Metric: MetricStorageBytes, Limit: effective.StorageBytes.Value, Usage: used, Source: effective.StorageBytes.Source}
	}
	return nil
}

// Usage is a user's usage and the limits in effect for the user.
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

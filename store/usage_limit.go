package store

import (
	"context"
	"log/slog"
	"regexp"
	"slices"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// MaxUsageLimits is the most usage limits an instance can hold. All limits
// share one system_setting row, so the cap also bounds that row's size.
const MaxUsageLimits = 1000

// DefaultUploadBytes is the default per-file upload limit in bytes. 32 MiB.
const DefaultUploadBytes int64 = 32 << 20

// DefaultMemoContentBytes is the default per-memo content limit in bytes. 8 KiB.
const DefaultMemoContentBytes int64 = 8 << 10

func newDefaultInstanceUsageLimitsSetting() *storepb.InstanceUsageLimitsSetting {
	return &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{{
		Uid: "default-upload", Metric: storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES, Value: DefaultUploadBytes,
		Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_AllUsers{AllUsers: &emptypb.Empty{}},
	}, {
		Uid: "default-memo-content", Metric: storepb.InstanceUsageLimitsSetting_MEMO_CONTENT_BYTES, Value: DefaultMemoContentBytes,
		Target: &storepb.InstanceUsageLimitsSetting_UsageLimit_AllUsers{AllUsers: &emptypb.Empty{}},
	}}}
}

// usageLimitWriteAttempts bounds the read, modify, and conditional write cycle
// when other writers keep changing the usage limits row.
const usageLimitWriteAttempts = 5

// UsageLimitUIDMatcher matches a usage limit ID: lowercase kebab case that
// starts with a letter, at most 32 characters.
var UsageLimitUIDMatcher = regexp.MustCompile(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`)

const maxUsageLimitUIDLength = 32

var (
	// ErrUsageLimitNotFound indicates that no usage limit has the given ID.
	ErrUsageLimitNotFound = errors.New("usage limit not found")
	// ErrUsageLimitAlreadyExists indicates that the ID, or the metric and user
	// pair, is already taken by another usage limit.
	ErrUsageLimitAlreadyExists = errors.New("usage limit already exists")
	// ErrUsageLimitsDeploymentConfigured indicates that the usage limits come
	// from a deployment file and cannot be changed at runtime.
	ErrUsageLimitsDeploymentConfigured = errors.New("usage limits are configured by the deployment")
	// ErrUsageLimitWriteConflict indicates that other writers changed the usage
	// limits on every attempt.
	ErrUsageLimitWriteConflict = errors.New("usage limits changed concurrently; retry")
	// ErrInvalidUsageLimit indicates a usage limit that breaks a validation rule.
	ErrInvalidUsageLimit = errors.New("invalid usage limit")
)

// ValidateInstanceUsageLimitsSetting checks the rules every stored list of
// usage limits meets, whether it comes from the API or from a deployment file:
// at most MaxUsageLimits entries, valid and unique IDs, known metrics,
// non-negative values, an explicit all-users target or a positive user ID,
// and at most one limit per metric and target.
func ValidateInstanceUsageLimitsSetting(setting *storepb.InstanceUsageLimitsSetting) error {
	limits := setting.GetLimits()
	if len(limits) > MaxUsageLimits {
		return errors.Wrapf(ErrInvalidUsageLimit, "at most %d usage limits are allowed", MaxUsageLimits)
	}
	type target struct {
		metric storepb.InstanceUsageLimitsSetting_Metric
		userID int32
	}
	uids := make(map[string]struct{}, len(limits))
	targets := make(map[target]struct{}, len(limits))
	for i, limit := range limits {
		if limit == nil {
			return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d] must not be null", i)
		}
		if len(limit.Uid) > maxUsageLimitUIDLength || !UsageLimitUIDMatcher.MatchString(limit.Uid) {
			return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d].uid %q must be lowercase kebab case, start with a letter, and have at most %d characters", i, limit.Uid, maxUsageLimitUIDLength)
		}
		if !IsValidUsageLimitMetric(limit.Metric) {
			return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d].metric must be MEMO_COUNT, STORAGE_BYTES, UPLOAD_BYTES, or MEMO_CONTENT_BYTES", i)
		}
		switch target := limit.Target.(type) {
		case *storepb.InstanceUsageLimitsSetting_UsageLimit_AllUsers:
			if target == nil || target.AllUsers == nil {
				return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d].allUsers must be populated", i)
			}
		case *storepb.InstanceUsageLimitsSetting_UsageLimit_UserId:
			if target == nil || target.UserId <= 0 {
				return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d].userId must be positive", i)
			}
		default:
			return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d].target must be allUsers or userId", i)
		}
		if limit.Value < 0 {
			return errors.Wrapf(ErrInvalidUsageLimit, "limits[%d].value must not be negative", i)
		}
		if _, ok := uids[limit.Uid]; ok {
			return errors.Wrapf(ErrUsageLimitAlreadyExists, "usage limit ID %q is used more than once", limit.Uid)
		}
		uids[limit.Uid] = struct{}{}
		key := target{metric: limit.Metric, userID: limit.GetUserId()}
		if _, ok := targets[key]; ok {
			return errors.Wrapf(ErrUsageLimitAlreadyExists, "more than one %s limit for user ID %d", limit.Metric, limit.GetUserId())
		}
		targets[key] = struct{}{}
	}
	return nil
}

// IsValidUsageLimitMetric reports whether metric is one that limits can be set for.
func IsValidUsageLimitMetric(metric storepb.InstanceUsageLimitsSetting_Metric) bool {
	switch metric {
	case storepb.InstanceUsageLimitsSetting_MEMO_COUNT,
		storepb.InstanceUsageLimitsSetting_STORAGE_BYTES,
		storepb.InstanceUsageLimitsSetting_UPLOAD_BYTES,
		storepb.InstanceUsageLimitsSetting_MEMO_CONTENT_BYTES:
		return true
	default:
		return false
	}
}

// GetInstanceUsageLimitsSetting returns every usage limit. A deployment file
// takes precedence over the database. The database row is read directly,
// without the instance setting cache, so a change made through any replica
// applies at the next check on every replica. An absent setting defaults to
// a 32 MiB per-file limit and an 8 KiB per-memo content limit. Existing settings,
// including empty lists, are preserved.
func (s *Store) GetInstanceUsageLimitsSetting(ctx context.Context) (*storepb.InstanceUsageLimitsSetting, error) {
	instanceSetting := s.getDeploymentInstanceSetting(storepb.InstanceSettingKey_USAGE_LIMITS)
	if instanceSetting == nil {
		var err error
		instanceSetting, err = s.getRawInstanceSetting(ctx, storepb.InstanceSettingKey_USAGE_LIMITS.String())
		if err != nil {
			return nil, errors.Wrap(err, "failed to get usage limits setting")
		}
	}
	if setting := instanceSetting.GetUsageLimitsSetting(); setting != nil {
		if err := ValidateInstanceUsageLimitsSetting(setting); err != nil {
			return nil, errors.Wrap(err, "invalid usage limits setting")
		}
		return setting, nil
	}
	return newDefaultInstanceUsageLimitsSetting(), nil
}

// CreateUsageLimit adds a usage limit. create.Uid, Metric, Target, and Value
// must be set; the create and update times are set here.
func (s *Store) CreateUsageLimit(ctx context.Context, create *storepb.InstanceUsageLimitsSetting_UsageLimit) (*storepb.InstanceUsageLimitsSetting_UsageLimit, error) {
	if err := ValidateInstanceUsageLimitsSetting(&storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{create}}); err != nil {
		return nil, err
	}
	var created *storepb.InstanceUsageLimitsSetting_UsageLimit
	err := s.mutateUsageLimits(ctx, func(limits []*storepb.InstanceUsageLimitsSetting_UsageLimit) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, bool, error) {
		for _, limit := range limits {
			if limit.Uid == create.Uid {
				return nil, false, errors.Wrapf(ErrUsageLimitAlreadyExists, "usage limit ID %q already exists", create.Uid)
			}
			if limit.Metric == create.Metric && limit.GetUserId() == create.GetUserId() {
				return nil, false, errors.Wrapf(ErrUsageLimitAlreadyExists, "usage limit %q already sets %s for this user", limit.Uid, limit.Metric)
			}
		}
		now := timestamppb.Now()
		created = proto.CloneOf(create)
		created.CreateTime = now
		created.UpdateTime = now
		return append(limits, created), true, nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

// UpdateUsageLimit sets the value of the usage limit uid.
func (s *Store) UpdateUsageLimit(ctx context.Context, uid string, value int64) (*storepb.InstanceUsageLimitsSetting_UsageLimit, error) {
	var updated *storepb.InstanceUsageLimitsSetting_UsageLimit
	err := s.mutateUsageLimits(ctx, func(limits []*storepb.InstanceUsageLimitsSetting_UsageLimit) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, bool, error) {
		index := slices.IndexFunc(limits, func(limit *storepb.InstanceUsageLimitsSetting_UsageLimit) bool { return limit.Uid == uid })
		if index < 0 {
			return nil, false, ErrUsageLimitNotFound
		}
		updated = limits[index]
		if updated.Value == value {
			return limits, false, nil
		}
		updated.Value = value
		updated.UpdateTime = timestamppb.Now()
		return limits, true, nil
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// DeleteUsageLimit removes the usage limit uid.
func (s *Store) DeleteUsageLimit(ctx context.Context, uid string) error {
	return s.mutateUsageLimits(ctx, func(limits []*storepb.InstanceUsageLimitsSetting_UsageLimit) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, bool, error) {
		next := slices.DeleteFunc(limits, func(limit *storepb.InstanceUsageLimitsSetting_UsageLimit) bool { return limit.Uid == uid })
		if len(next) == len(limits) {
			return nil, false, ErrUsageLimitNotFound
		}
		return next, true, nil
	})
}

// DeleteUsageLimitsForUser removes every usage limit of userID. It does
// nothing when the limits come from a deployment file, because the store
// cannot change them; entries for a missing user are ignored at evaluation.
func (s *Store) DeleteUsageLimitsForUser(ctx context.Context, userID int32) error {
	if userID == 0 || s.IsInstanceSettingDeploymentConfigured(storepb.InstanceSettingKey_USAGE_LIMITS) {
		return nil
	}
	return s.mutateUsageLimits(ctx, func(limits []*storepb.InstanceUsageLimitsSetting_UsageLimit) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, bool, error) {
		before := len(limits)
		next := slices.DeleteFunc(limits, func(limit *storepb.InstanceUsageLimitsSetting_UsageLimit) bool { return limit.GetUserId() == userID })
		return next, len(next) != before, nil
	})
}

// usageLimitsMutation receives a private copy of the stored limits and returns
// the new list and whether it changed. Returning an error aborts the write.
type usageLimitsMutation func(limits []*storepb.InstanceUsageLimitsSetting_UsageLimit) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, bool, error)

// mutateUsageLimits applies mutate as a read, modify, and conditional write of
// the USAGE_LIMITS row. The write succeeds only if the row is unchanged since
// it was read; otherwise the whole step runs again, so concurrent writers on
// any replica never overwrite each other. Uniqueness and the cap are checked
// on the list that is written, which makes them safe across replicas.
func (s *Store) mutateUsageLimits(ctx context.Context, mutate usageLimitsMutation) error {
	if s.IsInstanceSettingDeploymentConfigured(storepb.InstanceSettingKey_USAGE_LIMITS) {
		return ErrUsageLimitsDeploymentConfigured
	}
	name := storepb.InstanceSettingKey_USAGE_LIMITS.String()
	for range usageLimitWriteAttempts {
		list, err := s.driver.ListInstanceSettings(ctx, &FindInstanceSetting{Name: name})
		if err != nil {
			return errors.Wrap(err, "failed to read usage limits")
		}
		current := &storepb.InstanceUsageLimitsSetting{}
		var oldValue string
		exists := len(list) > 0
		if exists {
			oldValue = list[0].Value
			if err := protojsonUnmarshaler.Unmarshal([]byte(oldValue), current); err != nil {
				return errors.Wrap(err, "failed to parse stored usage limits")
			}
		} else {
			current = newDefaultInstanceUsageLimitsSetting()
		}
		if err := ValidateInstanceUsageLimitsSetting(current); err != nil {
			return errors.Wrap(err, "invalid stored usage limits")
		}

		next, changed, err := mutate(current.Limits)
		if err != nil {
			return err
		}
		pruned, err := s.pruneUsageLimitsOfMissingUsers(ctx, next)
		if err != nil {
			return err
		}
		if !changed && len(pruned) == len(next) {
			return nil
		}
		setting := &storepb.InstanceUsageLimitsSetting{Limits: pruned}
		if err := ValidateInstanceUsageLimitsSetting(setting); err != nil {
			return err
		}
		valueBytes, err := protojson.Marshal(setting)
		if err != nil {
			return errors.Wrap(err, "failed to marshal usage limits")
		}

		var written bool
		if exists {
			written, err = s.driver.UpdateInstanceSettingIfUnchanged(ctx, name, oldValue, string(valueBytes))
		} else {
			written, err = s.driver.CreateInstanceSettingIfNotExists(ctx, &InstanceSetting{Name: name, Value: string(valueBytes)})
		}
		if err != nil {
			return errors.Wrap(err, "failed to write usage limits")
		}
		if written {
			s.instanceSettingCache.Delete(ctx, name)
			return nil
		}
		slog.Debug("usage limits changed concurrently; retrying")
	}
	return ErrUsageLimitWriteConflict
}

// pruneUsageLimitsOfMissingUsers drops limits whose user no longer exists, so
// entries left behind by a failed cleanup do not count toward the cap forever.
func (s *Store) pruneUsageLimitsOfMissingUsers(ctx context.Context, limits []*storepb.InstanceUsageLimitsSetting_UsageLimit) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, error) {
	userIDs := []int32{}
	for _, limit := range limits {
		if limit.GetUserId() != 0 && !slices.Contains(userIDs, limit.GetUserId()) {
			userIDs = append(userIDs, limit.GetUserId())
		}
	}
	if len(userIDs) == 0 {
		return limits, nil
	}
	users, err := s.driver.ListUsers(ctx, &FindUser{IDList: userIDs})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list users of usage limits")
	}
	existing := make(map[int32]struct{}, len(users))
	for _, user := range users {
		existing[user.ID] = struct{}{}
	}
	return slices.DeleteFunc(limits, func(limit *storepb.InstanceUsageLimitsSetting_UsageLimit) bool {
		if limit.GetUserId() == 0 {
			return false
		}
		_, ok := existing[limit.GetUserId()]
		return !ok
	}), nil
}

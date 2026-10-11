package api

import (
	"context"
	"crypto/rand"
	"slices"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/core/usagelimit"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// ListUsageLimits lists the usage limits. Admin only.
func (s *APIService) ListUsageLimits(ctx context.Context, request *apipb.ListUsageLimitsRequest) (*apipb.ListUsageLimitsResponse, error) {
	if _, err := s.requireUsageLimitAdmin(ctx); err != nil {
		return nil, err
	}
	filter, err := parseUsageLimitFilter(request.Filter)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
	}
	if filter.username != nil && *filter.username != "" {
		user, err := s.Store.GetUser(ctx, &store.FindUser{Username: filter.username})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
		}
		if user == nil {
			return &apipb.ListUsageLimitsResponse{}, nil
		}
		filter.userID = &user.ID
	} else if filter.username != nil {
		everyUser := int32(0)
		filter.userID = &everyUser
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken apipb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = normalizePageSize(pageToken.Limit)
		offset = max(int(pageToken.Offset), 0)
	} else {
		limit = normalizePageSize(request.PageSize)
	}

	limits, usernames, err := s.listVisibleUsageLimits(ctx)
	if err != nil {
		return nil, err
	}
	limits = slices.DeleteFunc(limits, func(limit *storepb.InstanceUsageLimitsSetting_UsageLimit) bool {
		return (filter.userID != nil && limit.UserId != *filter.userID) || (filter.metric != nil && limit.Metric != *filter.metric)
	})
	// Defaults first, then by user and metric, so pages are stable.
	slices.SortStableFunc(limits, func(a, b *storepb.InstanceUsageLimitsSetting_UsageLimit) int {
		if a.UserId != b.UserId {
			if a.UserId == 0 || b.UserId == 0 {
				return int(min(a.UserId, 1)) - int(min(b.UserId, 1))
			}
			return strings.Compare(usernames[a.UserId], usernames[b.UserId])
		}
		return int(a.Metric) - int(b.Metric)
	})

	response := &apipb.ListUsageLimitsResponse{}
	if offset < len(limits) {
		end := min(offset+limit, len(limits))
		for _, item := range limits[offset:end] {
			response.UsageLimits = append(response.UsageLimits, convertUsageLimitFromStore(item, usernames[item.UserId]))
		}
		if end < len(limits) {
			response.NextPageToken, err = getPageToken(limit, end)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get next page token: %v", err)
			}
		}
	}
	return response, nil
}

// GetUsageLimit gets a usage limit. Admin only.
func (s *APIService) GetUsageLimit(ctx context.Context, request *apipb.GetUsageLimitRequest) (*apipb.UsageLimit, error) {
	if _, err := s.requireUsageLimitAdmin(ctx); err != nil {
		return nil, err
	}
	uid, err := ExtractUsageLimitIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid usage limit name: %v", err)
	}
	limits, usernames, err := s.listVisibleUsageLimits(ctx)
	if err != nil {
		return nil, err
	}
	for _, limit := range limits {
		if limit.Uid == uid {
			return convertUsageLimitFromStore(limit, usernames[limit.UserId]), nil
		}
	}
	return nil, status.Errorf(codes.NotFound, "usage limit not found")
}

// CreateUsageLimit creates a usage limit. Admin only.
func (s *APIService) CreateUsageLimit(ctx context.Context, request *apipb.CreateUsageLimitRequest) (*apipb.UsageLimit, error) {
	if _, err := s.requireUsageLimitAdmin(ctx); err != nil {
		return nil, err
	}
	if request.UsageLimit == nil {
		return nil, status.Errorf(codes.InvalidArgument, "usage_limit is required")
	}
	uid, err := validateAndGenerateUsageLimitID(request.UsageLimitId)
	if err != nil {
		return nil, err
	}
	metric := storepb.InstanceUsageLimitsSetting_Metric(request.UsageLimit.Metric)
	if !store.IsValidUsageLimitMetric(metric) {
		return nil, status.Errorf(codes.InvalidArgument, "metric must be MEMOS, STORAGE_BYTES, or UPLOAD_BYTES")
	}
	if request.UsageLimit.Value < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "value must not be negative")
	}
	var user *store.User
	if request.UsageLimit.User != "" {
		user, err = s.resolveUsageLimitUser(ctx, request.UsageLimit.User)
		if err != nil {
			return nil, err
		}
	}
	create := &storepb.InstanceUsageLimitsSetting_UsageLimit{
		Uid:    uid,
		Metric: metric,
		Value:  request.UsageLimit.Value,
	}
	username := ""
	if user != nil {
		create.UserId = user.ID
		username = user.Username
	}
	created, err := s.Store.CreateUsageLimit(ctx, create)
	if err != nil {
		return nil, usageLimitStoreError(err)
	}
	return convertUsageLimitFromStore(created, username), nil
}

// UpdateUsageLimit updates the value of a usage limit. Admin only.
func (s *APIService) UpdateUsageLimit(ctx context.Context, request *apipb.UpdateUsageLimitRequest) (*apipb.UsageLimit, error) {
	if _, err := s.requireUsageLimitAdmin(ctx); err != nil {
		return nil, err
	}
	if request.UsageLimit == nil {
		return nil, status.Errorf(codes.InvalidArgument, "usage_limit is required")
	}
	uid, err := ExtractUsageLimitIDFromName(request.UsageLimit.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid usage limit name: %v", err)
	}
	for _, path := range request.UpdateMask.GetPaths() {
		if path != "value" {
			return nil, status.Errorf(codes.InvalidArgument, "only value can be updated; %q is immutable or unknown", path)
		}
	}
	if request.UsageLimit.Value < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "value must not be negative")
	}
	limits, usernames, err := s.listVisibleUsageLimits(ctx)
	if err != nil {
		return nil, err
	}
	index := slices.IndexFunc(limits, func(limit *storepb.InstanceUsageLimitsSetting_UsageLimit) bool { return limit.Uid == uid })
	if index < 0 {
		return nil, status.Errorf(codes.NotFound, "usage limit not found")
	}
	// metric and user are immutable. A request may echo them back unchanged.
	current := limits[index]
	if request.UsageLimit.Metric != apipb.UsageLimit_METRIC_UNSPECIFIED && storepb.InstanceUsageLimitsSetting_Metric(request.UsageLimit.Metric) != current.Metric {
		return nil, status.Errorf(codes.InvalidArgument, "metric is immutable")
	}
	if request.UsageLimit.User != "" && request.UsageLimit.User != usageLimitUserName(usernames[current.UserId]) {
		return nil, status.Errorf(codes.InvalidArgument, "user is immutable")
	}
	updated, err := s.Store.UpdateUsageLimit(ctx, uid, request.UsageLimit.Value)
	if err != nil {
		return nil, usageLimitStoreError(err)
	}
	return convertUsageLimitFromStore(updated, usernames[updated.UserId]), nil
}

// DeleteUsageLimit deletes a usage limit. Admin only.
func (s *APIService) DeleteUsageLimit(ctx context.Context, request *apipb.DeleteUsageLimitRequest) (*emptypb.Empty, error) {
	if _, err := s.requireUsageLimitAdmin(ctx); err != nil {
		return nil, err
	}
	uid, err := ExtractUsageLimitIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid usage limit name: %v", err)
	}
	if err := s.Store.DeleteUsageLimit(ctx, uid); err != nil {
		return nil, usageLimitStoreError(err)
	}
	return &emptypb.Empty{}, nil
}

func (s *APIService) requireUsageLimitAdmin(ctx context.Context) (*store.User, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if user.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return user, nil
}

// listVisibleUsageLimits returns the stored usage limits, without those of
// users that no longer exist, and the usernames of the users they name.
func (s *APIService) listVisibleUsageLimits(ctx context.Context) ([]*storepb.InstanceUsageLimitsSetting_UsageLimit, map[int32]string, error) {
	setting, err := s.Store.GetInstanceUsageLimitsSetting(ctx)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get usage limits: %v", err)
	}
	userIDs := []int32{}
	for _, limit := range setting.GetLimits() {
		if limit.UserId != 0 && !slices.Contains(userIDs, limit.UserId) {
			userIDs = append(userIDs, limit.UserId)
		}
	}
	usernames := map[int32]string{}
	if len(userIDs) > 0 {
		users, err := s.Store.ListUsers(ctx, &store.FindUser{IDList: userIDs})
		if err != nil {
			return nil, nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
		}
		for _, user := range users {
			usernames[user.ID] = user.Username
		}
	}
	limits := make([]*storepb.InstanceUsageLimitsSetting_UsageLimit, 0, len(setting.GetLimits()))
	for _, limit := range setting.GetLimits() {
		if _, ok := usernames[limit.UserId]; limit.UserId != 0 && !ok {
			continue
		}
		limits = append(limits, limit)
	}
	return limits, usernames, nil
}

func (s *APIService) resolveUsageLimitUser(ctx context.Context, name string) (*store.User, error) {
	username, err := parseUsernameFromName(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	return user, nil
}

func usageLimitStoreError(err error) error {
	switch {
	case errors.Is(err, store.ErrUsageLimitNotFound):
		return status.Errorf(codes.NotFound, "usage limit not found")
	case errors.Is(err, store.ErrUsageLimitAlreadyExists):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, store.ErrUsageLimitsDeploymentConfigured):
		return status.Errorf(codes.FailedPrecondition, "usage limits are configured by the deployment")
	case errors.Is(err, store.ErrUsageLimitWriteConflict):
		return status.Errorf(codes.Aborted, "usage limits changed concurrently; retry")
	case errors.Is(err, store.ErrInvalidUsageLimit):
		return status.Error(codes.InvalidArgument, err.Error())
	default:
		return status.Errorf(codes.Internal, "failed to write usage limits: %v", err)
	}
}

// validateAndGenerateUsageLimitID validates a client-chosen usage limit ID,
// or generates one.
func validateAndGenerateUsageLimitID(provided string) (string, error) {
	if provided == "" {
		return "limit-" + strings.ToLower(rand.Text()[:12]), nil
	}
	if len(provided) > 32 || !store.UsageLimitUIDMatcher.MatchString(provided) {
		return "", status.Errorf(codes.InvalidArgument, "usage_limit_id must be lowercase kebab case, start with a letter, and have at most 32 characters")
	}
	return provided, nil
}

// checkMemoQuota refuses a new memo when the user has reached the memo limit.
func (s *APIService) checkMemoQuota(ctx context.Context, user *store.User) error {
	return usageLimitCheckError(user.Username, usagelimit.CheckMemoCreate(ctx, s.Store, user.ID))
}

// checkUploadQuota refuses an upload of size bytes that would break the
// per-file or storage limit of the user.
func (s *APIService) checkUploadQuota(ctx context.Context, userID int32, size int64) error {
	return s.uploadQuotaError(ctx, userID, usagelimit.CheckUpload(ctx, s.Store, userID, size))
}

// checkFileSizeQuota refuses a file of size bytes that is larger than the
// per-file limit of the user. It runs no count or sum query.
func (s *APIService) checkFileSizeQuota(ctx context.Context, userID int32, size int64) error {
	return s.uploadQuotaError(ctx, userID, usagelimit.CheckFileSize(ctx, s.Store, userID, size))
}

// uploadQuotaError maps an upload check result to a service error, naming the
// user in a refusal.
func (s *APIService) uploadQuotaError(ctx context.Context, userID int32, err error) error {
	if err == nil {
		return nil
	}
	username := ""
	if usagelimit.AsRefusal(err) != nil {
		user, userErr := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
		if userErr == nil && user != nil {
			username = user.Username
		}
	}
	return usageLimitCheckError(username, err)
}

// usageLimitCheckError maps a usage limit check result to a service error.
// A failed check refuses the request: failing open would let a database
// problem switch the limits off.
func usageLimitCheckError(username string, err error) error {
	if err == nil {
		return nil
	}
	if refusal := usagelimit.AsRefusal(err); refusal != nil {
		return newQuotaExceededError(username, refusal)
	}
	return status.Errorf(codes.Internal, "failed to check usage limits: %v", err)
}

// usageLimitFilter is a parsed ListUsageLimits filter. A nil field matches
// every value.
type usageLimitFilter struct {
	// username is "" for the defaults for every user.
	username *string
	userID   *int32
	metric   *storepb.InstanceUsageLimitsSetting_Metric
}

// parseUsageLimitFilter parses `user == "users/{user}"`, `user == ""`, and
// `metric == "STORAGE_BYTES"` comparisons joined by `&&`.
func parseUsageLimitFilter(filter string) (*usageLimitFilter, error) {
	result := &usageLimitFilter{}
	filter = strings.TrimSpace(filter)
	if filter == "" {
		return result, nil
	}
	env, err := cel.NewEnv(cel.Variable("user", cel.StringType), cel.Variable("metric", cel.StringType))
	if err != nil {
		return nil, errors.Wrap(err, "failed to create CEL environment")
	}
	compiled, issues := env.Compile(filter)
	if issues != nil && issues.Err() != nil {
		return nil, errors.Wrapf(issues.Err(), "invalid filter expression: %s", filter)
	}
	if err := result.add(compiled.NativeRep().Expr()); err != nil {
		return nil, err
	}
	return result, nil
}

func (f *usageLimitFilter) add(expr ast.Expr) error {
	if expr.Kind() != ast.CallKind {
		return errors.New("filter must compare user or metric with a string")
	}
	call := expr.AsCall()
	args := call.Args()
	switch call.FunctionName() {
	case "_&&_":
		for _, arg := range args {
			if err := f.add(arg); err != nil {
				return err
			}
		}
		return nil
	case "_==_":
	default:
		return errors.Errorf("unsupported operator %s; use == and &&", call.FunctionName())
	}
	if len(args) != 2 || args[0].Kind() != ast.IdentKind || args[1].Kind() != ast.LiteralKind {
		return errors.New("filter must compare user or metric with a string")
	}
	value, ok := args[1].AsLiteral().Value().(string)
	if !ok {
		return errors.New("filter must compare user or metric with a string")
	}
	switch args[0].AsIdent() {
	case "user":
		username := ""
		if value != "" {
			parsed, err := parseUsernameFromName(value)
			if err != nil {
				return errors.Wrap(err, "invalid user")
			}
			username = parsed
		}
		f.username = &username
	case "metric":
		metric := storepb.InstanceUsageLimitsSetting_Metric(storepb.InstanceUsageLimitsSetting_Metric_value[value])
		if !store.IsValidUsageLimitMetric(metric) {
			return errors.Errorf("unknown metric %q", value)
		}
		f.metric = &metric
	default:
		return errors.Errorf("unknown field %q", args[0].AsIdent())
	}
	return nil
}

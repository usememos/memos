package test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/api"
	"github.com/usememos/memos/store"
)

func createUsageLimit(ctx context.Context, t *testing.T, ts *TestService, id string, metric apipb.UsageLimit_Metric, user string, value int64) *apipb.UsageLimit {
	t.Helper()
	limit, err := ts.Service.CreateUsageLimit(ctx, &apipb.CreateUsageLimitRequest{
		UsageLimitId: id,
		UsageLimit:   &apipb.UsageLimit{Metric: metric, User: user, Value: value},
	})
	require.NoError(t, err)
	return limit
}

// requireQuotaExceeded checks the usage limit error contract and returns the
// ErrorInfo metadata.
func requireQuotaExceeded(t *testing.T, err error, metric, subject string) map[string]string {
	t.Helper()
	st := status.Convert(err)
	require.Equal(t, codes.ResourceExhausted, st.Code(), "got %v", err)
	require.Equal(t, "quota exceeded", st.Message())
	var info *errdetails.ErrorInfo
	var failure *errdetails.QuotaFailure
	for _, detail := range st.Details() {
		switch d := detail.(type) {
		case *errdetails.ErrorInfo:
			info = d
		case *errdetails.QuotaFailure:
			failure = d
		case *errdetails.RetryInfo:
			t.Fatal("a usage limit refusal must not carry RetryInfo")
		default:
		}
	}
	require.NotNil(t, info)
	require.Equal(t, "QUOTA_EXCEEDED", info.Reason)
	require.Equal(t, "memos.api", info.Domain)
	require.Equal(t, metric, info.Metadata["metric"])
	require.NotNil(t, failure)
	require.Len(t, failure.Violations, 1)
	require.Equal(t, subject, failure.Violations[0].Subject)
	require.NotEmpty(t, failure.Violations[0].Description)
	return info.Metadata
}

func TestUsageLimitServicePermissions(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "limits-admin")
	require.NoError(t, err)
	user, err := ts.CreateRegularUser(ctx, "limits-user")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	limit := createUsageLimit(adminCtx, t, ts, "default-memos", apipb.UsageLimit_MEMOS, "", 10)

	for _, caller := range []struct {
		ctx  context.Context
		code codes.Code
	}{
		{ctx: ts.CreateUserContext(ctx, user.ID), code: codes.PermissionDenied},
		{ctx: ctx, code: codes.Unauthenticated},
	} {
		_, err := ts.Service.ListUsageLimits(caller.ctx, &apipb.ListUsageLimitsRequest{})
		require.Equal(t, caller.code, status.Code(err))
		_, err = ts.Service.GetUsageLimit(caller.ctx, &apipb.GetUsageLimitRequest{Name: limit.Name})
		require.Equal(t, caller.code, status.Code(err))
		_, err = ts.Service.CreateUsageLimit(caller.ctx, &apipb.CreateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_STORAGE_BYTES, Value: 1}})
		require.Equal(t, caller.code, status.Code(err))
		_, err = ts.Service.UpdateUsageLimit(caller.ctx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: limit.Name, Value: 1}})
		require.Equal(t, caller.code, status.Code(err))
		_, err = ts.Service.DeleteUsageLimit(caller.ctx, &apipb.DeleteUsageLimitRequest{Name: limit.Name})
		require.Equal(t, caller.code, status.Code(err))
	}

	// The row never leaks through the instance settings API.
	_, err = ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: "instance/settings/USAGE_LIMITS"})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: &apipb.InstanceSetting{Name: "instance/settings/USAGE_LIMITS"}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	got, err := ts.Service.GetUsageLimit(adminCtx, &apipb.GetUsageLimitRequest{Name: limit.Name})
	require.NoError(t, err)
	require.Equal(t, int64(10), got.Value, "a refused settings update leaves the limits unchanged")
}

func TestUsageLimitServiceCRUD(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "crud-admin")
	require.NoError(t, err)
	alice, err := ts.CreateRegularUser(ctx, "crud-alice")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	aliceName := api.BuildUserName(alice.Username)

	defaultStorage := createUsageLimit(adminCtx, t, ts, "default-storage", apipb.UsageLimit_STORAGE_BYTES, "", 1<<30)
	require.Equal(t, "usageLimits/default-storage", defaultStorage.Name)
	require.Empty(t, defaultStorage.User)
	require.NotNil(t, defaultStorage.CreateTime)
	aliceStorage := createUsageLimit(adminCtx, t, ts, "", apipb.UsageLimit_STORAGE_BYTES, aliceName, 5<<30)
	require.Regexp(t, `^usageLimits/limit-[a-z2-7]{12}$`, aliceStorage.Name, "an ID is generated when none is given")
	require.Equal(t, aliceName, aliceStorage.User)
	createUsageLimit(adminCtx, t, ts, "default-memos", apipb.UsageLimit_MEMOS, "", 1000)

	for name, request := range map[string]*apipb.CreateUsageLimitRequest{
		"negative value": {UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_MEMOS, User: aliceName, Value: -1}},
		"no metric":      {UsageLimit: &apipb.UsageLimit{User: aliceName, Value: 1}},
		"bad user name":  {UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_MEMOS, User: "people/alice", Value: 1}},
		"bad ID":         {UsageLimitId: "Alice_Memos", UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_MEMOS, Value: 1}},
		"long ID":        {UsageLimitId: "a-very-long-usage-limit-identifier-x", UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_MEMOS, Value: 1}},
		"missing limit":  {},
	} {
		_, err := ts.Service.CreateUsageLimit(adminCtx, request)
		require.Equal(t, codes.InvalidArgument, status.Code(err), name)
	}
	_, err = ts.Service.CreateUsageLimit(adminCtx, &apipb.CreateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_MEMOS, User: "users/nobody", Value: 1}})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = ts.Service.CreateUsageLimit(adminCtx, &apipb.CreateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_STORAGE_BYTES, User: aliceName, Value: 1}})
	require.Equal(t, codes.AlreadyExists, status.Code(err), "one limit per metric and user")
	_, err = ts.Service.CreateUsageLimit(adminCtx, &apipb.CreateUsageLimitRequest{UsageLimitId: "default-storage", UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_UPLOAD_BYTES, Value: 1}})
	require.Equal(t, codes.AlreadyExists, status.Code(err), "IDs are unique")

	// Update: only value changes; metric and user are immutable.
	updated, err := ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{
		UsageLimit: &apipb.UsageLimit{Name: aliceStorage.Name, Value: 6 << 30, Metric: apipb.UsageLimit_STORAGE_BYTES, User: aliceName},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"value"}},
	})
	require.NoError(t, err)
	require.Equal(t, int64(6<<30), updated.Value)
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: aliceStorage.Name, Value: 1, Metric: apipb.UsageLimit_MEMOS}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: defaultStorage.Name, Value: 1, User: aliceName}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{
		UsageLimit: &apipb.UsageLimit{Name: defaultStorage.Name, Value: 1},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"metric"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: defaultStorage.Name, Value: -1}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: "usageLimits/missing", Value: 1}})
	require.Equal(t, codes.NotFound, status.Code(err))

	// List, filter and page. Defaults come first.
	list, err := ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{})
	require.NoError(t, err)
	require.Len(t, list.UsageLimits, 3)
	require.Empty(t, list.UsageLimits[0].User)
	require.Empty(t, list.UsageLimits[1].User)
	require.Equal(t, aliceName, list.UsageLimits[2].User)
	filtered, err := ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{Filter: `user == "` + aliceName + `"`})
	require.NoError(t, err)
	require.Len(t, filtered.UsageLimits, 1)
	filtered, err = ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{Filter: `user == "" && metric == "STORAGE_BYTES"`})
	require.NoError(t, err)
	require.Len(t, filtered.UsageLimits, 1)
	require.Equal(t, defaultStorage.Name, filtered.UsageLimits[0].Name)
	_, err = ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{Filter: `metric == "PLANS"`})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{Filter: `user != ""`})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	page, err := ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{PageSize: 2})
	require.NoError(t, err)
	require.Len(t, page.UsageLimits, 2)
	require.NotEmpty(t, page.NextPageToken)
	page, err = ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{PageToken: page.NextPageToken})
	require.NoError(t, err)
	require.Len(t, page.UsageLimits, 1)
	require.Empty(t, page.NextPageToken)

	// Renaming a user keeps their limits; deleting the user removes them.
	renamed := "crud-alice-renamed"
	_, err = ts.Store.UpdateUser(ctx, &store.UpdateUser{ID: alice.ID, Username: &renamed})
	require.NoError(t, err)
	got, err := ts.Service.GetUsageLimit(adminCtx, &apipb.GetUsageLimitRequest{Name: aliceStorage.Name})
	require.NoError(t, err)
	require.Equal(t, api.BuildUserName(renamed), got.User)
	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: alice.ID})
	require.NoError(t, err)
	_, err = ts.Service.GetUsageLimit(adminCtx, &apipb.GetUsageLimitRequest{Name: aliceStorage.Name})
	require.Equal(t, codes.NotFound, status.Code(err))

	_, err = ts.Service.DeleteUsageLimit(adminCtx, &apipb.DeleteUsageLimitRequest{Name: defaultStorage.Name})
	require.NoError(t, err)
	_, err = ts.Service.DeleteUsageLimit(adminCtx, &apipb.DeleteUsageLimitRequest{Name: defaultStorage.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	list, err = ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{})
	require.NoError(t, err)
	require.Len(t, list.UsageLimits, 1)
}

func TestUsageLimitServiceDeploymentFile(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "file-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-usage-limits.json"),
		[]byte(`{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"uid":"default-memos","metric":"MEMOS","value":"1"}]}}`), 0o600))
	require.NoError(t, ts.Store.LoadDeploymentConfigurationDir(ctx, dir))

	list, err := ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{})
	require.NoError(t, err)
	require.Len(t, list.UsageLimits, 1)
	_, err = ts.Service.CreateUsageLimit(adminCtx, &apipb.CreateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Metric: apipb.UsageLimit_STORAGE_BYTES, Value: 1}})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: "usageLimits/default-memos", Value: 5}})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	_, err = ts.Service.DeleteUsageLimit(adminCtx, &apipb.DeleteUsageLimitRequest{Name: "usageLimits/default-memos"})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	// The file-provided limit is enforced.
	_, err = ts.Service.CreateMemo(adminCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: "first", Visibility: apipb.Visibility_PRIVATE}})
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(adminCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: "second", Visibility: apipb.Visibility_PRIVATE}})
	requireQuotaExceeded(t, err, "MEMOS", api.BuildUserName(admin.Username))
}

func TestMemoLimitEnforcement(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "memo-admin")
	require.NoError(t, err)
	user, err := ts.CreateRegularUser(ctx, "memo-user")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	createMemo := func(ctx context.Context, content string) (*apipb.Memo, error) {
		return ts.Service.CreateMemo(ctx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: content, Visibility: apipb.Visibility_PUBLIC}})
	}

	// With no limits, nothing changes.
	first, err := createMemo(userCtx, "first")
	require.NoError(t, err)
	usage, err := ts.Service.GetUserUsage(userCtx, &apipb.GetUserUsageRequest{Name: api.BuildUserName(user.Username) + "/usage"})
	require.NoError(t, err)
	require.Equal(t, int64(1), usage.MemoCount)
	require.Zero(t, usage.MemosLimit.Value)
	require.Empty(t, usage.MemosLimit.UsageLimit)

	createUsageLimit(adminCtx, t, ts, "default-memos", apipb.UsageLimit_MEMOS, "", 2)
	second, err := createMemo(userCtx, "second")
	require.NoError(t, err)
	_, err = createMemo(userCtx, "third")
	metadata := requireQuotaExceeded(t, err, "MEMOS", api.BuildUserName(user.Username))
	require.Equal(t, map[string]string{"metric": "MEMOS", "limit": "2", "usage": "2", "usage_limit": "usageLimits/default-memos"}, metadata)
	count, err := ts.Store.CountUserMemos(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(2), count, "a refused create writes no memo")

	// A comment is a memo row: it is refused at the limit and writes nothing.
	_, err = ts.Service.CreateMemoComment(userCtx, &apipb.CreateMemoCommentRequest{Parent: first.Name, Comment: &apipb.Memo{Content: "a comment", Visibility: apipb.Visibility_PUBLIC}})
	requireQuotaExceeded(t, err, "MEMOS", api.BuildUserName(user.Username))
	count, err = ts.Store.CountUserMemos(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(2), count)

	// Archiving keeps the slot; deleting frees it.
	_, err = ts.Service.UpdateMemo(userCtx, &apipb.UpdateMemoRequest{
		Memo: &apipb.Memo{Name: second.Name, State: apipb.State_ARCHIVED}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)
	_, err = createMemo(userCtx, "still refused")
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	_, err = ts.Service.DeleteMemo(userCtx, &apipb.DeleteMemoRequest{Name: second.Name})
	require.NoError(t, err)
	_, err = createMemo(userCtx, "fits again")
	require.NoError(t, err)

	// A user's own limit replaces the default, and admins are limited too.
	createUsageLimit(adminCtx, t, ts, "user-memos", apipb.UsageLimit_MEMOS, api.BuildUserName(user.Username), 0)
	_, err = createMemo(userCtx, "unlimited now")
	require.NoError(t, err)
	_, err = createMemo(adminCtx, "admin one")
	require.NoError(t, err)
	_, err = createMemo(adminCtx, "admin two")
	require.NoError(t, err)
	_, err = createMemo(adminCtx, "admin three")
	requireQuotaExceeded(t, err, "MEMOS", api.BuildUserName(admin.Username))

	usage, err = ts.Service.GetUserUsage(userCtx, &apipb.GetUserUsageRequest{Name: api.BuildUserName(user.Username) + "/usage"})
	require.NoError(t, err)
	require.Equal(t, "usageLimits/user-memos", usage.MemosLimit.UsageLimit)
	require.Zero(t, usage.MemosLimit.Value)

	// Deleting every limit restores the previous behavior.
	limits, err := ts.Service.ListUsageLimits(adminCtx, &apipb.ListUsageLimitsRequest{})
	require.NoError(t, err)
	for _, limit := range limits.UsageLimits {
		_, err := ts.Service.DeleteUsageLimit(adminCtx, &apipb.DeleteUsageLimitRequest{Name: limit.Name})
		require.NoError(t, err)
	}
	_, err = createMemo(adminCtx, "admin three")
	require.NoError(t, err)
}

func TestUploadLimitEnforcement(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	defer ts.Service.CloseUploads()
	admin, err := ts.CreateHostUser(ctx, "upload-admin")
	require.NoError(t, err)
	user, err := ts.CreateRegularUser(ctx, "upload-user")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	subject := api.BuildUserName(user.Username)
	attachmentCount := func() int {
		t.Helper()
		attachments, err := ts.Store.ListAttachments(ctx, &store.FindAttachment{CreatorID: &user.ID})
		require.NoError(t, err)
		return len(attachments)
	}
	uploadFiles := func() []string {
		t.Helper()
		paths, err := filepath.Glob(filepath.Join(ts.Profile.Data, ".memos-rpc-upload-*"))
		require.NoError(t, err)
		return paths
	}
	create := func(size int) error {
		_, err := ts.Service.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{
			Attachment: &apipb.Attachment{Filename: "file.bin", Type: "application/octet-stream", Content: make([]byte, size)},
		})
		return err
	}

	createUsageLimit(adminCtx, t, ts, "default-storage", apipb.UsageLimit_STORAGE_BYTES, "", 100)
	createUsageLimit(adminCtx, t, ts, "default-upload", apipb.UsageLimit_UPLOAD_BYTES, "", 60)

	require.NoError(t, create(60))
	metadata := requireQuotaExceeded(t, create(61), "UPLOAD_BYTES", subject)
	require.Equal(t, "61", metadata["usage"])
	metadata = requireQuotaExceeded(t, create(41), "STORAGE_BYTES", subject)
	require.Equal(t, "60", metadata["usage"])
	require.Equal(t, "100", metadata["limit"])
	require.Equal(t, 1, attachmentCount(), "a refused upload stores nothing")
	require.NoError(t, create(40), "exactly reaching the storage limit is allowed")

	// External links do not count toward storage.
	_, err = ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID: "upload-external", CreatorID: user.ID, Filename: "link", Size: 1 << 20, StorageType: storepb.AttachmentStorageType_EXTERNAL, Reference: "https://example.com/a",
	})
	require.NoError(t, err)
	usage, err := ts.Service.GetUserUsage(userCtx, &apipb.GetUserUsageRequest{Name: subject + "/usage"})
	require.NoError(t, err)
	require.Equal(t, int64(100), usage.StorageBytes)
	require.Equal(t, "usageLimits/default-storage", usage.StorageBytesLimit.UsageLimit)
	require.Equal(t, int64(60), usage.UploadBytesLimit.Value)

	// A chunked upload is refused at start before any session or file exists.
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: "usageLimits/default-storage", Value: 200}})
	require.NoError(t, err)
	_, err = ts.Service.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
		Attachment: &apipb.Attachment{Filename: "big.bin", Type: "application/octet-stream"}, TotalSize: 120,
	}}})
	requireQuotaExceeded(t, err, "UPLOAD_BYTES", subject)
	require.Empty(t, uploadFiles())

	// At finish, the check runs again: another upload filled the storage in between.
	started, err := ts.Service.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
		Attachment: &apipb.Attachment{Filename: "late.bin", Type: "application/octet-stream"}, TotalSize: 50,
	}}})
	require.NoError(t, err)
	require.Len(t, uploadFiles(), 1)
	require.NoError(t, create(60))
	_, err = ts.Service.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{
		Upload: &apipb.UploadAttachmentRequest_UploadId{UploadId: started.UploadId}, Data: make([]byte, 50), FinishWrite: true,
	})
	requireQuotaExceeded(t, err, "STORAGE_BYTES", subject)
	require.Empty(t, uploadFiles(), "a refusal at finish removes the temporary file")
	require.Equal(t, 4, attachmentCount(), "a refusal at finish stores nothing")
	_, err = ts.Service.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{
		Upload: &apipb.UploadAttachmentRequest_UploadId{UploadId: started.UploadId}, FinishWrite: true,
	})
	require.Equal(t, codes.NotFound, status.Code(err), "a refused upload is revoked")

	// A user's own per-file limit replaces the default in either direction.
	_, err = ts.Service.UpdateUsageLimit(adminCtx, &apipb.UpdateUsageLimitRequest{UsageLimit: &apipb.UsageLimit{Name: "usageLimits/default-storage", Value: 0}})
	require.NoError(t, err)
	createUsageLimit(adminCtx, t, ts, "user-upload", apipb.UsageLimit_UPLOAD_BYTES, subject, 1<<20)
	require.NoError(t, create(1<<20))
	metadata = requireQuotaExceeded(t, create(1<<20+1), "UPLOAD_BYTES", subject)
	require.Equal(t, "usageLimits/user-upload", metadata["usage_limit"])

	// Without any per-file limit, a file of any size is accepted.
	_, err = ts.Service.DeleteUsageLimit(adminCtx, &apipb.DeleteUsageLimitRequest{Name: "usageLimits/user-upload"})
	require.NoError(t, err)
	_, err = ts.Service.DeleteUsageLimit(adminCtx, &apipb.DeleteUsageLimitRequest{Name: "usageLimits/default-upload"})
	require.NoError(t, err)
	require.NoError(t, create(33<<20))
}

func TestGetUserUsagePermissions(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "usage-admin")
	require.NoError(t, err)
	alice, err := ts.CreateRegularUser(ctx, "usage-alice")
	require.NoError(t, err)
	bob, err := ts.CreateRegularUser(ctx, "usage-bob")
	require.NoError(t, err)
	aliceUsage := api.BuildUserName(alice.Username) + "/usage"

	_, err = ts.Service.GetUserUsage(ts.CreateUserContext(ctx, alice.ID), &apipb.GetUserUsageRequest{Name: aliceUsage})
	require.NoError(t, err)
	usage, err := ts.Service.GetUserUsage(ts.CreateUserContext(ctx, admin.ID), &apipb.GetUserUsageRequest{Name: aliceUsage})
	require.NoError(t, err)
	require.Equal(t, aliceUsage, usage.Name)
	_, err = ts.Service.GetUserUsage(ts.CreateUserContext(ctx, bob.ID), &apipb.GetUserUsageRequest{Name: aliceUsage})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = ts.Service.GetUserUsage(ts.CreateUserContext(ctx, bob.ID), &apipb.GetUserUsageRequest{Name: "users/nobody/usage"})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "non-admins cannot probe for usernames")
	_, err = ts.Service.GetUserUsage(ts.CreateUserContext(ctx, admin.ID), &apipb.GetUserUsageRequest{Name: "users/nobody/usage"})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = ts.Service.GetUserUsage(ctx, &apipb.GetUserUsageRequest{Name: aliceUsage})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	_, err = ts.Service.GetUserUsage(ts.CreateUserContext(ctx, alice.ID), &apipb.GetUserUsageRequest{Name: api.BuildUserName(alice.Username)})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

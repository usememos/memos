package test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
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

type usageLimitEntry = apipb.InstanceSetting_UsageLimitsSetting_UsageLimit

const usageLimitsSettingName = "instance/settings/USAGE_LIMITS"

func usageLimitsSetting(limits ...*usageLimitEntry) *apipb.InstanceSetting {
	return &apipb.InstanceSetting{
		Name:  usageLimitsSettingName,
		Value: &apipb.InstanceSetting_UsageLimitsSetting_{UsageLimitsSetting: &apipb.InstanceSetting_UsageLimitsSetting{Limits: limits}},
	}
}

// setUsageLimits replaces the usage limits through the API as ctx's user.
func setUsageLimits(ctx context.Context, t *testing.T, ts *TestService, limits ...*usageLimitEntry) *apipb.InstanceSetting_UsageLimitsSetting {
	t.Helper()
	setting, err := ts.Service.UpdateInstanceSetting(ctx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: usageLimitsSetting(limits...)})
	require.NoError(t, err)
	return setting.GetUsageLimitsSetting()
}

// setDefaultUploadLimit stores one all-users entry with the given per-file
// limit directly in the store, for tests of other services.
func setDefaultUploadLimit(ctx context.Context, t *testing.T, s *store.Store, uploadBytes int64) {
	t.Helper()
	_, err := s.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_USAGE_LIMITS,
		Value: &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: &storepb.InstanceUsageLimitsSetting{
			Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{{AllUsers: true, UploadBytes: &uploadBytes}},
		}},
	})
	require.NoError(t, err)
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

func TestUsageLimitsSettingPermissions(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "limits-admin")
	require.NoError(t, err)
	user, err := ts.CreateRegularUser(ctx, "limits-user")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	for _, caller := range []struct {
		ctx  context.Context
		code codes.Code
	}{
		{ctx: ts.CreateUserContext(ctx, user.ID), code: codes.PermissionDenied},
		{ctx: ctx, code: codes.Unauthenticated},
	} {
		_, err := ts.Service.GetInstanceSetting(caller.ctx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
		require.Equal(t, caller.code, status.Code(err), "the entries name users, so only admins read them")
		_, err = ts.Service.UpdateInstanceSetting(caller.ctx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: usageLimitsSetting(&usageLimitEntry{AllUsers: true})})
		require.Equal(t, caller.code, status.Code(err))
	}

	setting, err := ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
	require.NoError(t, err)
	limits := setting.GetUsageLimitsSetting().Limits
	require.Len(t, limits, 1, "the built-in default is the only entry")
	require.True(t, limits[0].AllUsers)
	require.Equal(t, store.DefaultUploadBytes, limits[0].GetUploadBytes())
	require.Equal(t, store.DefaultMemoContentBytes, limits[0].GetMemoContentBytes())
	require.Nil(t, limits[0].MemoCount)
}

func TestUsageLimitsSettingUpdate(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "crud-admin")
	require.NoError(t, err)
	alice, err := ts.CreateRegularUser(ctx, "crud-alice")
	require.NoError(t, err)
	bob, err := ts.CreateRegularUser(ctx, "crud-bob")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	aliceName, bobName := api.BuildUserName(alice.Username), api.BuildUserName(bob.Username)

	saved := setUsageLimits(adminCtx, t, ts,
		&usageLimitEntry{Users: []string{aliceName, bobName}, StorageBytes: new(int64(5 << 30))},
		&usageLimitEntry{Users: []string{aliceName}, MemoCount: new(int64(0))},
		&usageLimitEntry{AllUsers: true, StorageBytes: new(int64(1 << 30)), MemoCount: new(int64(1000))},
	)
	require.Len(t, saved.Limits, 3)
	require.Equal(t, []string{aliceName, bobName}, saved.Limits[0].Users)
	require.Equal(t, int64(5<<30), saved.Limits[0].GetStorageBytes())
	require.Nil(t, saved.Limits[0].MemoCount, "unset stays unset")
	require.Zero(t, saved.Limits[1].GetMemoCount())
	require.NotNil(t, saved.Limits[1].MemoCount, "an explicit zero stays explicit")
	got, err := ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
	require.NoError(t, err)
	require.Equal(t, saved.String(), got.GetUsageLimitsSetting().String(), "the update response is what a read returns")

	// Resolution follows the order: Alice's first entry is the pair, which has
	// no memo limit, so her later memo entry is never reached.
	usage, err := ts.Service.GetUserUsage(adminCtx, &apipb.GetUserUsageRequest{Name: aliceName + "/usage"})
	require.NoError(t, err)
	require.Equal(t, int32(0), usage.LimitIndex)
	require.Equal(t, int64(5<<30), usage.Limits.GetStorageBytes())
	require.Nil(t, usage.Limits.MemoCount)
	usage, err = ts.Service.GetUserUsage(adminCtx, &apipb.GetUserUsageRequest{Name: api.BuildUserName(admin.Username) + "/usage"})
	require.NoError(t, err)
	require.Equal(t, int32(2), usage.LimitIndex, "admins fall through to the default like everyone else")
	require.Equal(t, int64(1000), usage.Limits.GetMemoCount())

	for name, request := range map[string]*apipb.InstanceSetting{
		"missing setting":     {Name: usageLimitsSettingName},
		"empty list":          usageLimitsSetting(),
		"no all-users entry":  usageLimitsSetting(&usageLimitEntry{Users: []string{aliceName}}),
		"all users not last":  usageLimitsSetting(&usageLimitEntry{AllUsers: true}, &usageLimitEntry{Users: []string{aliceName}}),
		"users and all users": usageLimitsSetting(&usageLimitEntry{AllUsers: true, Users: []string{aliceName}}),
		"entry without users": usageLimitsSetting(&usageLimitEntry{}, &usageLimitEntry{AllUsers: true}),
		"repeated user":       usageLimitsSetting(&usageLimitEntry{Users: []string{aliceName, aliceName}}, &usageLimitEntry{AllUsers: true}),
		"negative value":      usageLimitsSetting(&usageLimitEntry{AllUsers: true, MemoCount: new(int64(-1))}),
		"bad user name":       usageLimitsSetting(&usageLimitEntry{Users: []string{"people/alice"}}, &usageLimitEntry{AllUsers: true}),
	} {
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: request})
		require.Equal(t, codes.InvalidArgument, status.Code(err), name)
	}
	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{
		InstanceSetting: usageLimitsSetting(&usageLimitEntry{Users: []string{"users/nobody"}}, &usageLimitEntry{AllUsers: true}),
	})
	require.Equal(t, codes.NotFound, status.Code(err))
	got, err = ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
	require.NoError(t, err)
	require.Equal(t, saved.String(), got.GetUsageLimitsSetting().String(), "a refused update leaves the limits unchanged")

	// Renaming a user keeps their entries; deleting the user removes them.
	renamed := "crud-alice-renamed"
	_, err = ts.Store.UpdateUser(ctx, &store.UpdateUser{ID: alice.ID, Username: &renamed})
	require.NoError(t, err)
	got, err = ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
	require.NoError(t, err)
	require.Equal(t, []string{api.BuildUserName(renamed), bobName}, got.GetUsageLimitsSetting().Limits[0].Users)
	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: alice.ID})
	require.NoError(t, err)
	got, err = ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
	require.NoError(t, err)
	require.Len(t, got.GetUsageLimitsSetting().Limits, 2)
	require.Equal(t, []string{bobName}, got.GetUsageLimitsSetting().Limits[0].Users)
	require.True(t, got.GetUsageLimitsSetting().Limits[1].AllUsers)
}

func TestUsageLimitsDeploymentFile(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "file-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-usage-limits.json"),
		[]byte(`{"key":"USAGE_LIMITS","usageLimitsSetting":{"limits":[{"allUsers":true,"memoCount":"1"}]}}`), 0o600))
	require.NoError(t, ts.Store.LoadDeploymentConfigurationDir(ctx, dir))

	got, err := ts.Service.GetInstanceSetting(adminCtx, &apipb.GetInstanceSettingRequest{Name: usageLimitsSettingName})
	require.NoError(t, err)
	require.Len(t, got.GetUsageLimitsSetting().Limits, 1)
	require.Equal(t, int64(1), got.GetUsageLimitsSetting().Limits[0].GetMemoCount())
	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: usageLimitsSetting(&usageLimitEntry{AllUsers: true})})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	// The file-provided limit is enforced.
	_, err = ts.Service.CreateMemo(adminCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: "first", Visibility: apipb.Visibility_PRIVATE}})
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(adminCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: "second", Visibility: apipb.Visibility_PRIVATE}})
	requireQuotaExceeded(t, err, "MEMO_COUNT", api.BuildUserName(admin.Username))
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
	userName := api.BuildUserName(user.Username)
	createMemo := func(ctx context.Context, content string) (*apipb.Memo, error) {
		return ts.Service.CreateMemo(ctx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: content, Visibility: apipb.Visibility_PUBLIC}})
	}

	// With the built-in default, memos are not counted.
	first, err := createMemo(userCtx, "first")
	require.NoError(t, err)
	usage, err := ts.Service.GetUserUsage(userCtx, &apipb.GetUserUsageRequest{Name: userName + "/usage"})
	require.NoError(t, err)
	require.Equal(t, int64(1), usage.MemoCount)
	require.Nil(t, usage.Limits.MemoCount)
	require.Equal(t, store.DefaultUploadBytes, usage.Limits.GetUploadBytes())
	require.Equal(t, int32(0), usage.LimitIndex)

	setUsageLimits(adminCtx, t, ts, &usageLimitEntry{AllUsers: true, MemoCount: new(int64(2))})
	second, err := createMemo(userCtx, "second")
	require.NoError(t, err)
	_, err = createMemo(userCtx, "third")
	metadata := requireQuotaExceeded(t, err, "MEMO_COUNT", userName)
	require.Equal(t, map[string]string{"metric": "MEMO_COUNT", "limit": "2", "usage": "2"}, metadata)
	count, err := ts.Store.CountUserMemos(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(2), count, "a refused create writes no memo")

	// A comment is a memo row: it is refused at the limit and writes nothing.
	_, err = ts.Service.CreateMemoComment(userCtx, &apipb.CreateMemoCommentRequest{Parent: first.Name, Comment: &apipb.Memo{Content: "a comment", Visibility: apipb.Visibility_PUBLIC}})
	requireQuotaExceeded(t, err, "MEMO_COUNT", userName)
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

	// An entry naming the user comes first and is the whole limit set, so an
	// explicit zero makes the user unlimited. Admins are limited too.
	setUsageLimits(adminCtx, t, ts,
		&usageLimitEntry{Users: []string{userName}, MemoCount: new(int64(0))},
		&usageLimitEntry{AllUsers: true, MemoCount: new(int64(2))},
	)
	_, err = createMemo(userCtx, "unlimited now")
	require.NoError(t, err)
	_, err = createMemo(adminCtx, "admin one")
	require.NoError(t, err)
	_, err = createMemo(adminCtx, "admin two")
	require.NoError(t, err)
	_, err = createMemo(adminCtx, "admin three")
	requireQuotaExceeded(t, err, "MEMO_COUNT", api.BuildUserName(admin.Username))

	usage, err = ts.Service.GetUserUsage(userCtx, &apipb.GetUserUsageRequest{Name: userName + "/usage"})
	require.NoError(t, err)
	require.Equal(t, int32(0), usage.LimitIndex)
	require.Zero(t, usage.Limits.GetMemoCount())
	require.NotNil(t, usage.Limits.MemoCount)

	// A default without a memo limit restores the previous behavior.
	setUsageLimits(adminCtx, t, ts, &usageLimitEntry{AllUsers: true})
	_, err = createMemo(adminCtx, "admin three")
	require.NoError(t, err)
}

func TestMemoContentLimitEnforcement(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	t.Cleanup(ts.Service.CloseUploads)
	admin, err := ts.CreateHostUser(ctx, "content-admin")
	require.NoError(t, err)
	user, err := ts.CreateRegularUser(ctx, "content-user")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	subject := api.BuildUserName(user.Username)

	usage, err := ts.Service.GetUserUsage(userCtx, &apipb.GetUserUsageRequest{Name: subject + "/usage"})
	require.NoError(t, err)
	require.Equal(t, store.DefaultMemoContentBytes, usage.Limits.GetMemoContentBytes())
	create := func(content string) (*apipb.Memo, error) {
		return ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Content: content, Visibility: apipb.Visibility_PRIVATE}})
	}
	memo, err := create(strings.Repeat("a", 8192))
	require.NoError(t, err)
	_, err = create(strings.Repeat("a", 8193))
	metadata := requireQuotaExceeded(t, err, "MEMO_CONTENT_BYTES", subject)
	require.Equal(t, map[string]string{"metric": "MEMO_CONTENT_BYTES", "limit": "8192", "usage": "8193"}, metadata)
	_, err = ts.Service.UpdateMemo(userCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: memo.Name, Content: strings.Repeat("a", 8193)},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	requireQuotaExceeded(t, err, "MEMO_CONTENT_BYTES", subject)
	got, err := ts.Service.GetMemo(userCtx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Equal(t, memo.Content, got.Content, "a refused edit leaves content unchanged")
	_, err = ts.Service.CreateMemoComment(userCtx, &apipb.CreateMemoCommentRequest{Parent: memo.Name, Comment: &apipb.Memo{Content: strings.Repeat("a", 8193), Visibility: apipb.Visibility_PRIVATE}})
	requireQuotaExceeded(t, err, "MEMO_CONTENT_BYTES", subject)

	setUsageLimits(adminCtx, t, ts,
		&usageLimitEntry{Users: []string{subject}, MemoContentBytes: new(int64(6))},
		&usageLimitEntry{AllUsers: true, MemoContentBytes: new(int64(8192))},
	)
	unicodeMemo, err := create("中文")
	require.NoError(t, err)
	_, err = create("中文字")
	requireQuotaExceeded(t, err, "MEMO_CONTENT_BYTES", subject)
	// An admin editing another user's memo uses the memo owner's limit.
	_, err = ts.Service.UpdateMemo(adminCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: unicodeMemo.Name, Content: "中文字"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	metadata = requireQuotaExceeded(t, err, "MEMO_CONTENT_BYTES", subject)
	require.Equal(t, "6", metadata["limit"])

	archive := buildImportArchive(t, user.Username, nil)
	importArchive := func() *apipb.ImportMemosReport {
		response, err := ts.Service.ImportMemos(userCtx, &apipb.ImportMemosRequest{
			Name: subject, Upload: &apipb.ImportMemosRequest_Spec{Spec: &apipb.ImportMemosSpec{TotalSize: int64(len(archive))}},
			Data: archive, FinishWrite: true,
		})
		require.NoError(t, err)
		return response.GetReport()
	}
	report := importArchive()
	require.Equal(t, int32(1), report.Failed)
	require.Zero(t, report.Created)
	setUsageLimits(adminCtx, t, ts,
		&usageLimitEntry{Users: []string{subject}, MemoContentBytes: new(int64(0))},
		&usageLimitEntry{AllUsers: true, MemoContentBytes: new(int64(8192))},
	)
	_, err = create(strings.Repeat("a", 65536))
	require.NoError(t, err, "explicit zero disables the content limit")
	report = importArchive()
	require.Zero(t, report.Failed)
	require.Equal(t, int32(1), report.Created)
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

	setUsageLimits(adminCtx, t, ts, &usageLimitEntry{AllUsers: true, StorageBytes: new(int64(100)), UploadBytes: new(int64(60))})

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
	require.Equal(t, int64(100), usage.Limits.GetStorageBytes())
	require.Equal(t, int64(60), usage.Limits.GetUploadBytes())

	// A chunked upload is refused at start before any session or file exists.
	setUsageLimits(adminCtx, t, ts, &usageLimitEntry{AllUsers: true, StorageBytes: new(int64(200)), UploadBytes: new(int64(60))})
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

	// An entry naming the user is the whole limit set: a bigger per-file limit
	// and no storage limit, whatever the default says.
	setUsageLimits(adminCtx, t, ts,
		&usageLimitEntry{Users: []string{subject}, UploadBytes: new(int64(1 << 20))},
		&usageLimitEntry{AllUsers: true, StorageBytes: new(int64(200)), UploadBytes: new(int64(60))},
	)
	require.NoError(t, create(1<<20))
	metadata = requireQuotaExceeded(t, create(1<<20+1), "UPLOAD_BYTES", subject)
	require.Equal(t, "1048576", metadata["limit"])

	// Without any per-file limit, a file of any size is accepted.
	setUsageLimits(adminCtx, t, ts, &usageLimitEntry{AllUsers: true})
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

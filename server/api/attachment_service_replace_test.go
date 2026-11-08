package api

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// A finish that committed a replacement but failed afterwards (the reload) can
// be retried by the client. The retry must report the attachment as it is, and
// never apply its upload again over a newer replacement.
func TestReplaceAttachmentRetryAfterCommitKeepsNewerReplacement(t *testing.T) {
	svc := newIntegrationService(t)
	t.Cleanup(svc.CloseUploads)
	user := createSpaceTestUser(context.Background(), t, svc, "artist", store.RoleUser)
	ctx := userCtx(context.Background(), user.ID)
	attachment, err := svc.CreateAttachment(ctx, &apipb.CreateAttachmentRequest{Attachment: &apipb.Attachment{
		Filename: "drawing.canvas.png", Type: "image/png", Content: testutil.BuildPNG(4, 4),
	}})
	require.NoError(t, err)

	replace := func(filename string, content []byte) *apipb.UploadAttachmentResponse {
		response, err := svc.UploadAttachment(ctx, &apipb.UploadAttachmentRequest{
			Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
				Attachment:        &apipb.Attachment{Filename: filename, Type: "image/png"},
				TotalSize:         int64(len(content)),
				ReplaceAttachment: attachment.Name,
			}},
			Data:        content,
			FinishWrite: true,
		})
		require.NoError(t, err)
		return response
	}
	first := testutil.BuildPNG(6, 6)
	older := replace("drawing-older.canvas.png", first)
	newer := replace("drawing-newer.canvas.png", testutil.BuildPNG(8, 8))

	// Make the older upload look like its finish failed after the commit.
	upload, err := svc.attachmentUploads.resume(older.UploadId, user.ID)
	require.NoError(t, err)
	upload.complete = false
	upload.mu.Unlock()

	retried, err := svc.UploadAttachment(ctx, &apipb.UploadAttachmentRequest{
		Upload:      &apipb.UploadAttachmentRequest_UploadId{UploadId: older.UploadId},
		WriteOffset: int64(len(first)),
		FinishWrite: true,
	})
	require.NoError(t, err)
	require.Equal(t, newer.Attachment.Filename, retried.Attachment.Filename, "the newer replacement stays")
	require.Equal(t, newer.Attachment.Size, retried.Attachment.Size)
}

// When the reload after a committed replacement fails, the previous file is
// kept for safety. The client's retry then deletes it, but never the file the
// attachment's row points at.
func TestReplaceAttachmentRetryDeletesLeftoverFile(t *testing.T) {
	svc := newIntegrationService(t)
	t.Cleanup(svc.CloseUploads)
	ctx := context.Background()
	_, err := svc.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			Storages:         []*storepb.Storage{{Id: "local", Name: "Local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}},
			DefaultStorageId: "local",
		}},
	})
	require.NoError(t, err)
	user := createSpaceTestUser(ctx, t, svc, "artist", store.RoleUser)
	userCtx := userCtx(ctx, user.ID)
	content := testutil.BuildPNG(4, 4)
	attachment, err := svc.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{Attachment: &apipb.Attachment{
		Filename: "drawing.canvas.png", Type: "image/png", Content: content,
	}})
	require.NoError(t, err)
	uid, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	current, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	currentFile := localPath(svc.Profile.Data, current.Reference)
	require.FileExists(t, currentFile)

	for _, tc := range []struct {
		name       string
		leftover   func() (*store.Attachment, string)
		wantExists bool
	}{
		{
			name: "a file the row no longer points at is deleted",
			leftover: func() (*store.Attachment, string) {
				path := filepath.Join(filepath.Dir(currentFile), "previous.canvas.png")
				require.NoError(t, os.WriteFile(path, content, 0o644))
				previous := *current
				previous.Reference = path
				return &previous, path
			},
		},
		{
			name: "the file the row points at stays",
			leftover: func() (*store.Attachment, string) {
				return current, currentFile
			},
			wantExists: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			leftover, path := tc.leftover()
			started, err := svc.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{
				Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
					Attachment:        &apipb.Attachment{Filename: "drawing.canvas.png", Type: "image/png"},
					TotalSize:         int64(len(content)),
					ReplaceAttachment: attachment.Name,
				}},
				Data: content,
			})
			require.NoError(t, err)
			// The upload's first finish committed, then its reload failed.
			upload, err := svc.attachmentUploads.resume(started.UploadId, user.ID)
			require.NoError(t, err)
			upload.state.replaceCommitted = true
			upload.state.replacedLeftover = leftover
			upload.mu.Unlock()

			retried, err := svc.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{
				Upload:      &apipb.UploadAttachmentRequest_UploadId{UploadId: started.UploadId},
				WriteOffset: int64(len(content)),
				FinishWrite: true,
			})
			require.NoError(t, err)
			require.Equal(t, attachment.Name, retried.Attachment.Name)
			if tc.wantExists {
				require.FileExists(t, path)
			} else {
				require.NoFileExists(t, path)
			}
			require.FileExists(t, currentFile, "the attachment's own file is never deleted")
		})
	}
}

// A retry whose cleanup of the previous file fails still reports the committed
// replacement, and keeps the file queued so the next retry deletes it.
func TestReplaceAttachmentRetryKeepsLeftoverWhenDeleteFails(t *testing.T) {
	svc := newIntegrationService(t)
	t.Cleanup(svc.CloseUploads)
	ctx := context.Background()
	_, err := svc.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			Storages:         []*storepb.Storage{{Id: "local", Name: "Local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}},
			DefaultStorageId: "local",
		}},
	})
	require.NoError(t, err)
	user := createSpaceTestUser(ctx, t, svc, "artist", store.RoleUser)
	userCtx := userCtx(ctx, user.ID)
	content := testutil.BuildPNG(4, 4)
	attachment, err := svc.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{Attachment: &apipb.Attachment{
		Filename: "drawing.canvas.png", Type: "image/png", Content: content,
	}})
	require.NoError(t, err)
	uid, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	current, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)

	// A non-empty directory in place of the previous file: removing it fails.
	stuck := filepath.Join(filepath.Dir(localPath(svc.Profile.Data, current.Reference)), "previous.canvas.png")
	require.NoError(t, os.MkdirAll(stuck, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(stuck, "keep"), content, 0o644))
	leftover := *current
	leftover.Reference = stuck

	started, err := svc.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{
		Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
			Attachment:        &apipb.Attachment{Filename: "drawing.canvas.png", Type: "image/png"},
			TotalSize:         int64(len(content)),
			ReplaceAttachment: attachment.Name,
		}},
		Data: content,
	})
	require.NoError(t, err)
	upload, err := svc.attachmentUploads.resume(started.UploadId, user.ID)
	require.NoError(t, err)
	upload.state.replaceCommitted = true
	upload.state.replacedLeftover = &leftover
	upload.mu.Unlock()

	retry := func() {
		upload, err := svc.attachmentUploads.resume(started.UploadId, user.ID)
		require.NoError(t, err)
		upload.complete = false
		upload.mu.Unlock()
		retried, err := svc.UploadAttachment(userCtx, &apipb.UploadAttachmentRequest{
			Upload:      &apipb.UploadAttachmentRequest_UploadId{UploadId: started.UploadId},
			WriteOffset: int64(len(content)),
			FinishWrite: true,
		})
		require.NoError(t, err, "a failed cleanup does not fail the committed replacement")
		require.Equal(t, attachment.Name, retried.Attachment.Name)
	}
	pendingLeftover := func() *store.Attachment {
		upload, err := svc.attachmentUploads.resume(started.UploadId, user.ID)
		require.NoError(t, err)
		defer upload.mu.Unlock()
		return upload.state.replacedLeftover
	}

	retry()
	require.DirExists(t, stuck)
	require.NotNil(t, pendingLeftover(), "the previous file stays queued for the next retry")

	require.NoError(t, os.Remove(filepath.Join(stuck, "keep")))
	retry()
	require.NoDirExists(t, stuck)
	require.Nil(t, pendingLeftover())
}

func localPath(data, reference string) string {
	path := filepath.FromSlash(reference)
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(data, path)
}

package fileserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/httphandler"
	"github.com/usememos/memos/internal/testutil"
	"github.com/usememos/memos/internal/testutil/fakes3"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/api"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// replaceContent uploads content in one call that replaces the attachment's file.
func replaceContent(ctx context.Context, svc *api.APIService, name, filename string, content []byte) (*apipb.Attachment, error) {
	response, err := svc.UploadAttachment(ctx, &apipb.UploadAttachmentRequest{
		Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
			Attachment:        &apipb.Attachment{Filename: filename, Type: "image/png"},
			TotalSize:         int64(len(content)),
			ReplaceAttachment: name,
		}},
		Data:        content,
		FinishWrite: true,
	})
	if err != nil {
		return nil, err
	}
	return response.Attachment, nil
}

// localFilePath resolves a LOCAL attachment reference the way the store does.
func localFilePath(data, reference string) string {
	path := filepath.FromSlash(reference)
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(data, path)
}

func TestReplaceAttachmentContent(t *testing.T) {
	original, err := os.ReadFile("testdata/v1.canvas.png")
	require.NoError(t, err)
	const bucket = "file-server-attachments"

	for _, storageName := range []string{"database", "local", "s3"} {
		t.Run(storageName, func(t *testing.T) {
			ctx := context.Background()
			svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
			defer cleanup()
			var fake *fakes3.Server
			switch storageName {
			case "database":
				configureDatabaseStorage(ctx, t, stores)
			case "local":
				configureLocalStorage(ctx, t, stores)
			case "s3":
				fake = fakes3.New(t, bucket)
				configureFakeS3Storage(ctx, t, stores, fake)
			default:
				t.Fatalf("unknown storage %q", storageName)
			}

			owner, err := stores.CreateUser(ctx, &store.User{Username: "artist", Role: store.RoleUser, Email: "artist@example.com"})
			require.NoError(t, err)
			ownerCtx := context.WithValue(ctx, auth.UserIDContextKey, owner.ID)
			attachment := createDrawingInline(ownerCtx, t, svc, original)
			memo, err := svc.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
				Content:     "a drawing",
				Visibility:  apipb.Visibility_PUBLIC,
				Attachments: []*apipb.Attachment{{Name: attachment.Name}},
			}})
			require.NoError(t, err)

			uid, err := api.ExtractAttachmentUIDFromName(attachment.Name)
			require.NoError(t, err)
			before, err := stores.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
			require.NoError(t, err)
			// A thumbnail the file server cached for the previous content. The
			// store and the file server share one data directory in a real server.
			thumbnail := filepath.Join(stores.GetDataDir(), ".thumbnail_cache", uid+".v2.jpeg")
			require.NoError(t, os.MkdirAll(filepath.Dir(thumbnail), 0o755))
			require.NoError(t, os.WriteFile(thumbnail, []byte("stale"), 0o644))

			edited := testutil.BuildPNG(8, 8)
			replaced, err := replaceContent(ownerCtx, svc, attachment.Name, "drawing-20261106-130000.canvas.png", edited)
			require.NoError(t, err)

			require.Equal(t, attachment.Name, replaced.Name, "the attachment keeps its name")
			require.Equal(t, "drawing-20261106-130000.canvas.png", replaced.Filename)
			require.Equal(t, int64(len(edited)), replaced.Size)
			require.Equal(t, memo.Name, replaced.GetMemo(), "the attachment stays on its memo")
			require.Equal(t, attachment.CreateTime.AsTime(), replaced.CreateTime.AsTime())
			require.NoFileExists(t, thumbnail, "the cached thumbnail of the previous content is dropped")

			mux := http.NewServeMux()
			fs.RegisterRoutes(mux, http.HandlerFunc(httphandler.NotFound))
			recorder := httptest.NewRecorder()
			mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s", replaced.Name, replaced.Filename), nil))
			require.Equal(t, http.StatusOK, recorder.Code)
			require.Equal(t, edited, recorder.Body.Bytes())

			after, err := stores.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
			require.NoError(t, err)
			require.Equal(t, before.ID, after.ID)
			require.Equal(t, before.StorageType, after.StorageType)

			// The previous file is gone from its storage; the new one is there.
			switch storageName {
			case "local":
				require.FileExists(t, localFilePath(svc.Profile.Data, after.Reference))
				require.NoFileExists(t, localFilePath(svc.Profile.Data, before.Reference))
			case "s3":
				_, err := fake.GetObject(bucket, before.Payload.GetS3Object().GetKey())
				require.Error(t, err)
				_, err = fake.GetObject(bucket, after.Payload.GetS3Object().GetKey())
				require.NoError(t, err)
			default:
				// A database blob is replaced in the row itself.
			}
		})
	}
}

func TestReplaceAttachmentContentRefusals(t *testing.T) {
	ctx := context.Background()
	svc, _, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	content := testutil.BuildPNG(4, 4)

	owner, err := stores.CreateUser(ctx, &store.User{Username: "owner", Role: store.RoleUser, Email: "owner@example.com"})
	require.NoError(t, err)
	other, err := stores.CreateUser(ctx, &store.User{Username: "other", Role: store.RoleUser, Email: "other@example.com"})
	require.NoError(t, err)
	admin, err := stores.CreateUser(ctx, &store.User{Username: "admin", Role: store.RoleAdmin, Email: "admin@example.com"})
	require.NoError(t, err)
	ownerCtx := context.WithValue(ctx, auth.UserIDContextKey, owner.ID)
	otherCtx := context.WithValue(ctx, auth.UserIDContextKey, other.ID)
	adminCtx := context.WithValue(ctx, auth.UserIDContextKey, admin.ID)
	attachment := createDrawingInline(ownerCtx, t, svc, content)

	_, err = replaceContent(otherCtx, svc, attachment.Name, "drawing.canvas.png", content)
	require.Equal(t, codes.PermissionDenied, status.Code(err), "only the uploader or an admin may replace it")

	_, err = replaceContent(ctx, svc, attachment.Name, "drawing.canvas.png", content)
	require.Equal(t, codes.Unauthenticated, status.Code(err))

	_, err = replaceContent(ownerCtx, svc, "attachments/missing", "drawing.canvas.png", content)
	require.Equal(t, codes.NotFound, status.Code(err))

	_, err = svc.UploadAttachment(ownerCtx, &apipb.UploadAttachmentRequest{
		Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
			Attachment:        &apipb.Attachment{Filename: "drawing.canvas.png", Type: "image/png"},
			AttachmentId:      "chosen-id",
			ReplaceAttachment: attachment.Name,
		}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err), "a replacement keeps the attachment's ID")

	linked, err := stores.CreateAttachment(ctx, &store.Attachment{
		UID:         "remote-link",
		CreatorID:   owner.ID,
		Filename:    "remote.png",
		Type:        "image/png",
		StorageType: storepb.AttachmentStorageType_EXTERNAL,
		Reference:   "https://example.com/remote.png",
	})
	require.NoError(t, err)
	_, err = replaceContent(ownerCtx, svc, "attachments/"+linked.UID, "drawing.canvas.png", content)
	require.Equal(t, codes.FailedPrecondition, status.Code(err), "an external link has no stored content")

	// An admin may replace anyone's attachment; the owner keeps it.
	replaced, err := replaceContent(adminCtx, svc, attachment.Name, "drawing-2.canvas.png", content)
	require.NoError(t, err)
	require.Equal(t, attachment.Name, replaced.Name)
	uid, err := api.ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	stored, err := stores.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	require.Equal(t, owner.ID, stored.CreatorID)
}

func TestReplaceAttachmentContentWithMotionPhotoStaysPlain(t *testing.T) {
	ctx := context.Background()
	svc, _, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	owner, err := stores.CreateUser(ctx, &store.User{Username: "owner", Role: store.RoleUser, Email: "owner@example.com"})
	require.NoError(t, err)
	ownerCtx := context.WithValue(ctx, auth.UserIDContextKey, owner.ID)
	attachment := createDrawingInline(ownerCtx, t, svc, testutil.BuildPNG(4, 4))

	motion := testutil.BuildMotionPhotoJPEG()
	response, err := svc.UploadAttachment(ownerCtx, &apipb.UploadAttachmentRequest{
		Upload: &apipb.UploadAttachmentRequest_Spec{Spec: &apipb.UploadAttachmentSpec{
			Attachment:        &apipb.Attachment{Filename: "photo.jpg", Type: "image/jpeg"},
			TotalSize:         int64(len(motion)),
			ReplaceAttachment: attachment.Name,
		}},
		Data:        motion,
		FinishWrite: true,
	})
	require.NoError(t, err)
	require.Nil(t, response.Attachment.MotionMedia, "a replacement is never part of a motion photo")

	// So it can be replaced again.
	_, err = replaceContent(ownerCtx, svc, attachment.Name, "drawing.canvas.png", testutil.BuildPNG(4, 4))
	require.NoError(t, err)
}

func TestReplaceAttachmentContentConcurrently(t *testing.T) {
	ctx := context.Background()
	svc, _, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	configureLocalStorage(ctx, t, stores)
	owner, err := stores.CreateUser(ctx, &store.User{Username: "owner", Role: store.RoleUser, Email: "owner@example.com"})
	require.NoError(t, err)
	ownerCtx := context.WithValue(ctx, auth.UserIDContextKey, owner.ID)
	attachment := createDrawingInline(ownerCtx, t, svc, testutil.BuildPNG(4, 4))

	const replacements = 6
	errs := make(chan error, replacements)
	for i := range replacements {
		go func() {
			_, err := replaceContent(ownerCtx, svc, attachment.Name, fmt.Sprintf("drawing-%d.canvas.png", i), testutil.BuildPNG(4+i, 4+i))
			errs <- err
		}()
	}
	for range replacements {
		require.NoError(t, <-errs)
	}

	// Only the file the row points at is left: no replacement orphaned another's.
	uid, err := api.ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	stored, err := stores.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	files, err := filepath.Glob(filepath.Join(svc.Profile.Data, "assets", "*"))
	require.NoError(t, err)
	require.Equal(t, []string{localFilePath(svc.Profile.Data, stored.Reference)}, files)
}

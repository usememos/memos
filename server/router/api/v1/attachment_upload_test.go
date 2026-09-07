package v1

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/testutil"
	"github.com/usememos/memos/internal/testutil/fakes3"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func newAttachmentUploadTestServer(t *testing.T) (*APIV1Service, *echo.Echo, string, *store.User) {
	t.Helper()
	svc := newIntegrationService(t)
	user := createSpaceTestUser(context.Background(), t, svc, "uploader", store.RoleUser)
	token, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), "ACTIVE", []byte(svc.Secret))
	require.NoError(t, err)
	e := echo.New()
	require.NoError(t, svc.RegisterGateway(context.Background(), e))
	return svc, e, token, user
}

func attachmentMultipartRequest(t *testing.T, metadata string, content io.Reader) *http.Request {
	t.Helper()
	reader, writer := io.Pipe()
	form := multipart.NewWriter(writer)
	contentType := form.FormDataContentType()
	go func() {
		err := form.WriteField("metadata", metadata)
		if err == nil {
			var part io.Writer
			part, err = form.CreateFormFile("file", "upload.bin")
			if err == nil {
				_, err = io.Copy(part, content)
			}
		}
		if err == nil {
			err = form.Close()
		}
		_ = writer.CloseWithError(err)
	}()
	t.Cleanup(func() { _ = reader.Close() })
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments:upload", reader)
	req.Header.Set("Content-Type", contentType)
	return req
}

func serveAttachmentUpload(e *echo.Echo, token string, req *http.Request) *httptest.ResponseRecorder {
	defer req.Body.Close()
	req.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	e.ServeHTTP(response, req)
	return response
}

func requireNoUploadTemps(t *testing.T, svc *APIV1Service) {
	t.Helper()
	require.NoError(t, filepath.WalkDir(svc.Profile.Data, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		require.False(t, strings.HasPrefix(entry.Name(), ".memos-upload-"), path)
		return nil
	}))
}

func setAttachmentUploadLimit(t *testing.T, svc *APIV1Service, mb int64) {
	t.Helper()
	_, err := svc.Store.UpsertInstanceSetting(context.Background(), &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			UploadSizeLimitMb: mb, FilepathTemplate: "assets/{filename}",
		}},
	})
	require.NoError(t, err)
}

type uploadZeroReader struct{}

func (uploadZeroReader) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}

func TestAttachmentUploadLargeFileHasBoundedAllocations(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	setAttachmentUploadLimit(t, svc, 400)
	const size = 300 << 20 // Exceeds the buffered RPC's 256 MiB transport limit.
	req := attachmentMultipartRequest(t, `{"attachment":{"filename":"large.bin","type":"application/octet-stream"}}`, io.LimitReader(uploadZeroReader{}, size))
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	response := serveAttachmentUpload(e, token, req)
	runtime.ReadMemStats(&after)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	require.Less(t, after.TotalAlloc-before.TotalAlloc, uint64(32<<20), "upload must not allocate a file-sized buffer")
	t.Logf("300 MiB upload allocated %.2f MiB", float64(after.TotalAlloc-before.TotalAlloc)/(1<<20))
	attachment := &v1pb.Attachment{}
	require.NoError(t, protojson.Unmarshal(response.Body.Bytes(), attachment))
	require.EqualValues(t, size, attachment.Size)
	info, err := os.Stat(filepath.Join(svc.Profile.Data, "assets/large.bin"))
	require.NoError(t, err)
	require.EqualValues(t, size, info.Size())
	requireNoUploadTemps(t, svc)
}

func TestAttachmentUploadRejectsInvalidRequests(t *testing.T) {
	for _, tc := range []struct {
		name     string
		metadata string
		size     int64
		status   int
	}{
		{"actual size", `{"attachment":{"filename":"a.bin","size":"1"}}`, (1 << 20) + 1, http.StatusRequestEntityTooLarge},
		{"declared size", `{"attachment":{"filename":"a.bin","size":"2097152"}}`, 0, http.StatusRequestEntityTooLarge},
		{"invalid metadata", `{`, 0, http.StatusBadRequest},
		{"oversized metadata", strings.Repeat(" ", attachmentUploadMetadataLimit+1), 0, http.StatusBadRequest},
		{"embedded content", `{"attachment":{"filename":"a.bin","content":"YQ=="}}`, 0, http.StatusBadRequest},
		{"invalid filename", `{"attachment":{"filename":"../a.bin"}}`, 0, http.StatusBadRequest},
		{"missing attachment", `{}`, 0, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, e, token, _ := newAttachmentUploadTestServer(t)
			setAttachmentUploadLimit(t, svc, 1)
			req := attachmentMultipartRequest(t, tc.metadata, io.LimitReader(uploadZeroReader{}, tc.size))
			response := serveAttachmentUpload(e, token, req)
			require.Equal(t, tc.status, response.Code, response.Body.String())
			attachments, err := svc.Store.ListAttachments(context.Background(), &store.FindAttachment{})
			require.NoError(t, err)
			require.Empty(t, attachments)
			requireNoUploadTemps(t, svc)
		})
	}
}

func TestAttachmentUploadAuthAndMemoPermissions(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	// Authentication happens before multipart parsing or reading any content.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments:upload", nil)
	response := serveAttachmentUpload(e, "", req)
	require.Equal(t, http.StatusUnauthorized, response.Code)

	other := createSpaceTestUser(context.Background(), t, svc, "other", store.RoleUser)
	memo, err := svc.CreateMemo(userCtx(context.Background(), other.ID), &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "private memo", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	req = attachmentMultipartRequest(t, fmt.Sprintf(`{"attachment":{"filename":"a.txt","memo":%q}}`, memo.Name), strings.NewReader("content"))
	response = serveAttachmentUpload(e, token, req)
	require.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
	requireNoUploadTemps(t, svc)
}

func TestAttachmentUploadCleansUpFailedTransferAndDatabaseWrite(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	setAttachmentUploadLimit(t, svc, 1)
	req := attachmentMultipartRequest(t, `{"attachmentId":"same-id","attachment":{"filename":"kept.txt"}}`, strings.NewReader("kept"))
	require.Equal(t, http.StatusOK, serveAttachmentUpload(e, token, req).Code)
	req = attachmentMultipartRequest(t, `{"attachmentId":"same-id","attachment":{"filename":"orphan.txt"}}`, strings.NewReader("orphan"))
	require.Equal(t, http.StatusInternalServerError, serveAttachmentUpload(e, token, req).Code)
	require.NoFileExists(t, filepath.Join(svc.Profile.Data, "assets/orphan.txt"))
	kept, err := os.ReadFile(filepath.Join(svc.Profile.Data, "assets/kept.txt"))
	require.NoError(t, err)
	require.Equal(t, "kept", string(kept))

	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	require.NoError(t, form.WriteField("metadata", `{"attachment":{"filename":"partial.txt"}}`))
	part, err := form.CreateFormFile("file", "partial.txt")
	require.NoError(t, err)
	_, err = part.Write(bytes.Repeat([]byte("a"), 4096))
	require.NoError(t, err)
	// Deliberately omit the final boundary, as with a disconnected upload.
	req = httptest.NewRequest(http.MethodPost, "/api/v1/attachments:upload", &body)
	req.Header.Set("Content-Type", form.FormDataContentType())
	require.NotEqual(t, http.StatusOK, serveAttachmentUpload(e, token, req).Code)
	require.NoFileExists(t, filepath.Join(svc.Profile.Data, "assets/partial.txt"))
	requireNoUploadTemps(t, svc)
}

func TestAttachmentUploadConcurrentFiles(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	var wg sync.WaitGroup
	responses := make([]*httptest.ResponseRecorder, 3)
	for i := range responses {
		req := attachmentMultipartRequest(t, fmt.Sprintf(`{"attachment":{"filename":"concurrent-%d.bin"}}`, i), io.LimitReader(uploadZeroReader{}, 8<<20))
		wg.Go(func() { responses[i] = serveAttachmentUpload(e, token, req) })
	}
	wg.Wait()
	for _, response := range responses {
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	}
	requireNoUploadTemps(t, svc)
}

func TestAttachmentUploadKeepsLegacyRouteAndMatchesOnlyUploadAction(t *testing.T) {
	_, e, token, _ := newAttachmentUploadTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments", strings.NewReader(`{"filename":"legacy.txt","content":"aGVsbG8="}`))
	req.Header.Set("Content-Type", "application/json")
	response := serveAttachmentUpload(e, token, req)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	req = httptest.NewRequest(http.MethodPost, "/api/v1/attachments:unknown", nil)
	response = serveAttachmentUpload(e, token, req)
	require.Equal(t, http.StatusNotFound, response.Code, response.Body.String())
}

func TestAttachmentUploadAcceptsEmptyAndExactLimitFiles(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	setAttachmentUploadLimit(t, svc, 1)
	for _, size := range []int64{0, 1 << 20} {
		req := attachmentMultipartRequest(t, `{"attachment":{"filename":"boundary.bin"}}`, io.LimitReader(uploadZeroReader{}, size))
		response := serveAttachmentUpload(e, token, req)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		attachment := &v1pb.Attachment{}
		require.NoError(t, protojson.Unmarshal(response.Body.Bytes(), attachment))
		require.Equal(t, size, attachment.Size)
	}
	requireNoUploadTemps(t, svc)
}

type cancelAttachmentUploadReader struct {
	io.ReadCloser
	remaining int
	cancel    context.CancelFunc
}

func (r *cancelAttachmentUploadReader) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	r.remaining -= n
	if r.remaining <= 0 {
		r.cancel()
	}
	return n, err
}

func TestAttachmentUploadCancellationRemovesPartialFile(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	req := attachmentMultipartRequest(t, `{"attachment":{"filename":"cancelled.bin"}}`, io.LimitReader(uploadZeroReader{}, 1<<20))
	ctx, cancel := context.WithCancel(req.Context())
	defer cancel()
	req = req.WithContext(ctx)
	req.Body = &cancelAttachmentUploadReader{ReadCloser: req.Body, remaining: 64 << 10, cancel: cancel}
	response := serveAttachmentUpload(e, token, req)
	require.NotEqual(t, http.StatusOK, response.Code)
	attachments, err := svc.Store.ListAttachments(context.Background(), &store.FindAttachment{})
	require.NoError(t, err)
	require.Empty(t, attachments)
	requireNoUploadTemps(t, svc)
}

func TestAttachmentUploadProcessesImagesAndPreservesClientMetadata(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	var content bytes.Buffer
	require.NoError(t, jpeg.Encode(&content, image.NewRGBA(image.Rect(0, 0, 2, 3)), nil))
	expected, err := stripImageExif(content.Bytes(), "image/jpeg")
	require.NoError(t, err)
	req := attachmentMultipartRequest(t, `{"attachment":{"filename":"photo.jpg","mediaMetadata":{"width":2,"height":3}}}`, &content)
	response := serveAttachmentUpload(e, token, req)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	attachment := &v1pb.Attachment{}
	require.NoError(t, protojson.Unmarshal(response.Body.Bytes(), attachment))
	require.EqualValues(t, 2, attachment.MediaMetadata.GetWidth())
	require.EqualValues(t, 3, attachment.MediaMetadata.GetHeight())
	uid, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	stored, err := svc.Store.GetAttachment(context.Background(), &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	blob, err := svc.GetAttachmentBlob(context.Background(), stored)
	require.NoError(t, err)
	require.Equal(t, expected, blob)
	require.EqualValues(t, len(blob), attachment.Size)
	requireNoUploadTemps(t, svc)
}

func TestAttachmentUploadS3AndMotionPhoto(t *testing.T) {
	svc, e, token, _ := newAttachmentUploadTestServer(t)
	fake := fakes3.New(t, "uploads")
	_, err := svc.Store.UpsertInstanceSetting(context.Background(), &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			DefaultStorageId: "s3", Storages: []*storepb.Storage{{
				Id: "s3", Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: fake.Config("uploads")},
			}},
		}},
	})
	require.NoError(t, err)
	content := testutil.BuildMotionPhotoJPEG()
	req := attachmentMultipartRequest(t, `{"attachment":{"filename":"motion.jpg"}}`, bytes.NewReader(content))
	response := serveAttachmentUpload(e, token, req)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	attachment := &v1pb.Attachment{}
	require.NoError(t, protojson.Unmarshal(response.Body.Bytes(), attachment))
	require.Equal(t, v1pb.MotionMediaFamily_ANDROID_MOTION_PHOTO, attachment.MotionMedia.GetFamily())
	require.Equal(t, "image/jpeg", attachment.Type)
	uid, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	stored, err := svc.Store.GetAttachment(context.Background(), &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	blob, err := fake.GetObject("uploads", stored.Payload.GetS3Object().Key)
	require.NoError(t, err)
	require.Equal(t, content, blob)
	require.Empty(t, stored.Blob)
	requireNoUploadTemps(t, svc)
}

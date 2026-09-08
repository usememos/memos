package v1

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/testutil"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func newUploadTestService(t *testing.T) (*APIV1Service, context.Context) {
	t.Helper()
	svc := newIntegrationService(t)
	t.Cleanup(svc.CloseAttachmentUploads)
	user := createSpaceTestUser(context.Background(), t, svc, "uploader", store.RoleUser)
	return svc, userCtx(context.Background(), user.ID)
}

func uploadSpec(filename string, size int64) *v1pb.UploadAttachmentRequest_Spec {
	return &v1pb.UploadAttachmentRequest_Spec{Spec: &v1pb.UploadAttachmentSpec{Attachment: &v1pb.Attachment{Filename: filename}, TotalSize: size}}
}

func uploadID(id string) *v1pb.UploadAttachmentRequest_UploadId {
	return &v1pb.UploadAttachmentRequest_UploadId{UploadId: id}
}

func startTestUpload(ctx context.Context, t *testing.T, svc *APIV1Service, size int64) string {
	t.Helper()
	spec := uploadSpec("file.bin", size)
	spec.Spec.Attachment.Type = "application/octet-stream"
	response, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: spec})
	require.NoError(t, err)
	require.NotEmpty(t, response.UploadId)
	require.EqualValues(t, attachmentUploadChunkSize, response.MaxChunkSize)
	require.Zero(t, response.CommittedSize)
	require.Nil(t, response.Attachment)
	return response.UploadId
}

func TestUploadAttachmentChunksAndRetries(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	id := startTestUpload(ctx, t, svc, 6)
	first := &v1pb.UploadAttachmentRequest{Upload: uploadID(id), Data: []byte("abc")}
	for range 2 {
		response, err := svc.UploadAttachment(ctx, first)
		require.NoError(t, err)
		require.Equal(t, id, response.UploadId)
		require.EqualValues(t, 3, response.CommittedSize)
	}
	for _, request := range []*v1pb.UploadAttachmentRequest{
		{Upload: uploadID(id), Data: []byte("xyz")},
		{Upload: uploadID(id), WriteOffset: 4, Data: []byte("d")},
		{Upload: uploadID(id), WriteOffset: -1, Data: []byte("d")},
	} {
		_, err := svc.UploadAttachment(ctx, request)
		require.Equal(t, codes.OutOfRange, status.Code(err))
	}
	progress, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), WriteOffset: -1})
	require.NoError(t, err)
	require.EqualValues(t, 3, progress.CommittedSize)
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), WriteOffset: 3, FinishWrite: true})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	last := &v1pb.UploadAttachmentRequest{Upload: uploadID(id), WriteOffset: 3, Data: []byte("def"), FinishWrite: true}
	result, err := svc.UploadAttachment(ctx, last)
	require.NoError(t, err)
	require.EqualValues(t, 6, result.Attachment.Size)
	for _, request := range []*v1pb.UploadAttachmentRequest{last, {Upload: uploadID(id)}, {Upload: uploadID(id), WriteOffset: 6, FinishWrite: true}} {
		repeated, err := svc.UploadAttachment(ctx, request)
		require.NoError(t, err)
		require.Equal(t, result.Attachment.Name, repeated.Attachment.Name)
	}
	rows, err := svc.Store.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	content, err := os.ReadFile(rows[0].Reference)
	require.NoError(t, err)
	require.Equal(t, "abcdef", string(content))
	require.NoFileExists(t, svc.attachmentUploads.entries[id].path)

	_, err = svc.DeleteAttachment(ctx, &v1pb.DeleteAttachmentRequest{Name: result.Attachment.Name})
	require.NoError(t, err)
	_, err = svc.UploadAttachment(ctx, last)
	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestUploadAttachmentSingleCall(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	spec := uploadSpec("note.txt", 3)
	spec.Spec.AttachmentId = "chosen-id"
	result, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: spec, Data: []byte("abc"), FinishWrite: true})
	require.NoError(t, err)
	require.Equal(t, "attachments/chosen-id", result.Attachment.Name)
	require.EqualValues(t, 3, result.Attachment.Size)
	require.EqualValues(t, 3, result.CommittedSize)

	empty, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadSpec("empty.txt", 0), FinishWrite: true})
	require.NoError(t, err)
	require.Zero(t, empty.Attachment.Size)

	// A spec call may carry the first chunk without finishing.
	partial, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadSpec("two.bin", 4), Data: []byte("ab")})
	require.NoError(t, err)
	require.Nil(t, partial.Attachment)
	require.EqualValues(t, 2, partial.CommittedSize)
	done, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(partial.UploadId), WriteOffset: 2, Data: []byte("cd"), FinishWrite: true})
	require.NoError(t, err)
	require.EqualValues(t, 4, done.Attachment.Size)

	rows, err := svc.Store.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Len(t, rows, 3)
}

func TestUploadAttachmentValidation(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	_, err := svc.UploadAttachment(context.Background(), &v1pb.UploadAttachmentRequest{})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	badID := uploadSpec("file", 0)
	badID.Spec.AttachmentId = "bad id!"
	withContent := uploadSpec("file", 0)
	withContent.Spec.Attachment.Content = []byte("not metadata")
	for _, request := range []*v1pb.UploadAttachmentRequest{
		{},
		{Upload: &v1pb.UploadAttachmentRequest_Spec{Spec: &v1pb.UploadAttachmentSpec{}}},
		{Upload: uploadSpec("file", -1)},
		{Upload: uploadSpec("../file", 0)},
		{Upload: withContent},
		{Upload: badID},
		{Upload: uploadSpec(strings.Repeat("x", attachmentUploadMetadataLimit+1), 0)},
		{Upload: uploadSpec("file", 3), Data: []byte("four")},
	} {
		_, err := svc.UploadAttachment(ctx, request)
		require.Equal(t, codes.InvalidArgument, status.Code(err), request.String())
	}
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadSpec("file", 3), WriteOffset: 1, Data: []byte("abc")})
	require.Equal(t, codes.OutOfRange, status.Code(err))
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadSpec("file", 1<<60)})
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	require.Empty(t, svc.attachmentUploads.entries, "rejected spec calls must not register uploads")

	id := startTestUpload(ctx, t, svc, 3)
	other := createSpaceTestUser(context.Background(), t, svc, "other-uploader", store.RoleUser)
	_, err = svc.UploadAttachment(userCtx(context.Background(), other.ID), &v1pb.UploadAttachmentRequest{Upload: uploadID(id)})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID("unknown")})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), Data: make([]byte, attachmentUploadChunkSize+1)})
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), Data: []byte("four")})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, err = svc.UploadAttachment(canceled, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), Data: []byte("abc")})
	require.Error(t, err)
	progress, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id)})
	require.NoError(t, err)
	require.Zero(t, progress.CommittedSize)
}

func TestUploadAttachmentEmptyAndConcurrentFinish(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	id := startTestUpload(ctx, t, svc, 0)
	var wg sync.WaitGroup
	results := make(chan *v1pb.UploadAttachmentResponse, 8)
	errs := make(chan error, 8)
	for range 8 {
		wg.Go(func() {
			response, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), FinishWrite: true})
			results <- response
			errs <- err
		})
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	name := ""
	for response := range results {
		if name == "" {
			name = response.Attachment.Name
		}
		require.Equal(t, name, response.Attachment.Name)
		require.Zero(t, response.Attachment.Size)
	}
	rows, err := svc.Store.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Len(t, rows, 1)
}

func TestUploadAttachmentFinalizationRecovery(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	id := startTestUpload(ctx, t, svc, 3)
	last := &v1pb.UploadAttachmentRequest{Upload: uploadID(id), Data: []byte("abc"), FinishWrite: true}
	_, err := svc.UploadAttachment(store.WithCreateAttachmentPostCommitFailpoint(ctx), last)
	require.Equal(t, codes.Internal, status.Code(err))
	result, err := svc.UploadAttachment(ctx, last)
	require.NoError(t, err)
	require.NotNil(t, result.Attachment)
	rows, err := svc.Store.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	content, err := os.ReadFile(rows[0].Reference)
	require.NoError(t, err)
	require.Equal(t, "abc", string(content))
}

func TestUploadAttachmentRechecksMemoAndSize(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	memo, err := svc.CreateMemo(ctx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{Content: "upload target"}})
	require.NoError(t, err)
	spec := uploadSpec("file.txt", 3)
	spec.Spec.Attachment.Memo = &memo.Name
	initial, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: spec})
	require.NoError(t, err)
	_, err = svc.DeleteMemo(ctx, &v1pb.DeleteMemoRequest{Name: memo.Name, Force: true})
	require.NoError(t, err)
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(initial.UploadId), Data: []byte("abc"), FinishWrite: true})
	require.Equal(t, codes.NotFound, status.Code(err))

	id := startTestUpload(ctx, t, svc, 2*MebiByte)
	_, err = svc.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{UploadSizeLimitMb: 1}},
	})
	require.NoError(t, err)
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(id), Data: make([]byte, 2*MebiByte), FinishWrite: true})
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	rows, err := svc.Store.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Empty(t, rows)
}

func TestUploadAttachmentExpiryAndLimits(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	ids := make([]string, attachmentUploadMaxActivePerUser)
	for i := range ids {
		ids[i] = startTestUpload(ctx, t, svc, 0)
	}
	_, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadSpec("too-many", 0)})
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(ids[0]), FinishWrite: true})
	require.NoError(t, err)
	startTestUpload(ctx, t, svc, 0) // Completed uploads do not consume an active slot.
	upload := svc.attachmentUploads.entries[ids[1]]
	upload.mu.Lock()
	upload.expireTime = time.Now().Add(-time.Second)
	upload.mu.Unlock()
	_, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(ids[1])})
	require.Equal(t, codes.NotFound, status.Code(err))

	orphan := filepath.Join(svc.Profile.Data, attachmentUploadTempPrefix+"orphan")
	recent := filepath.Join(svc.Profile.Data, attachmentUploadTempPrefix+"recent")
	unrelated := filepath.Join(svc.Profile.Data, "keep.txt")
	for _, path := range []string{orphan, recent, unrelated} {
		require.NoError(t, os.WriteFile(path, []byte("x"), 0600))
	}
	old := time.Now().Add(-2 * attachmentUploadTTL)
	require.NoError(t, os.Chtimes(orphan, old, old))
	require.NoError(t, os.Chtimes(unrelated, old, old))
	svc.attachmentUploads.mu.Lock()
	svc.attachmentUploads.sweepLocked(time.Now(), 0)
	svc.attachmentUploads.removeOrphansLocked(svc.Profile.Data, time.Now())
	svc.attachmentUploads.mu.Unlock()
	require.NoFileExists(t, upload.path)
	require.NoFileExists(t, orphan)
	require.FileExists(t, recent)
	require.FileExists(t, unrelated)
	svc.CloseAttachmentUploads()
	require.Empty(t, svc.attachmentUploads.entries)
}

func TestUploadAttachmentAboveLegacyRequestLimit(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	const size = 300 * MebiByte
	_, err := svc.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{UploadSizeLimitMb: 400}},
	})
	require.NoError(t, err)
	id := startTestUpload(ctx, t, svc, size)
	chunk := bytes.Repeat([]byte{0x5a}, attachmentUploadChunkSize)
	var response *v1pb.UploadAttachmentResponse
	for offset := int64(0); offset < size; offset += int64(len(chunk)) {
		response, err = svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{
			Upload: uploadID(id), WriteOffset: offset, Data: chunk, FinishWrite: offset+int64(len(chunk)) == size,
		})
		require.NoError(t, err)
	}
	require.EqualValues(t, size, response.Attachment.Size)
	rows, err := svc.Store.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	file, err := os.Open(rows[0].Reference)
	require.NoError(t, err)
	defer file.Close()
	info, err := file.Stat()
	require.NoError(t, err)
	require.EqualValues(t, size, info.Size())
	_, err = file.Seek(-int64(len(chunk)), io.SeekEnd)
	require.NoError(t, err)
	tail := make([]byte, len(chunk))
	_, err = io.ReadFull(file, tail)
	require.NoError(t, err)
	require.Equal(t, chunk, tail)
}

func TestUploadAttachmentMediaProcessing(t *testing.T) {
	for _, tc := range []struct {
		name    string
		content []byte
		motion  bool
	}{
		{name: "JPEG", content: testutil.BuildJPEG(20, 10)},
		{name: "motion photo", content: testutil.BuildMotionPhotoJPEG(), motion: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, ctx := newUploadTestService(t)
			metadata := &v1pb.Attachment{Filename: "image.unknown", MediaMetadata: &v1pb.MediaMetadata{Width: proto.Int32(20), Height: proto.Int32(10)}}
			spec := &v1pb.UploadAttachmentRequest_Spec{Spec: &v1pb.UploadAttachmentSpec{Attachment: metadata, TotalSize: int64(len(tc.content))}}
			initial, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: spec})
			require.NoError(t, err)
			result, err := svc.UploadAttachment(ctx, &v1pb.UploadAttachmentRequest{Upload: uploadID(initial.UploadId), Data: tc.content, FinishWrite: true})
			require.NoError(t, err)
			require.Equal(t, "image/jpeg", result.Attachment.Type)
			require.True(t, proto.Equal(metadata.MediaMetadata, result.Attachment.MediaMetadata))
			uid, err := ExtractAttachmentUIDFromName(result.Attachment.Name)
			require.NoError(t, err)
			row, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
			require.NoError(t, err)
			content, err := os.ReadFile(row.Reference)
			require.NoError(t, err)
			if tc.motion {
				require.Equal(t, tc.content, content)
				require.True(t, result.Attachment.MotionMedia.HasEmbeddedVideo)
			} else {
				stripped, err := stripImageExif(bytes.NewReader(tc.content), "image/jpeg")
				require.NoError(t, err)
				require.Equal(t, stripped, content)
			}
		})
	}
}

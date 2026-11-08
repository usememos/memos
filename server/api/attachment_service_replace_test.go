package api

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
	apipb "github.com/usememos/memos/proto/gen/api"
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

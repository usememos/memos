package api

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestConvertAttachmentFromStoreHidesManagedStorageReference(t *testing.T) {
	s3Attachment := &store.Attachment{
		UID:         "s3-image",
		Filename:    "image.png",
		Type:        "image/png",
		StorageType: storepb.AttachmentStorageType_S3,
		Reference:   "https://s3.example.com/presigned-secret",
	}
	require.Empty(t, convertAttachmentFromStore(s3Attachment).ExternalLink)

	externalAttachment := &store.Attachment{
		UID:         "external-image",
		Filename:    "image.png",
		Type:        "image/png",
		StorageType: storepb.AttachmentStorageType_EXTERNAL,
		Reference:   "https://cdn.example.com/image.png",
	}
	require.Equal(t, externalAttachment.Reference, convertAttachmentFromStore(externalAttachment).ExternalLink)
}

// blockingReader parks the first Read until release is closed, so a test can
// hold an upload mid-stream after its storage path has been chosen.
type blockingReader struct {
	once    sync.Once
	started chan struct{}
	release chan struct{}
	content io.Reader
}

func (r *blockingReader) Read(p []byte) (int, error) {
	r.once.Do(func() {
		close(r.started)
		<-r.release
	})
	return r.content.Read(p)
}

// Two uploads of the same filename under a template without {uuid} must not
// share a local path, even when the second one starts while the first is
// still streaming its content.
func TestSaveAttachmentContentKeepsConcurrentSameNameLocalUploadsApart(t *testing.T) {
	ctx := context.Background()
	dataDir := t.TempDir()
	instanceProfile := &profile.Profile{Data: dataDir}
	setting := &storepb.InstanceStorageSetting{
		FilepathTemplate: "assets/{filename}",
		Storages:         []*storepb.Storage{{Id: "local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}},
		DefaultStorageId: "local",
	}

	slow := &blockingReader{
		started: make(chan struct{}),
		release: make(chan struct{}),
		content: strings.NewReader("first upload"),
	}
	first := &store.Attachment{UID: "first-uid", Filename: "image.png", Type: "image/png"}
	firstErr := make(chan error, 1)
	go func() {
		firstErr <- saveAttachmentContent(ctx, instanceProfile, nil, first, setting, slow)
	}()
	select {
	case <-slow.started:
	case err := <-firstErr:
		require.FailNow(t, "first upload returned before reading its content", "%v", err)
	case <-time.After(10 * time.Second):
		require.FailNow(t, "first upload never started reading its content")
	}

	second := &store.Attachment{UID: "second-uid", Filename: "image.png", Type: "image/png"}
	require.NoError(t, saveAttachmentContent(ctx, instanceProfile, nil, second, setting, strings.NewReader("second upload")))
	close(slow.release)
	require.NoError(t, <-firstErr)

	require.NotEqual(t, first.Reference, second.Reference)
	for _, tc := range []struct {
		attachment *store.Attachment
		content    string
	}{
		{first, "first upload"},
		{second, "second upload"},
	} {
		path := filepath.FromSlash(tc.attachment.Reference)
		if !filepath.IsAbs(path) {
			path = filepath.Join(dataDir, path)
		}
		stored, err := os.ReadFile(path)
		require.NoError(t, err)
		require.Equal(t, tc.content, string(stored), tc.attachment.UID)
	}
}

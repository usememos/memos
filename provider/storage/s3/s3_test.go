package s3

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil/fakes3"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// assertObjectLifecycle exercises the full driver contract — upload, download,
// stream (full and ranged), delete — against whichever backend the driver targets.
func assertObjectLifecycle(ctx context.Context, t *testing.T, driver *Driver, key string, content []byte) {
	t.Helper()

	uploadedKey, err := driver.UploadObject(ctx, key, "text/plain", bytes.NewReader(content))
	require.NoError(t, err)
	require.Equal(t, key, uploadedKey)

	downloaded, err := driver.GetObject(ctx, key)
	require.NoError(t, err)
	require.Equal(t, content, downloaded)

	stream, err := driver.GetObjectStream(ctx, key, "")
	require.NoError(t, err)
	streamed, err := io.ReadAll(stream.Body)
	require.NoError(t, err)
	require.NoError(t, stream.Body.Close())
	require.Equal(t, content, streamed)
	require.Equal(t, int64(len(content)), stream.ContentLength)
	require.Empty(t, stream.ContentRange)

	partial, err := driver.GetObjectStream(ctx, key, "bytes=4-9")
	require.NoError(t, err)
	partialContent, err := io.ReadAll(partial.Body)
	require.NoError(t, err)
	require.NoError(t, partial.Body.Close())
	require.Equal(t, content[4:10], partialContent)
	require.Equal(t, int64(len(partialContent)), partial.ContentLength)
	require.Equal(t, fmt.Sprintf("bytes 4-9/%d", len(content)), partial.ContentRange)

	_, err = driver.GetObjectStream(ctx, key, fmt.Sprintf("bytes=%d-", len(content)*2))
	require.ErrorIs(t, err, ErrRangeNotSatisfiable)
	var rangeErr *RangeNotSatisfiableError
	require.ErrorAs(t, err, &rangeErr)
	require.Equal(t, fmt.Sprintf("bytes */%d", len(content)), rangeErr.ContentRange)

	require.NoError(t, driver.DeleteObject(ctx, key))
	_, err = driver.GetObject(ctx, key)
	require.Error(t, err)
}

func TestDriverObjectLifecycle(t *testing.T) {
	ctx := context.Background()
	fake := fakes3.New(t, "attachments")
	driver, err := NewDriver(ctx, fake.Config("attachments"))
	require.NoError(t, err)

	assertObjectLifecycle(ctx, t, driver, "assets/notes/test.txt", []byte("attachment stored in fake S3"))
}

func TestNewDriverCredentials(t *testing.T) {
	t.Setenv("AWS_ACCESS_KEY_ID", "chain-access-key")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "chain-secret")
	t.Setenv("AWS_SESSION_TOKEN", "chain-session")
	t.Setenv("AWS_CONFIG_FILE", filepath.Join(t.TempDir(), "config"))
	t.Setenv("AWS_SHARED_CREDENTIALS_FILE", filepath.Join(t.TempDir(), "credentials"))
	ctx := context.Background()
	newConfig := func(accessKeyID, secret string) *storepb.StorageS3Config {
		return &storepb.StorageS3Config{
			AccessKeyId:     accessKeyID,
			AccessKeySecret: secret,
			Endpoint:        "https://s3.example.com",
			Region:          "us-east-1",
			Bucket:          "memos",
		}
	}

	t.Run("uses configured access keys", func(t *testing.T) {
		driver, err := NewDriver(ctx, newConfig("access-key", "access-secret"))
		require.NoError(t, err)
		creds, err := driver.Client.Options().Credentials.Retrieve(ctx)
		require.NoError(t, err)
		require.Equal(t, "access-key", creds.AccessKeyID)
		require.Equal(t, "access-secret", creds.SecretAccessKey)
		require.Empty(t, creds.SessionToken)
	})

	t.Run("falls back to the default credential chain without access keys", func(t *testing.T) {
		driver, err := NewDriver(ctx, newConfig("", ""))
		require.NoError(t, err)
		creds, err := driver.Client.Options().Credentials.Retrieve(ctx)
		require.NoError(t, err)
		require.Equal(t, "chain-access-key", creds.AccessKeyID)
		require.Equal(t, "chain-secret", creds.SecretAccessKey)
		require.Equal(t, "chain-session", creds.SessionToken)
	})
}

func TestNewDriverInsecureSkipTLSVerify(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "/memos/note.txt", r.URL.Path)
		_, err := w.Write([]byte("stored memo"))
		require.NoError(t, err)
	}))
	defer server.Close()

	newConfig := func(skipVerify bool) *storepb.StorageS3Config {
		return &storepb.StorageS3Config{
			AccessKeyId:           "access-key",
			AccessKeySecret:       "access-secret",
			Endpoint:              server.URL,
			Region:                "us-east-1",
			Bucket:                "memos",
			UsePathStyle:          true,
			InsecureSkipTlsVerify: skipVerify,
		}
	}

	t.Run("rejects self-signed certificate by default", func(t *testing.T) {
		driver, err := NewDriver(context.Background(), newConfig(false))
		require.NoError(t, err)

		_, err = driver.GetObject(context.Background(), "note.txt")
		require.Error(t, err)
		require.ErrorContains(t, err, "certificate")
	})

	t.Run("accepts self-signed certificate when enabled", func(t *testing.T) {
		driver, err := NewDriver(context.Background(), newConfig(true))
		require.NoError(t, err)

		content, err := driver.GetObject(context.Background(), "note.txt")
		require.NoError(t, err)
		require.Equal(t, []byte("stored memo"), content)
	})
}

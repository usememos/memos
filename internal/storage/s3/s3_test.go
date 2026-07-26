package s3

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestNewClientInsecureSkipTLSVerify(t *testing.T) {
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
		client, err := NewClient(context.Background(), newConfig(false))
		require.NoError(t, err)

		_, err = client.GetObject(context.Background(), "note.txt")
		require.Error(t, err)
		require.ErrorContains(t, err, "certificate")
	})

	t.Run("accepts self-signed certificate when enabled", func(t *testing.T) {
		client, err := NewClient(context.Background(), newConfig(true))
		require.NoError(t, err)

		content, err := client.GetObject(context.Background(), "note.txt")
		require.NoError(t, err)
		require.Equal(t, []byte("stored memo"), content)
	})
}

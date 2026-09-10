package v1

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/proto/gen/api/v1/apiv1connect"
	"github.com/usememos/memos/server/auth"
)

type uploadCountingReader struct {
	reader io.Reader
	read   int
}

func (r *uploadCountingReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.read += n
	return n, err
}

func TestUploadAttachmentTransports(t *testing.T) {
	svc, ctx := newUploadTestService(t)
	user, err := svc.fetchCurrentUser(ctx)
	require.NoError(t, err)
	token, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), string(user.RowStatus), []byte(svc.Secret))
	require.NoError(t, err)
	e := echo.New()
	require.NoError(t, svc.RegisterGateway(context.Background(), e))

	for _, path := range []string{"/api/v1/attachments:upload", attachmentUploadProcedure} {
		t.Run(path, func(t *testing.T) {
			call := func(message proto.Message, authenticated bool) *httptest.ResponseRecorder {
				t.Helper()
				data, err := protojson.Marshal(message)
				require.NoError(t, err)
				req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
				req.Header.Set("Content-Type", "application/json")
				if authenticated {
					req.Header.Set("Authorization", "Bearer "+token)
				}
				rec := httptest.NewRecorder()
				e.ServeHTTP(rec, req)
				return rec
			}
			initial := &v1pb.UploadAttachmentRequest{Upload: uploadSpec("file.txt", 3)}
			require.Equal(t, http.StatusUnauthorized, call(initial, false).Code)
			rec := call(initial, true)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			response := &v1pb.UploadAttachmentResponse{}
			require.NoError(t, protojson.Unmarshal(rec.Body.Bytes(), response))
			rec = call(&v1pb.UploadAttachmentRequest{Upload: uploadID(response.UploadId), Data: []byte("abc"), FinishWrite: true}, true)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			require.NoError(t, protojson.Unmarshal(rec.Body.Bytes(), response))
			require.NotNil(t, response.Attachment)

			oversized, err := protojson.Marshal(&v1pb.UploadAttachmentRequest{Data: make([]byte, attachmentUploadRequestLimit)})
			require.NoError(t, err)
			reader := &uploadCountingReader{reader: bytes.NewReader(oversized)}
			req := httptest.NewRequest(http.MethodPost, path, reader)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			rec = httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			require.GreaterOrEqual(t, rec.Code, 400)
			require.LessOrEqual(t, reader.read, attachmentUploadRequestLimit+1, "body must be bounded before decoding")
		})
	}

	t.Run("Connect protobuf and compressed message limit", func(t *testing.T) {
		server := httptest.NewTestServer(t, e)
		client := apiv1connect.NewAttachmentServiceClient(server.Client(), server.URL)
		initial := connect.NewRequest(&v1pb.UploadAttachmentRequest{Upload: uploadSpec("binary.bin", attachmentUploadChunkSize)})
		initial.Header().Set("Authorization", "Bearer "+token)
		response, err := client.UploadAttachment(context.Background(), initial)
		require.NoError(t, err)
		last := connect.NewRequest(&v1pb.UploadAttachmentRequest{Upload: uploadID(response.Msg.UploadId), Data: make([]byte, attachmentUploadChunkSize), FinishWrite: true})
		last.Header().Set("Authorization", "Bearer "+token)
		finished, err := client.UploadAttachment(context.Background(), last)
		require.NoError(t, err)
		require.EqualValues(t, attachmentUploadChunkSize, finished.Msg.Attachment.Size)

		data, err := proto.Marshal(&v1pb.UploadAttachmentRequest{Data: make([]byte, attachmentUploadRequestLimit+1)})
		require.NoError(t, err)
		var compressed bytes.Buffer
		writer := gzip.NewWriter(&compressed)
		_, err = writer.Write(data)
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		req := httptest.NewRequest(http.MethodPost, attachmentUploadProcedure, &compressed)
		req.Header.Set("Content-Type", "application/proto")
		req.Header.Set("Content-Encoding", "gzip")
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		require.Equal(t, http.StatusTooManyRequests, rec.Code, rec.Body.String())
		require.Contains(t, rec.Body.String(), "resource_exhausted")
	})
}

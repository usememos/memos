package test

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
)

func TestSSEHandler_Authentication(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "sse-user")
	require.NoError(t, err)

	token, _, err := auth.GenerateAccessTokenV2(
		user.ID,
		user.Username,
		string(user.Role),
		string(user.RowStatus),
		[]byte(ts.Secret),
	)
	require.NoError(t, err)

	e := echo.New()
	apiv1.RegisterSSERoutes(e, ts.Service.SSEHub, ts.Store, ts.Secret)

	t.Run("no token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/sse", nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("invalid token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/sse", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("valid token returns 200 and stream", func(t *testing.T) {
		// Use a cancellable context so we can close the SSE connection after
		// confirming the headers, preventing the handler's event loop from
		// blocking the test indefinitely.
		reqCtx, cancel := context.WithCancel(context.Background())
		defer cancel()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/sse", nil).WithContext(reqCtx)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		done := make(chan struct{})
		go func() {
			defer close(done)
			e.ServeHTTP(rec, req)
		}()
		// Cancel the context to signal client disconnect, which exits the SSE loop.
		cancel()
		<-done
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "text/event-stream", rec.Header().Get("Content-Type"))
	})

	t.Run("token in query param returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/sse?token="+token, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("valid token streams initial comment and event", func(t *testing.T) {
		server := httptest.NewServer(e)
		defer server.Close()

		reqCtx, cancel := context.WithTimeout(ctx, time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, server.URL+"/api/v1/sse", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := server.Client().Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

		reader := bufio.NewReader(resp.Body)
		line, err := reader.ReadString('\n')
		require.NoError(t, err)
		require.Equal(t, ": connected\n", line)
		line, err = reader.ReadString('\n')
		require.NoError(t, err)
		require.Equal(t, "\n", line)

		ts.Service.SSEHub.Broadcast(&apiv1.SSEEvent{
			Type: apiv1.SSEEventMemoUpdated,
			Name: "memos/streamed",
		})

		line, err = reader.ReadString('\n')
		require.NoError(t, err)
		require.Equal(t, "data: {\"type\":\"memo.updated\",\"name\":\"memos/streamed\"}\n", line)
		line, err = reader.ReadString('\n')
		require.NoError(t, err)
		require.Equal(t, "\n", line)
	})

	t.Run("hub close disconnects stream", func(t *testing.T) {
		server := httptest.NewServer(e)
		defer server.Close()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/api/v1/sse", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := server.Client().Do(req) //nolint:bodyclose // Body is closed after verifying the SSE stream disconnects.
		if err != nil {
			t.Fatal(err)
		}
		body := resp.Body
		defer body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

		ts.Service.SSEHub.Close()

		done := make(chan error, 1)
		go func() {
			_, err := io.ReadAll(body)
			done <- err
		}()

		select {
		case err := <-done:
			require.NoError(t, err)
		case <-time.After(time.Second):
			t.Fatal("SSE stream did not close after hub close")
		}
	})
}

func TestRenameMemoTagStreamsMemoUpdatedEvent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "rename-sse-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	memo, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "stream #old", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	token, _, err := auth.GenerateAccessTokenV2(
		user.ID,
		user.Username,
		string(user.Role),
		string(user.RowStatus),
		[]byte(ts.Secret),
	)
	require.NoError(t, err)

	e := echo.New()
	apiv1.RegisterSSERoutes(e, ts.Service.SSEHub, ts.Store, ts.Secret)
	server := httptest.NewServer(e)
	defer server.Close()

	streamCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(streamCtx, http.MethodGet, server.URL+"/api/v1/sse", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	reader := bufio.NewReader(resp.Body)
	line, err := reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, ": connected\n", line)
	line, err = reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "\n", line)

	renameResp, err := ts.Service.RenameMemoTag(userCtx, &v1pb.RenameMemoTagRequest{OldTag: "old", NewTag: "new"})
	require.NoError(t, err)
	require.Equal(t, int32(1), renameResp.UpdatedMemoCount)

	line, err = reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "data: {\"type\":\"memo.updated\",\"name\":\""+memo.Name+"\"}\n", line)
	line, err = reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "\n", line)
}

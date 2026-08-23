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
		server := httptest.NewTestServer(t, e)
		client := server.Client()

		reqCtx, cancel := context.WithTimeout(ctx, time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, server.URL+"/api/v1/sse", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(req)
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

		_, err = ts.Service.CreateMemo(ts.CreateUserContext(ctx, user.ID), &v1pb.CreateMemoRequest{
			MemoId: "streamed",
			Memo: &v1pb.Memo{
				Content:    "streamed memo",
				Visibility: v1pb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)

		line, err = reader.ReadString('\n')
		require.NoError(t, err)
		require.Equal(t, "data: {\"type\":\"memo.changed\"}\n", line)
		line, err = reader.ReadString('\n')
		require.NoError(t, err)
		require.Equal(t, "\n", line)
	})

	t.Run("hub close disconnects stream", func(t *testing.T) {
		server := httptest.NewTestServer(t, e)
		client := server.Client()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/api/v1/sse", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(req) //nolint:bodyclose // Body is closed after verifying the SSE stream disconnects.
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

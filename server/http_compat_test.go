package server

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

type httpSnapshot struct {
	Method        string
	Path          string
	RequestHeader http.Header
	Status        int
	Header        http.Header
	Body          string
}

// These responses were captured from the Echo implementation before replacing
// the router. Keep the transport boundaries and HTTP error contracts unchanged.
func TestHTTPCompatibility(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	s, err := NewServer(ctx, &profile.Profile{Data: t.TempDir(), InstanceURL: "https://memos.example"}, stores)
	require.NoError(t, err)
	t.Cleanup(func() { s.apiService.CloseUploads(); s.apiService.SSEHub.Close() })
	var snapshots []httpSnapshot
	for _, path := range []string{
		"/healthz", "/healthz/", "/health%7A", "/api", "/api/", "/api/missing", "/api/sse", "/api/sse/",
		"/api/v1", "/api/v1/", "/api/v1/memos", "/file", "/file/", "/file/attachments/missing", "/file/attachments/missing/",
		"/file/attachments/missing/a%2Fb.txt", "/file/attachments/%6dissing/file.txt", "/file/%61ttachments/missing/file.txt",
		"/memos.api", "/memos.api.", "/memos.api.UnknownService/Unknown", "/memos.api.v1.MemoService/ListMemos",
		"/memos/x", "/assets/missing.js", "/index.html", "/robots.txt", "/sitemap.xml",
		"/api//instance/profile", "/api/../healthz", "/api/instance/profile/", "/mcp/",
	} {
		for _, method := range []string{http.MethodGet, http.MethodHead, http.MethodPost, http.MethodOptions} {
			rec := httptest.NewRecorder()
			s.handler.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
			body := rec.Body.String()
			if strings.Contains(strings.ToLower(body), "<!doctype html>") {
				body = "<frontend HTML>"
			}
			header := rec.Header().Clone()
			// The bundled SPA may be rebuilt independently of server code.
			header.Del("Content-Length")
			header.Del("Last-Modified")
			snapshots = append(snapshots, httpSnapshot{Method: method, Path: path, Status: rec.Code, Header: header, Body: body})
		}
	}
	for _, path := range []string{"/healthz", "/api/missing", "/memos/x"} {
		for _, origin := range []string{"https://memos.example", "https://evil.example", "null"} {
			for _, method := range []string{http.MethodGet, http.MethodOptions} {
				req := httptest.NewRequest(method, path, nil)
				req.Header.Set("Origin", origin)
				req.Header.Set("Access-Control-Request-Method", "POST")
				req.Header.Set("Access-Control-Request-Headers", "Authorization,Content-Type")
				rec := httptest.NewRecorder()
				s.handler.ServeHTTP(rec, req)
				body := rec.Body.String()
				if strings.Contains(strings.ToLower(body), "<!doctype html>") {
					body = "<frontend HTML>"
				}
				header := rec.Header().Clone()
				header.Del("Content-Length")
				header.Del("Last-Modified")
				snapshots = append(snapshots, httpSnapshot{Method: method, Path: path, RequestHeader: req.Header, Status: rec.Code, Header: header, Body: body})
			}
		}
	}

	f, err := os.Open("testdata/http_compat.jsonl")
	require.NoError(t, err)
	defer f.Close()
	decoder := json.NewDecoder(f)
	for _, got := range snapshots {
		t.Run(got.Method+" "+got.Path+" "+got.RequestHeader.Get("Origin"), func(t *testing.T) {
			var want httpSnapshot
			require.NoError(t, decoder.Decode(&want))
			if strings.HasPrefix(want.Header.Get("Content-Type"), "application/json") && want.Body != "" {
				require.JSONEq(t, want.Body, got.Body)
				want.Body, got.Body = "", ""
			}
			require.Equal(t, want, got)
		})
	}
	var extra httpSnapshot
	require.ErrorIs(t, decoder.Decode(&extra), io.EOF)
}

func TestHTTPStreaming(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	s, err := NewServer(ctx, &profile.Profile{Data: t.TempDir()}, stores)
	require.NoError(t, err)
	t.Cleanup(func() { s.apiService.CloseUploads(); s.apiService.SSEHub.Close() })
	user, err := stores.CreateUser(ctx, &store.User{Username: "stream-owner", Role: store.RoleUser})
	require.NoError(t, err)
	token, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), string(user.RowStatus), user.PasswordHash, []byte(s.Secret))
	require.NoError(t, err)
	server := httptest.NewTestServer(t, s.handler)
	client := server.Client()
	streamCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(streamCtx, http.MethodGet, server.URL+"/api/sse", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+token)
	response, err := client.Do(req)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusOK, response.StatusCode)
	require.Equal(t, "text/event-stream", response.Header.Get("Content-Type"))
	reader := bufio.NewReader(response.Body)
	line, err := reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, ": connected\n", line)
	line, err = reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "\n", line)

	create, err := http.NewRequestWithContext(streamCtx, http.MethodPost, server.URL+"/api/memos", strings.NewReader(`{"memoId":"streamed","content":"streamed memo"}`))
	require.NoError(t, err)
	create.Header.Set("Authorization", "Bearer "+token)
	create.Header.Set("Content-Type", "application/json")
	created, err := client.Do(create)
	require.NoError(t, err)
	defer created.Body.Close()
	require.Equal(t, http.StatusOK, created.StatusCode)
	line, err = reader.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "data: {\"type\":\"memo.changed\"}\n", line)

	s.apiService.SSEHub.Close()
	_, err = io.ReadAll(reader)
	require.NoError(t, err, "closing the hub must terminate the HTTP stream")
}

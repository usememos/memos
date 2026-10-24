package frontend

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/httphandler"
	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestFrontendService_CacheHeaderRules(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		cacheControl string
		pragma       string
		expires      string
	}{
		{
			name:         "root html is not stored",
			path:         "/",
			cacheControl: frontendHTMLCacheControl,
			pragma:       "no-cache",
			expires:      "0",
		},
		{
			name:         "index html is not stored",
			path:         "/index.html",
			cacheControl: frontendHTMLCacheControl,
			pragma:       "no-cache",
			expires:      "0",
		},
		{
			name:         "spa fallback html is not stored",
			path:         "/memos/publicmemo",
			cacheControl: frontendHTMLCacheControl,
			pragma:       "no-cache",
			expires:      "0",
		},
		{
			name:         "hashed asset is immutable",
			path:         "/assets/index-deadbeef.js",
			cacheControl: frontendHashedAssetCacheControl,
		},
		{
			name:         "stable root asset is revalidated after max age",
			path:         "/logo.webp",
			cacheControl: frontendStaticAssetCacheControl,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			setFrontendCacheHeaders(rec, tt.path)

			require.Equal(t, tt.cacheControl, rec.Header().Get("Cache-Control"))
			require.Equal(t, tt.pragma, rec.Header().Get("Pragma"))
			require.Equal(t, tt.expires, rec.Header().Get("Expires"))
		})
	}
}

func TestFrontendService_StaticCacheHeaders(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)

	e := http.NewServeMux()
	NewFrontendService(&profile.Profile{}, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	tests := []struct {
		name         string
		path         string
		cacheControl string
		pragma       string
		expires      string
	}{
		{
			name:         "root html is not stored",
			path:         "/",
			cacheControl: frontendHTMLCacheControl,
			pragma:       "no-cache",
			expires:      "0",
		},
		{
			name:         "index html is not stored",
			path:         "/index.html",
			cacheControl: frontendHTMLCacheControl,
			pragma:       "no-cache",
			expires:      "0",
		},
		{
			name:         "spa fallback html is not stored",
			path:         "/memos/publicmemo",
			cacheControl: frontendHTMLCacheControl,
			pragma:       "no-cache",
			expires:      "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)

			require.Equal(t, http.StatusOK, rec.Code)
			require.Equal(t, tt.cacheControl, rec.Header().Get("Cache-Control"))
			require.Equal(t, tt.pragma, rec.Header().Get("Pragma"))
			require.Equal(t, tt.expires, rec.Header().Get("Expires"))
		})
	}
}

func TestFrontendService_MissingAssetDoesNotFallbackToIndex(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)

	e := http.NewServeMux()
	NewFrontendService(&profile.Profile{}, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	req := httptest.NewRequest(http.MethodGet, "/assets/missing.js", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestFrontendService_HiddenPathsDoNotFallbackToIndex(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)

	e := http.NewServeMux()
	NewFrontendService(&profile.Profile{}, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	// OAuth Protected Resource Metadata discovery (RFC 9728) probes these
	// paths and reads a 404 as "not advertised"; HTML would break the client.
	for _, requestPath := range []string{
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-protected-resource/mcp",
		"/.well-known/oauth-authorization-server",
		"/.git/config",
		"/u/.hidden",
	} {
		req := httptest.NewRequest(http.MethodGet, requestPath, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code, requestPath)
		require.NotContains(t, rec.Header().Get("Content-Type"), "text/html", requestPath)
	}

	req := httptest.NewRequest(http.MethodGet, "/memos/abc", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Header().Get("Content-Type"), "text/html")
}

func TestFrontendService_SkipsDynamicRoutes(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)

	e := http.NewServeMux()
	NewFrontendService(&profile.Profile{}, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))
	e.Handle("GET /api/test", httphandler.Func(func(w http.ResponseWriter, _ *http.Request) error {
		return httphandler.Text(w, http.StatusOK, "ok")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Header().Get("Cache-Control"))
}

func TestFrontendService_RobotsTXT(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)
	setFrontendAccessMode(ctx, t, testStore, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)
	profile := &profile.Profile{
		InstanceURL: "https://demo.usememos.com/",
	}

	e := http.NewServeMux()
	NewFrontendService(profile, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	req := httptest.NewRequest(http.MethodGet, "/robots.txt", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "text/plain; charset=UTF-8", rec.Header().Get("Content-Type"))
	require.Equal(t, "User-agent: *\nAllow: /\nHost: https://demo.usememos.com\nSitemap: https://demo.usememos.com/sitemap.xml", rec.Body.String())
}

func TestFrontendService_SitemapXML(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)
	setFrontendAccessMode(ctx, t, testStore, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)
	profile := &profile.Profile{
		InstanceURL: "https://demo.usememos.com",
	}

	user, err := testStore.CreateUser(ctx, &store.User{
		Username: "sitemap-owner",
		Role:     store.RoleUser,
		Email:    "sitemap-owner@example.com",
	})
	require.NoError(t, err)

	_, err = testStore.CreateMemo(ctx, &store.Memo{
		UID:        "publicmemo",
		CreatorID:  user.ID,
		Content:    "public memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	_, err = testStore.CreateMemo(ctx, &store.Memo{
		UID:        "privatememo",
		CreatorID:  user.ID,
		Content:    "private memo",
		Visibility: store.Private,
	})
	require.NoError(t, err)

	e := http.NewServeMux()
	NewFrontendService(profile, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	req := httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Header().Get("Content-Type"), "application/xml")
	require.Equal(t, "public, no-cache", rec.Header().Get("Cache-Control"))
	require.Contains(t, rec.Body.String(), `<loc>https://demo.usememos.com/memos/publicmemo</loc>`)
	require.NotContains(t, rec.Body.String(), "privatememo")
}

func TestFrontendService_SitemapRoutesRequireInstanceURL(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)
	setFrontendAccessMode(ctx, t, testStore, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)

	e := http.NewServeMux()
	NewFrontendService(&profile.Profile{}, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	for _, path := range []string{"/robots.txt", "/sitemap.xml"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
	}
}

func TestFrontendService_SitemapRoutesRequirePublicAccess(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)
	setFrontendAccessMode(ctx, t, testStore, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)

	e := http.NewServeMux()
	NewFrontendService(&profile.Profile{InstanceURL: "https://private.example.com"}, testStore).Serve(ctx, e, http.HandlerFunc(httphandler.NotFound))

	for _, path := range []string{"/robots.txt", "/sitemap.xml"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
	}
}

func setFrontendAccessMode(ctx context.Context, t *testing.T, stores *store.Store, mode storepb.InstanceAccessMode) {
	t.Helper()
	_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_ACCESS,
		Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: mode,
		}},
	})
	require.NoError(t, err)
}

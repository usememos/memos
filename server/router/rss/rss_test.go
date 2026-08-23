package rss

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestPublicRSSExcludesComments(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	defer stores.Close()
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)

	user, err := stores.CreateUser(ctx, &store.User{
		Username: "rss-comment-owner",
		Role:     store.RoleUser,
		Email:    "rss-comment-owner@example.com",
	})
	require.NoError(t, err)

	parent, err := stores.CreateMemo(ctx, &store.Memo{
		UID:        "rss-public-parent",
		CreatorID:  user.ID,
		Content:    "public parent should stay in rss",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	_, err = stores.CreateMemoComment(ctx, &store.Memo{
		UID:        "rss-public-comment",
		CreatorID:  user.ID,
		Content:    "public comment should not be in rss",
		Visibility: store.Private,
	}, parent.ID, user.ID)
	require.NoError(t, err)

	service := NewRSSService(stores, markdown.NewService())

	exploreRSS := renderRSS(t, service, "/explore/rss.xml", "")
	require.Contains(t, exploreRSS, "public parent should stay in rss")
	require.NotContains(t, exploreRSS, "public comment should not be in rss")

	userRSS := renderRSS(t, service, "/u/rss-comment-owner/rss.xml", user.Username)
	require.Contains(t, userRSS, "public parent should stay in rss")
	require.NotContains(t, userRSS, "public comment should not be in rss")
}

func TestPrivateInstanceDisablesRSS(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	defer stores.Close()
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)
	service := NewRSSService(stores, nil)

	for _, test := range []struct {
		name     string
		target   string
		username string
	}{
		{name: "explore", target: "/explore/rss.xml"},
		{name: "user", target: "/u/alice/rss.xml", username: "alice"},
	} {
		t.Run(test.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodGet, test.target, strings.NewReader(""))
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if test.username != "" {
				c.SetPathValues(echo.PathValues{{Name: "username", Value: test.username}})
			}

			var err error
			if test.username == "" {
				err = service.GetExploreRSS(c)
			} else {
				err = service.GetUserRSS(c)
			}

			var httpError *echo.HTTPError
			require.ErrorAs(t, err, &httpError)
			require.Equal(t, http.StatusNotFound, httpError.Code)
		})
	}
}

func TestRSSIfNoneMatchRemainsStableAcrossSeconds(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	defer stores.Close()
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)

	user, err := stores.CreateUser(ctx, &store.User{
		Username: "rss-etag-owner",
		Role:     store.RoleUser,
		Email:    "rss-etag-owner@example.com",
	})
	require.NoError(t, err)
	_, err = stores.CreateMemo(ctx, &store.Memo{
		UID:        "rss-etag-stable",
		CreatorID:  user.ID,
		Content:    "stable feed content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	service := NewRSSService(stores, markdown.NewService())
	explore := requestRSS(t, service, "/explore/rss.xml", "", "")
	userFeed := requestRSS(t, service, "/u/rss-etag-owner/rss.xml", user.Username, "")
	require.Equal(t, http.StatusOK, explore.Code)
	require.Equal(t, http.StatusOK, userFeed.Code)
	exploreETag := explore.Header().Get("ETag")
	userETag := userFeed.Header().Get("ETag")
	require.NotEmpty(t, exploreETag)
	require.NotEmpty(t, userETag)

	// The previous request-time channel timestamp changed once per second even
	// when no feed data changed, causing these conditional reads to return 200.
	time.Sleep(1100 * time.Millisecond)
	explore = requestRSS(t, service, "/explore/rss.xml", "", exploreETag)
	userFeed = requestRSS(t, service, "/u/rss-etag-owner/rss.xml", user.Username, userETag)
	require.Equal(t, http.StatusNotModified, explore.Code)
	require.Equal(t, http.StatusNotModified, userFeed.Code)
	require.Equal(t, exploreETag, explore.Header().Get("ETag"))
	require.Equal(t, userETag, userFeed.Header().Get("ETag"))
}

func setInstanceAccessMode(ctx context.Context, t *testing.T, stores *store.Store, mode storepb.InstanceAccessMode) {
	t.Helper()
	_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_ACCESS,
		Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: mode,
		}},
	})
	require.NoError(t, err)
}

func renderRSS(t *testing.T, service *RSSService, target string, username string) string {
	t.Helper()
	rec := requestRSS(t, service, target, username, "")
	require.Equal(t, http.StatusOK, rec.Code)
	return rec.Body.String()
}

func requestRSS(t *testing.T, service *RSSService, target, username, ifNoneMatch string) *httptest.ResponseRecorder {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, target, strings.NewReader(""))
	req.Host = "example.com"
	if ifNoneMatch != "" {
		req.Header.Set("If-None-Match", ifNoneMatch)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if username != "" {
		c.SetPathValues(echo.PathValues{{Name: "username", Value: username}})
	}

	var err error
	if username == "" {
		err = service.GetExploreRSS(c)
	} else {
		err = service.GetUserRSS(c)
	}
	require.NoError(t, err)
	return rec
}

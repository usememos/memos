package rss

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/markdown"
	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// setRSSPublicAccess persists the explicit public-access policy.
func setRSSPublicAccess(ctx context.Context, t *testing.T, stores *store.Store, allow bool) {
	t.Helper()
	_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{AllowPublicAccess: allow},
		},
	})
	require.NoError(t, err)
}

func TestPublicRSSExcludesComments(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	defer stores.Close()

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

	comment, err := stores.CreateMemo(ctx, &store.Memo{
		UID:        "rss-public-comment",
		CreatorID:  user.ID,
		Content:    "public comment should not be in rss",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	_, err = stores.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        comment.ID,
		RelatedMemoID: parent.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	service := NewRSSService(&profile.Profile{InstanceURL: "https://memos.example.com"}, stores, markdown.NewService())
	setRSSPublicAccess(ctx, t, stores, true)

	exploreRSS := renderRSS(t, service, "/explore/rss.xml", "")
	require.Contains(t, exploreRSS, "public parent should stay in rss")
	require.NotContains(t, exploreRSS, "public comment should not be in rss")

	userRSS := renderRSS(t, service, "/u/rss-comment-owner/rss.xml", user.Username)
	require.Contains(t, userRSS, "public parent should stay in rss")
	require.NotContains(t, userRSS, "public comment should not be in rss")
}

func TestPrivateInstanceDisablesRSS(t *testing.T) {
	service := NewRSSService(&profile.Profile{}, nil, nil)

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

func renderRSS(t *testing.T, service *RSSService, target string, username string) string {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, target, strings.NewReader(""))
	req.Host = "example.com"
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
	require.Equal(t, http.StatusOK, rec.Code)
	return rec.Body.String()
}

// TestRSSPublicAccessPolicy verifies that a configured instance URL alone does
// not enable RSS, that explicit public access works with an empty instance URL,
// and that toggling the policy takes effect immediately without a restart.
func TestRSSPublicAccessPolicy(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	defer stores.Close()

	user, err := stores.CreateUser(ctx, &store.User{
		Username: "rss-policy-owner",
		Role:     store.RoleUser,
		Email:    "rss-policy-owner@example.com",
	})
	require.NoError(t, err)
	_, err = stores.CreateMemo(ctx, &store.Memo{
		UID:        "rss-policy-public",
		CreatorID:  user.ID,
		Content:    "policy-gated memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Canonical URL configured, but the explicit policy is absent: private.
	service := NewRSSService(&profile.Profile{InstanceURL: "https://memos.example.com"}, stores, markdown.NewService())
	assertRSSUnavailable := func() {
		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/explore/rss.xml", strings.NewReader(""))
		rec := httptest.NewRecorder()
		var httpError *echo.HTTPError
		require.ErrorAs(t, service.GetExploreRSS(e.NewContext(req, rec)), &httpError)
		require.Equal(t, http.StatusNotFound, httpError.Code)
	}
	assertRSSUnavailable()

	// Public access works even with an empty canonical URL, and the cached
	// private feed does not leak after the policy flips off.
	service = NewRSSService(&profile.Profile{}, stores, markdown.NewService())
	setRSSPublicAccess(ctx, t, stores, true)
	rss := renderRSS(t, service, "/explore/rss.xml", "")
	require.Contains(t, rss, "policy-gated memo")

	setRSSPublicAccess(ctx, t, stores, false)
	assertRSSUnavailable()
}

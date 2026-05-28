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
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

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

	service := NewRSSService(&profile.Profile{}, stores, markdown.NewService())

	exploreRSS := renderRSS(t, service, "/explore/rss.xml", "")
	require.Contains(t, exploreRSS, "public parent should stay in rss")
	require.NotContains(t, exploreRSS, "public comment should not be in rss")

	userRSS := renderRSS(t, service, "/u/rss-comment-owner/rss.xml", user.Username)
	require.Contains(t, userRSS, "public parent should stay in rss")
	require.NotContains(t, userRSS, "public comment should not be in rss")
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

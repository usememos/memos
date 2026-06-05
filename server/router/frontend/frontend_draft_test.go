package frontend

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// Added-guard surface: the sitemap query (frontend.go:150-152) filters only by
// VisibilityList=[PUBLIC] with no RowStatus filter, so a PUBLIC-visibility
// DRAFT leaks into the public sitemap.
//
// Guards that the seeded public draft's UID never appears in /sitemap.xml.
func TestFrontendService_SitemapExcludesDraft(t *testing.T) {
	ctx := context.Background()
	testStore := teststore.NewTestingStore(ctx, t)
	prof := &profile.Profile{InstanceURL: "https://demo.usememos.com"}

	user, err := testStore.CreateUser(ctx, &store.User{
		Username: "sitemap-draft-owner",
		Role:     store.RoleUser,
		Email:    "sitemap-draft-owner@example.com",
	})
	require.NoError(t, err)

	_, err = testStore.CreateMemo(ctx, &store.Memo{
		UID:        "sitemap-public-normal",
		CreatorID:  user.ID,
		RowStatus:  store.Normal,
		Content:    "public normal memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	_, err = testStore.CreateMemo(ctx, &store.Memo{
		UID:        "sitemap-public-draft",
		CreatorID:  user.ID,
		RowStatus:  store.Draft,
		Content:    "public-visibility draft must not be in sitemap",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	e := echo.New()
	NewFrontendService(prof, testStore).Serve(ctx, e)

	req := httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	body := rec.Body.String()
	require.Contains(t, body, `<loc>https://demo.usememos.com/memos/sitemap-public-normal</loc>`)
	require.NotContains(t, body, "sitemap-public-draft",
		"a PUBLIC-visibility DRAFT memo must not leak into the public sitemap")
}

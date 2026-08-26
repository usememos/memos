package v1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/server/router/frontend"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/test"
)

func TestMemoMarkdownRouteServesExactSource(t *testing.T) {
	ctx := context.Background()
	service := newMemoMarkdownTestService(t)
	owner := createSpaceTestUser(ctx, t, service, "markdown-exact-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	content := "# Héllo\n\n```go\nfmt.Println(\"raw\")\n```\n"
	memo := createMemoForMarkdownTest(ownerCtx, t, service, "markdown-exact", content, v1pb.Visibility_PUBLIC)

	e := newMemoMarkdownEcho(service)

	for _, tc := range []struct {
		name   string
		path   string
		accept string
	}{
		{name: "suffix", path: "/memos/" + memoUID(memo) + ".md"},
		{name: "accept", path: "/memos/" + memoUID(memo), accept: "text/markdown"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := performMemoMarkdownRequest(e, tc.path, tc.accept, "", "")
			require.Equal(t, http.StatusOK, response.Code)
			require.Equal(t, content, response.Body.String())
			require.Equal(t, memoMarkdownContentType, response.Header().Get(echo.HeaderContentType))
			require.Equal(t, "no-cache, no-store, must-revalidate", response.Header().Get(echo.HeaderCacheControl))
			require.Equal(t, "no-cache", response.Header().Get("Pragma"))
			require.Equal(t, "0", response.Header().Get("Expires"))
			require.Equal(t, "nosniff", response.Header().Get("X-Content-Type-Options"))
			require.Contains(t, response.Header().Values(echo.HeaderVary), echo.HeaderAccept)
			require.Empty(t, response.Header().Get(echo.HeaderContentDisposition))
		})
	}
}

func TestMemoMarkdownRouteServesEmptyContent(t *testing.T) {
	ctx := context.Background()
	service := newMemoMarkdownTestService(t)
	owner := createSpaceTestUser(ctx, t, service, "markdown-empty-owner", store.RoleUser)
	memo := createMemoForMarkdownTest(userCtx(ctx, owner.ID), t, service, "markdown-empty", "", v1pb.Visibility_PUBLIC)

	response := performMemoMarkdownRequest(newMemoMarkdownEcho(service), "/memos/"+memoUID(memo)+".md", "", "", "")
	require.Equal(t, http.StatusOK, response.Code)
	require.Empty(t, response.Body.String())
}

func TestMemoMarkdownRoutePreservesFrontendFallback(t *testing.T) {
	ctx := context.Background()
	service := newMemoMarkdownTestService(t)
	owner := createSpaceTestUser(ctx, t, service, "markdown-spa-owner", store.RoleUser)
	memo := createMemoForMarkdownTest(userCtx(ctx, owner.ID), t, service, "markdown-spa", "must not leak", v1pb.Visibility_PUBLIC)

	e := echo.New()
	frontend.NewFrontendService(service.Profile, service.Store).Serve(ctx, e)
	service.RegisterMemoMarkdownRoutes(e)

	for _, accept := range []string{"", "text/html,*/*", "*/*"} {
		response := performMemoMarkdownRequest(e, "/memos/"+memoUID(memo), accept, "", "")
		require.Equal(t, http.StatusOK, response.Code)
		require.Contains(t, response.Body.String(), "<html")
		require.NotContains(t, response.Body.String(), "must not leak")
	}
}

func TestMemoMarkdownRouteAcceptQuality(t *testing.T) {
	ctx := context.Background()
	service := newMemoMarkdownTestService(t)
	owner := createSpaceTestUser(ctx, t, service, "markdown-accept-owner", store.RoleUser)
	memo := createMemoForMarkdownTest(userCtx(ctx, owner.ID), t, service, "markdown-accept", "selected", v1pb.Visibility_PUBLIC)
	e := newMemoMarkdownEcho(service)

	for _, tc := range []struct {
		name       string
		accept     string
		wantStatus int
	}{
		{name: "with parameters", accept: "text/html, text/markdown; charset=utf-8; q=0.7", wantStatus: http.StatusOK},
		{name: "zero quality", accept: "text/markdown;q=0,*/*", wantStatus: http.StatusNotFound},
		{name: "wildcard only", accept: "*/*", wantStatus: http.StatusNotFound},
		{name: "malformed range", accept: "text/markdown;q=bogus", wantStatus: http.StatusNotFound},
		{name: "case insensitive", accept: "TEXT/MARKDOWN", wantStatus: http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := performMemoMarkdownRequest(e, "/memos/"+memoUID(memo), tc.accept, "", "")
			require.Equal(t, tc.wantStatus, response.Code)
			if tc.wantStatus == http.StatusOK {
				require.Equal(t, "selected", response.Body.String())
			}
		})
	}
}

func TestMemoMarkdownRoutePermissionParity(t *testing.T) {
	ctx := context.Background()
	service := newMemoMarkdownTestService(t)
	owner := createSpaceTestUser(ctx, t, service, "markdown-owner", store.RoleUser)
	member := createSpaceTestUser(ctx, t, service, "markdown-member", store.RoleUser)
	outsider := createSpaceTestUser(ctx, t, service, "markdown-outsider", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	ownerToken := generateMemoMarkdownAccessToken(t, service, owner)
	memberToken := generateMemoMarkdownAccessToken(t, service, member)
	outsiderToken := generateMemoMarkdownAccessToken(t, service, outsider)

	publicMemo := createMemoForMarkdownTest(ownerCtx, t, service, "markdown-public", "public source", v1pb.Visibility_PUBLIC)
	protectedMemo := createMemoForMarkdownTest(ownerCtx, t, service, "markdown-protected", "protected source", v1pb.Visibility_PROTECTED)
	privateMemo := createMemoForMarkdownTest(ownerCtx, t, service, "markdown-private", "private source", v1pb.Visibility_PRIVATE)

	space, err := service.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{Space: &v1pb.Space{Title: "Markdown space"}, SpaceId: "markdown-space"})
	require.NoError(t, err)
	inviteAndAcceptSpaceTestUser(ctx, t, service, owner, member, space, v1pb.SpaceMember_USER)
	spaceName := space.Name
	spaceMemo := createMemoForMarkdownTest(ownerCtx, t, service, "markdown-space-memo", "space source", v1pb.Visibility_SPACE, &spaceName)

	archivedMemo := createMemoForMarkdownTest(ownerCtx, t, service, "markdown-archived", "archived source", v1pb.Visibility_PRIVATE)
	archivedUID := memoUID(archivedMemo)
	require.NoError(t, service.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: mustStoreMemoID(ctx, t, service, archivedUID), RowStatus: ptr(store.Archived)}))

	e := newMemoMarkdownEcho(service)

	for _, tc := range []struct {
		name       string
		memo       *v1pb.Memo
		token      string
		wantStatus int
		wantBody   string
	}{
		{name: "anonymous public succeeds in public instance", memo: publicMemo, wantStatus: http.StatusOK, wantBody: "public source"},
		{name: "protected anonymous needs credentials", memo: protectedMemo, wantStatus: http.StatusUnauthorized},
		{name: "protected authenticated succeeds", memo: protectedMemo, token: outsiderToken, wantStatus: http.StatusOK, wantBody: "protected source"},
		{name: "private owner succeeds", memo: privateMemo, token: ownerToken, wantStatus: http.StatusOK, wantBody: "private source"},
		{name: "private non-owner denied", memo: privateMemo, token: outsiderToken, wantStatus: http.StatusForbidden},
		{name: "space active member succeeds", memo: spaceMemo, token: memberToken, wantStatus: http.StatusOK, wantBody: "space source"},
		{name: "space non-member denied", memo: spaceMemo, token: outsiderToken, wantStatus: http.StatusForbidden},
		{name: "archived owner succeeds", memo: archivedMemo, token: ownerToken, wantStatus: http.StatusOK, wantBody: "archived source"},
		{name: "archived non-owner hidden", memo: archivedMemo, token: outsiderToken, wantStatus: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := performMemoMarkdownRequest(e, "/memos/"+memoUID(tc.memo)+".md", "", bearer(tc.token), "")
			require.Equal(t, tc.wantStatus, response.Code)
			if tc.wantStatus == http.StatusOK {
				require.Equal(t, tc.wantBody, response.Body.String())
			}
		})
	}

	require.NoError(t, setMemoMarkdownInstanceAccess(ctx, service, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE))
	privateInstanceResponse := performMemoMarkdownRequest(e, "/memos/"+memoUID(publicMemo)+".md", "", "", "")
	require.Equal(t, http.StatusUnauthorized, privateInstanceResponse.Code)
	privateInstanceOwnerResponse := performMemoMarkdownRequest(e, "/memos/"+memoUID(publicMemo)+".md", "", bearer(ownerToken), "")
	require.Equal(t, http.StatusOK, privateInstanceOwnerResponse.Code)
	require.Equal(t, "public source", privateInstanceOwnerResponse.Body.String())

	require.NoError(t, setMemoMarkdownInstanceAccess(ctx, service, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC))
	staleCookieResponse := performMemoMarkdownRequest(e, "/memos/"+memoUID(publicMemo)+".md", "", "", "memos.refresh-token=not-a-valid-token")
	require.Equal(t, http.StatusOK, staleCookieResponse.Code)
	require.Equal(t, "public source", staleCookieResponse.Body.String())
}

func TestMemoMarkdownRouteIgnoresShareToken(t *testing.T) {
	ctx := context.Background()
	service := newMemoMarkdownTestService(t)
	owner := createSpaceTestUser(ctx, t, service, "markdown-share-owner", store.RoleUser)
	memo := createMemoForMarkdownTest(userCtx(ctx, owner.ID), t, service, "markdown-share", "share should not authorize", v1pb.Visibility_PRIVATE)
	shareToken := "markdown-share-token"
	_, err := service.Store.CreateMemoShare(ctx, &store.MemoShare{UID: shareToken, MemoID: mustStoreMemoID(ctx, t, service, memoUID(memo)), CreatorID: owner.ID})
	require.NoError(t, err)

	e := newMemoMarkdownEcho(service)
	for _, path := range []string{
		"/memos/" + memoUID(memo) + ".md?share_token=" + shareToken,
		"/memos/" + memoUID(memo) + "?share_token=" + shareToken,
	} {
		response := performMemoMarkdownRequest(e, path, "text/markdown", "", "")
		require.Equal(t, http.StatusUnauthorized, response.Code)
		require.NotContains(t, response.Body.String(), "share should not authorize")
	}
}

func TestMemoMarkdownRouteUnknownMemoIsNotFound(t *testing.T) {
	response := performMemoMarkdownRequest(newMemoMarkdownEcho(newMemoMarkdownTestService(t)), "/memos/missing-memo.md", "", "", "")
	require.Equal(t, http.StatusNotFound, response.Code)
}

func newMemoMarkdownTestService(t *testing.T) *APIV1Service {
	t.Helper()
	ctx := context.Background()
	st := test.NewTestingStore(ctx, t)
	t.Cleanup(func() { st.Close() })
	p := &profile.Profile{Demo: true, Data: t.TempDir(), Driver: "sqlite", DSN: ":memory:"}
	service := NewAPIV1Service("test-secret", p, st)
	require.NoError(t, setMemoMarkdownInstanceAccess(ctx, service, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC))
	return service
}

func newMemoMarkdownEcho(service *APIV1Service) *echo.Echo {
	e := echo.New()
	service.RegisterMemoMarkdownRoutes(e)
	return e
}

func performMemoMarkdownRequest(e *echo.Echo, target, accept, authorization, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	if accept != "" {
		req.Header.Set(echo.HeaderAccept, accept)
	}
	if authorization != "" {
		req.Header.Set(echo.HeaderAuthorization, authorization)
	}
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	response := httptest.NewRecorder()
	e.ServeHTTP(response, req)
	return response
}

func createMemoForMarkdownTest(creatorCtx context.Context, t *testing.T, service *APIV1Service, memoID, content string, visibility v1pb.Visibility, space ...*string) *v1pb.Memo {
	t.Helper()
	memo := &v1pb.Memo{Content: content, Visibility: visibility}
	if len(space) > 0 {
		memo.Space = space[0]
	}
	created, err := service.CreateMemo(creatorCtx, &v1pb.CreateMemoRequest{MemoId: memoID, Memo: memo})
	require.NoError(t, err)
	return created
}

func memoUID(memo *v1pb.Memo) string {
	return strings.TrimPrefix(memo.Name, "memos/")
}

func setMemoMarkdownInstanceAccess(ctx context.Context, service *APIV1Service, mode storepb.InstanceAccessMode) error {
	_, err := service.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_ACCESS,
		Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: mode,
		}},
	})
	return err
}

func generateMemoMarkdownAccessToken(t *testing.T, service *APIV1Service, user *store.User) string {
	t.Helper()
	token, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), string(user.RowStatus), []byte(service.Secret))
	require.NoError(t, err)
	return token
}

func bearer(token string) string {
	if token == "" {
		return ""
	}
	return "Bearer " + token
}

func mustStoreMemoID(ctx context.Context, t *testing.T, service *APIV1Service, uid string) int32 {
	t.Helper()
	memo, err := service.Store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	require.NoError(t, err)
	require.NotNil(t, memo)
	return memo.ID
}

func ptr[T any](value T) *T {
	return &value
}

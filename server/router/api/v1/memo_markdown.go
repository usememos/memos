package v1

import (
	"context"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/access"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const memoMarkdownContentType = "text/markdown; charset=utf-8"

// RegisterMemoMarkdownRoutes registers native HTTP routes for raw memo Markdown.
func (s *APIV1Service) RegisterMemoMarkdownRoutes(echoServer *echo.Echo) {
	echoServer.GET("/memos/:uid", s.serveMemoMarkdown)
}

func (s *APIV1Service) serveMemoMarkdown(c *echo.Context) error {
	uid, requested := requestedMemoMarkdown(c.Param("uid"), c.Request().Header.Get(echo.HeaderAccept))
	if !requested {
		c.Response().Header().Add(echo.HeaderVary, echo.HeaderAccept)
		return echo.NewHTTPError(http.StatusNotFound, "memo not found")
	}

	ctx := c.Request().Context()
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get memo").Wrap(err)
	}
	if memo == nil {
		return echo.NewHTTPError(http.StatusNotFound, "memo not found")
	}

	if err := s.checkMemoMarkdownAccess(ctx, c, memo); err != nil {
		return err
	}

	setAPIResponseNoStoreHeaders(c.Response().Header())
	c.Response().Header().Set("X-Content-Type-Options", "nosniff")
	c.Response().Header().Add(echo.HeaderVary, echo.HeaderAccept)
	return c.Blob(http.StatusOK, memoMarkdownContentType, []byte(memo.Content))
}

func requestedMemoMarkdown(uidParam, acceptHeader string) (string, bool) {
	uid, hasMarkdownSuffix := strings.CutSuffix(uidParam, ".md")
	if hasMarkdownSuffix {
		return uid, true
	}
	return uidParam, acceptsMemoMarkdown(acceptHeader)
}

func acceptsMemoMarkdown(acceptHeader string) bool {
	for _, mediaRange := range strings.Split(acceptHeader, ",") {
		mediaRange = strings.TrimSpace(mediaRange)
		if mediaRange == "" {
			continue
		}
		mediaType, params, err := mime.ParseMediaType(mediaRange)
		if err != nil || !strings.EqualFold(mediaType, "text/markdown") {
			continue
		}
		if q, ok := params["q"]; ok {
			quality, err := strconv.ParseFloat(q, 64)
			if err != nil || quality <= 0 {
				continue
			}
		}
		return true
	}
	return false
}

func (s *APIV1Service) checkMemoMarkdownAccess(ctx context.Context, c *echo.Context, memo *store.Memo) error {
	allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to resolve instance access policy").Wrap(err)
	}

	facts, err := access.ResolveMemoReadFacts(ctx, s.Store, memo)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to resolve memo access").Wrap(err)
	}

	anonymousContext, err := facts.WithViewer(ctx, s.Store, nil, allowAnonymous, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to resolve memo access").Wrap(err)
	}
	if anonymousDecision := access.CheckMemoReadContext(anonymousContext); anonymousDecision.Allowed() {
		return nil
	}

	viewer, err := s.getMemoMarkdownCurrentUser(ctx, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access").Wrap(err)
	}
	readContext, err := facts.WithViewer(ctx, s.Store, viewer, allowAnonymous, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to resolve memo access").Wrap(err)
	}

	decision := access.CheckMemoReadContext(readContext)
	switch decision.Denial {
	case access.MemoReadDenialNone:
		return nil
	case access.MemoReadDenialNotFound:
		return echo.NewHTTPError(http.StatusNotFound, "memo not found")
	case access.MemoReadDenialUnauthenticated:
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
	default:
		return echo.NewHTTPError(http.StatusForbidden, "forbidden access")
	}
}

func (s *APIV1Service) getMemoMarkdownCurrentUser(ctx context.Context, c *echo.Context) (*store.User, error) {
	authenticator := auth.NewAuthenticator(s.Store, s.Secret)
	return authenticator.AuthenticateToUser(ctx, c.Request().Header.Get(echo.HeaderAuthorization), c.Request().Header.Get("Cookie"))
}

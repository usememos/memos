package api

import (
	"context"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/core/access"
	"github.com/usememos/memos/internal/httphandler"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const memoMarkdownContentType = "text/markdown; charset=utf-8"

// RegisterMemoMarkdownRoutes registers native HTTP routes for raw memo Markdown.
func (s *APIService) RegisterMemoMarkdownRoutes(mux *http.ServeMux, fallback http.Handler) {
	mux.Handle("/memos/{uid}", httphandler.GET(httphandler.Func(func(w http.ResponseWriter, r *http.Request) error {
		w.Header().Add("Vary", "Accept")
		uid, requested := requestedMemoMarkdown(r.PathValue("uid"), strings.Join(r.Header.Values("Accept"), ","))
		if !requested {
			fallback.ServeHTTP(w, r)
			return nil
		}
		return s.serveMemoMarkdown(w, r, uid)
	}), fallback))
}

// serveMemoMarkdown returns the stored source after applying normal memo read policy.
func (s *APIService) serveMemoMarkdown(w http.ResponseWriter, r *http.Request, uid string) error {
	setAPIResponseNoStoreHeaders(w.Header())
	w.Header().Set("X-Content-Type-Options", "nosniff")
	memo, err := s.Store.GetMemo(r.Context(), &store.FindMemo{UID: &uid})
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to get memo", Cause: err}
	}
	if memo == nil {
		return &httphandler.Error{Code: http.StatusNotFound, Message: "memo not found"}
	}
	if err := s.checkMemoMarkdownAccess(r.Context(), r, memo); err != nil {
		return err
	}
	return httphandler.Blob(w, http.StatusOK, memoMarkdownContentType, []byte(memo.Content))
}

// requestedMemoMarkdown removes the optional Markdown suffix and reports whether the request selected Markdown.
func requestedMemoMarkdown(uidParam, acceptHeader string) (string, bool) {
	uid, hasMarkdownSuffix := strings.CutSuffix(uidParam, ".md")
	if hasMarkdownSuffix {
		return uid, true
	}
	return uidParam, acceptsMemoMarkdown(acceptHeader)
}

// acceptsMemoMarkdown reports whether Accept explicitly allows text/markdown with positive quality.
func acceptsMemoMarkdown(acceptHeader string) bool {
	for mediaRange := range strings.SplitSeq(acceptHeader, ",") {
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
			if err != nil || !(quality > 0 && quality <= 1) {
				continue
			}
		}
		return true
	}
	return false
}

// checkMemoMarkdownAccess applies the same read policy used by normal memo API reads.
func (s *APIService) checkMemoMarkdownAccess(ctx context.Context, r *http.Request, memo *store.Memo) error {
	allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to resolve instance access policy", Cause: err}
	}

	facts, err := access.ResolveMemoReadFacts(ctx, s.Store, memo)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to resolve memo access", Cause: err}
	}

	anonymousContext, err := facts.WithViewer(ctx, s.Store, nil, allowAnonymous, nil)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to resolve memo access", Cause: err}
	}
	if anonymousDecision := access.CheckMemoReadContext(anonymousContext); anonymousDecision.Allowed() {
		return nil
	}

	viewer, err := s.getMemoMarkdownCurrentUser(ctx, r)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to get current user", Cause: errors.Wrap(err, "get current user")}
	}
	readContext, err := facts.WithViewer(ctx, s.Store, viewer, allowAnonymous, nil)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to resolve memo access", Cause: err}
	}

	decision := access.CheckMemoReadContext(readContext)
	switch decision.Denial {
	case access.MemoReadDenialNone:
		return nil
	case access.MemoReadDenialNotFound:
		return &httphandler.Error{Code: http.StatusNotFound, Message: "memo not found"}
	case access.MemoReadDenialUnauthenticated:
		return &httphandler.Error{Code: http.StatusUnauthorized, Message: "unauthorized access"}
	default:
		return &httphandler.Error{Code: http.StatusForbidden, Message: "forbidden access"}
	}
}

// getMemoMarkdownCurrentUser resolves the viewer from bearer credentials or the refresh cookie.
func (s *APIService) getMemoMarkdownCurrentUser(ctx context.Context, r *http.Request) (*store.User, error) {
	authenticator := auth.NewAuthenticator(s.Store, s.Secret)
	user, err := authenticator.AuthenticateToUser(ctx, r.Header.Get("Authorization"), r.Header.Get("Cookie"))
	if errors.Is(err, auth.ErrInvalidRefreshToken) {
		return nil, nil
	}
	return user, err
}

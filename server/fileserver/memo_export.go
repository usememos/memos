package fileserver

import (
	"context"
	"io"
	"log/slog"
	"math"
	"mime"
	"net/http"
	"strconv"
	"time"

	"github.com/usememos/memos/core/access"
	"github.com/usememos/memos/core/memoexport"
	"github.com/usememos/memos/internal/httphandler"
	"github.com/usememos/memos/internal/ratelimit"
	"github.com/usememos/memos/store"
)

// memoExportRoute downloads one user's Memos export file. The identifier is
// the username, as for avatars.
const memoExportRoute = "/file/users/{identifier}/export"

// MemoExporter writes one user's Memos export file. The API service
// implements it; the file server owns the HTTP side of an export so the
// archive streams to the client instead of being held in memory.
type MemoExporter interface {
	WriteMemoExport(ctx context.Context, user *store.User, w io.Writer, exportTime time.Time) error
}

// serveMemoExport streams a user's Memos export file to an instance
// administrator. Only one export runs at a time; a second request is refused
// with 429. HEAD runs every check and answers with the headers alone, so a
// client can learn about a refusal before the browser starts a download.
func (s *FileServerService) serveMemoExport(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	if s.MemoExporter == nil {
		return &httphandler.Error{Code: http.StatusNotFound, Message: http.StatusText(http.StatusNotFound)}
	}
	setSecurityHeaders(w)
	w.Header().Set("Cache-Control", privateAttachmentCacheControl)

	caller, err := s.getCurrentUser(ctx, r)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to get current user", Cause: err}
	}
	if caller == nil {
		return &httphandler.Error{Code: http.StatusUnauthorized, Message: "unauthorized access"}
	}
	if !access.IsInstanceAdmin(caller) {
		return &httphandler.Error{Code: http.StatusForbidden, Message: "forbidden access"}
	}

	identifier := r.PathValue("identifier")
	user, err := s.Store.GetUser(ctx, &store.FindUser{Username: &identifier})
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to get user", Cause: err}
	}
	if user == nil {
		return &httphandler.Error{Code: http.StatusNotFound, Message: "user not found"}
	}

	preflight := r.Method == http.MethodHead
	if err := s.admitMemoExport(w, caller, preflight); err != nil {
		return err
	}
	if !preflight {
		defer s.memoExportSemaphore.Release(1)
	}

	exportTime := time.Now().UTC().Truncate(time.Second)
	w.Header().Set("Content-Type", memoexport.MediaType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": memoExportFilename(user.Username, exportTime)}))
	if preflight {
		w.WriteHeader(http.StatusOK)
		return nil
	}

	body := &commitOnWrite{ResponseWriter: w}
	if err := s.MemoExporter.WriteMemoExport(ctx, user, body, exportTime); err != nil {
		if ctx.Err() == nil {
			slog.Error("memo export failed", slog.Int("user", int(user.ID)), slog.Int("caller", int(caller.ID)), slog.Bool("committed", body.committed), slog.Any("error", err))
		}
		// Before the first byte this becomes a JSON 500. After it, the
		// response is already committed and the client receives a truncated
		// archive, which the handler wrapper leaves alone.
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to export memos", Cause: err}
	}
	return nil
}

// admitMemoExport charges the caller's archive budget and takes the export
// lock. A preflight only looks: it consumes no budget and releases the lock at
// once, so it reports what a GET would meet without doing its work.
func (s *FileServerService) admitMemoExport(w http.ResponseWriter, caller *store.User, preflight bool) error {
	key := strconv.Itoa(int(caller.ID))
	if s.RateLimiter != nil {
		var decision ratelimit.Decision
		if preflight {
			decision = s.RateLimiter.Allowed(ratelimit.ScopeArchiveUser, key, 1)
		} else {
			decision = s.RateLimiter.Consume(ratelimit.ScopeArchiveUser, key, 1)
		}
		if !decision.Allowed {
			w.Header().Set("Retry-After", strconv.Itoa(max(int(math.Ceil(decision.RetryAfter.Seconds())), 1)))
			return &httphandler.Error{Code: http.StatusTooManyRequests, Message: "too many exports, try again later"}
		}
	}
	if !s.memoExportSemaphore.TryAcquire(1) {
		if s.RateLimiter != nil && !preflight {
			s.RateLimiter.Refund(ratelimit.ScopeArchiveUser, key, 1)
		}
		return &httphandler.Error{Code: http.StatusTooManyRequests, Message: "another export is running, try again later"}
	}
	if preflight {
		s.memoExportSemaphore.Release(1)
	}
	return nil
}

// memoExportFilename is memos-export-<username>-<YYYYMMDDTHHMMSSZ>.zip, the
// name the export format document specifies.
func memoExportFilename(username string, exportTime time.Time) string {
	return "memos-export-" + memoexport.SafeFilename(username) + "-" + exportTime.UTC().Format("20060102T150405Z") + ".zip"
}

// commitOnWrite records whether any byte reached the client, so a failure
// can be reported as an error response only while that is still possible.
type commitOnWrite struct {
	http.ResponseWriter
	committed bool
}

func (c *commitOnWrite) Write(p []byte) (int, error) {
	c.committed = true
	return c.ResponseWriter.Write(p)
}

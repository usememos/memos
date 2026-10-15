// Package httphandler implements shared HTTP response handling.
package httphandler

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"runtime/debug"

	"github.com/pkg/errors"
)

// Error carries a public HTTP error message and an optional underlying cause.
type Error struct {
	Code    int
	Message string
	Cause   error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.Cause }

// Func adapts an error-returning handler without exposing internal errors.
type Func func(http.ResponseWriter, *http.Request) error

func (f Func) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	restoreURL(r)
	response := &responseWriter{ResponseWriter: w}
	if err := f(response, r); err != nil && !response.committed {
		WriteError(w, r, err)
	}
}

// WriteError preserves the public JSON error envelope, including bodyless HEAD errors.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	code, message := http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)
	var publicError *Error
	if errors.As(err, &publicError) {
		code, message = publicError.Code, publicError.Message
	}
	if r.Method == http.MethodHead {
		w.WriteHeader(code)
		return
	}
	_ = JSON(w, code, map[string]string{"message": message})
}

// JSON sends a JSON response.
func JSON(w http.ResponseWriter, code int, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return Blob(w, code, "application/json", append(body, '\n'))
}

// Blob sends bytes with the given content type.
func Blob(w http.ResponseWriter, code int, contentType string, body []byte) error {
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.WriteHeader(code)
	_, err := w.Write(body)
	return err
}

// Text sends a UTF-8 plain text response.
func Text(w http.ResponseWriter, code int, body string) error {
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "text/plain; charset=UTF-8")
	}
	w.WriteHeader(code)
	_, err := io.WriteString(w, body)
	return err
}

// NotFound sends the application's router-level 404 response.
func NotFound(w http.ResponseWriter, r *http.Request) {
	WriteError(w, r, &Error{Code: http.StatusNotFound, Message: http.StatusText(http.StatusNotFound)})
}

// GET preserves explicit GET-only routes, without implicitly accepting HEAD.
// Other methods go to fallback when a broader route exists.
func GET(handler, fallback http.Handler) http.Handler {
	return getHandler{handler: handler, fallback: fallback}
}

type getHandler struct {
	handler, fallback http.Handler
}

// AllowedMethods returns the Allow header for a route without a broader fallback.
func (h getHandler) AllowedMethods() string {
	if h.fallback != nil {
		return ""
	}
	return "OPTIONS, GET"
}

func (h getHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	restoreURL(r)
	if r.Method == http.MethodGet {
		h.handler.ServeHTTP(w, r)
		return
	}
	if h.fallback != nil {
		h.fallback.ServeHTTP(w, r)
		return
	}
	w.Header().Set("Allow", h.AllowedMethods())
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	WriteError(w, r, &Error{Code: http.StatusMethodNotAllowed, Message: http.StatusText(http.StatusMethodNotAllowed)})
}

type originalURLKey struct{}

// RoutingRequest preserves literal escaped segments during ServeMux matching.
// The previous router matched RawPath without unescaping parameters. Handlers
// still receive the original URL, with PathValue populated by ServeMux.
func RoutingRequest(r *http.Request) *http.Request {
	if r.URL.RawPath == "" {
		return r
	}
	request := r.WithContext(context.WithValue(r.Context(), originalURLKey{}, r.URL))
	requestURL := *r.URL
	requestURL.Path, requestURL.RawPath = r.URL.RawPath, ""
	request.URL = &requestURL
	return request
}

func restoreURL(r *http.Request) {
	if original, ok := r.Context().Value(originalURLKey{}).(*url.URL); ok {
		r.URL = original
	}
}

// Recover turns panics before a response into JSON 500s, leaving started streams intact.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := &responseWriter{ResponseWriter: w}
		defer func() {
			if recovered := recover(); recovered != nil {
				if recovered == http.ErrAbortHandler {
					panic(recovered)
				}
				slog.Error("HTTP handler panic", "panic", recovered, "stack", string(debug.Stack()))
				if !response.committed {
					WriteError(w, r, errors.New("handler panic"))
				}
			}
		}()
		next.ServeHTTP(response, r)
	})
}

type responseWriter struct {
	http.ResponseWriter
	committed bool
}

func (w *responseWriter) WriteHeader(code int) {
	if code >= 200 {
		w.committed = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *responseWriter) Write(body []byte) (int, error) {
	w.committed = true
	return w.ResponseWriter.Write(body)
}

func (w *responseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *responseWriter) Flush() {
	_ = w.FlushError()
}

// FlushError propagates flush errors to http.ResponseController callers.
func (w *responseWriter) FlushError() error {
	w.committed = true
	return http.NewResponseController(w.ResponseWriter).Flush()
}

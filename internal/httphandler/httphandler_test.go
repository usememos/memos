package httphandler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestErrorResponses(t *testing.T) {
	for _, test := range []struct {
		name   string
		err    error
		method string
		status int
		body   string
	}{
		{"internal error is hidden", errors.New("database password"), http.MethodGet, 500, "{\"message\":\"Internal Server Error\"}\n"},
		{"wrapped public error", errors.Wrap(&Error{Code: 403, Message: "forbidden", Cause: errors.New("private detail")}, "context"), http.MethodGet, 403, "{\"message\":\"forbidden\"}\n"},
		{"HEAD has no error body", &Error{Code: 404, Message: "missing"}, http.MethodHead, 404, ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			Func(func(http.ResponseWriter, *http.Request) error { return test.err }).ServeHTTP(rec, httptest.NewRequest(test.method, "/", nil))
			require.Equal(t, test.status, rec.Code)
			require.Equal(t, test.body, rec.Body.String())
			if test.method == http.MethodHead {
				require.Empty(t, rec.Header().Get("Content-Type"))
			} else {
				require.Equal(t, "application/json", rec.Header().Get("Content-Type"))
			}
		})
	}
}

func TestStartedResponseIsNotReplaced(t *testing.T) {
	for _, test := range []struct {
		name  string
		panic bool
	}{
		{"write error", false},
		{"panic", true},
	} {
		t.Run(test.name, func(t *testing.T) {
			handler := Recover(Func(func(w http.ResponseWriter, _ *http.Request) error {
				w.Header().Set("Content-Type", "text/event-stream")
				_, err := io.WriteString(w, ": connected\n\n")
				require.NoError(t, err)
				require.NoError(t, http.NewResponseController(w).Flush())
				if test.panic {
					panic("stream failed")
				}
				return errors.New("client disconnected")
			}))
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
			require.Equal(t, http.StatusOK, rec.Code)
			require.True(t, rec.Flushed)
			require.Equal(t, "text/event-stream", rec.Header().Get("Content-Type"))
			require.Equal(t, ": connected\n\n", rec.Body.String())
		})
	}
}

type flushErrorWriter struct {
	http.ResponseWriter
	err error
}

func (w flushErrorWriter) FlushError() error { return w.err }

func TestFlushErrorPropagation(t *testing.T) {
	failure := errors.New("flush failed")
	for _, test := range []struct {
		name    string
		writer  func(http.ResponseWriter) http.ResponseWriter
		wantErr error
	}{
		{"underlying failure", func(w http.ResponseWriter) http.ResponseWriter { return flushErrorWriter{w, failure} }, failure},
		{"unsupported flush", func(w http.ResponseWriter) http.ResponseWriter { return struct{ http.ResponseWriter }{w} }, http.ErrNotSupported},
	} {
		t.Run(test.name, func(t *testing.T) {
			handler := Recover(Func(func(w http.ResponseWriter, _ *http.Request) error {
				require.ErrorIs(t, http.NewResponseController(w).Flush(), test.wantErr)
				return errors.New("error after flush")
			}))
			rec := httptest.NewRecorder()
			handler.ServeHTTP(test.writer(rec), httptest.NewRequest(http.MethodGet, "/", nil))
			require.Empty(t, rec.Body.String(), "a flush must prevent appending an error response")
		})
	}
}

func TestRecoverBeforeResponse(t *testing.T) {
	handler := Recover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("private detail") }))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.JSONEq(t, `{"message":"Internal Server Error"}`, rec.Body.String())

	abort := Recover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) }))
	require.PanicsWithValue(t, http.ErrAbortHandler, func() {
		abort.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	})
}

func TestJSONFailureBeforeCommit(t *testing.T) {
	rec := httptest.NewRecorder()
	Func(func(w http.ResponseWriter, _ *http.Request) error {
		return JSON(w, http.StatusCreated, make(chan int))
	}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.JSONEq(t, `{"message":"Internal Server Error"}`, rec.Body.String())
}

func TestErrorPreservesExistingContentType(t *testing.T) {
	rec := httptest.NewRecorder()
	Func(func(w http.ResponseWriter, _ *http.Request) error {
		w.Header().Set("Content-Type", "video/mp4")
		return &Error{Code: http.StatusRequestedRangeNotSatisfiable, Message: "requested range not satisfiable"}
	}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	require.Equal(t, http.StatusRequestedRangeNotSatisfiable, rec.Code)
	require.Equal(t, "video/mp4", rec.Header().Get("Content-Type"))
	require.JSONEq(t, `{"message":"requested range not satisfiable"}`, rec.Body.String())
}

func TestRoutingPreservesEscapedParametersAndOriginalURL(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("/file/{uid}/{filename}", GET(Func(func(w http.ResponseWriter, r *http.Request) error {
		require.Equal(t, "abc%31", r.PathValue("uid"))
		require.Equal(t, "a%2Fb.txt", r.PathValue("filename"))
		require.Equal(t, "/file/abc1/a/b.txt", r.URL.Path)
		require.Equal(t, "/file/abc%31/a%2Fb.txt", r.URL.RawPath)
		require.Equal(t, "true", r.URL.Query().Get("thumbnail"))
		return Text(w, http.StatusOK, "ok")
	}), nil))
	r := httptest.NewRequest(http.MethodGet, "/file/abc%31/a%2Fb.txt?thumbnail=true", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, RoutingRequest(r))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "ok", rec.Body.String())
	require.Equal(t, "/file/abc1/a/b.txt", r.URL.Path, "routing must not mutate the caller's URL")
}

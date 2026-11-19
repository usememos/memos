package requesthost

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMiddleware(t *testing.T) {
	t.Parallel()

	var got string
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = FromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	r := httptest.NewRequest(http.MethodPost, "https://memos.example/api/v1/auth/sso/state", nil)
	r.Host = "memos.example"
	handler.ServeHTTP(httptest.NewRecorder(), r)
	require.Equal(t, "memos.example", got)
}

func TestFromContextWithoutMiddleware(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	require.Empty(t, FromContext(r.Context()))
}

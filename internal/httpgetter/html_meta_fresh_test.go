package httpgetter

import (
	"context"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestFreshMetadataBypassesCacheAndNormalFlight(t *testing.T) {
	// Given a cached page and an independently blocked ordinary flight.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var calls atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		call := calls.Add(1)
		if req.URL.Path == "/flight" && call == 2 {
			close(started)
			select {
			case <-release:
			case <-req.Context().Done():
				return nil, req.Context().Err()
			}
			return response(req, 200, "text/html", "<title>ordinary</title>"), nil
		}
		return response(req, 200, "text/html", "<title>fresh</title>"), nil
	}))
	fetcher.setCached("https://example.com/cached", &HTMLMeta{Title: "cached"}, nil, time.Hour)
	// When requesting fresh metadata, neither the cache nor the normal flight wins.
	fresh, err := fetcher.GetFresh(ctx, "https://example.com/cached")
	require.NoError(t, err)
	require.Equal(t, "fresh", fresh.Title)
	ordinary, err := fetcher.Get(ctx, "https://example.com/cached")
	require.NoError(t, err)
	require.Equal(t, "cached", ordinary.Title)
	done := make(chan error, 1)
	go func() { _, err := fetcher.Get(ctx, "https://example.com/flight"); done <- err }()
	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	fresh, err = fetcher.GetFresh(ctx, "https://example.com/flight")
	require.NoError(t, err)
	require.Equal(t, "fresh", fresh.Title)
	releaseOnce.Do(func() { close(release) })
	require.NoError(t, <-done)
	// Then both flights sent their own request and cache bypass fetched once.
	require.Equal(t, int32(3), calls.Load())
}

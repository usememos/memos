package httpgetter

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHTMLMetaFetcherImageSizeLimit(t *testing.T) {
	for _, size := range []int{maxCoverImageBytes, maxCoverImageBytes + 1} {
		t.Run(strconv.Itoa(size), func(t *testing.T) {
			// Given an image response at or beyond the download limit.
			fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return response(req, http.StatusOK, "image/png", strings.Repeat("x", size)), nil
			}))

			// When downloading the image.
			image, err := fetcher.GetImage(context.Background(), "http://example.com/cover.png")

			// Then oversized images are rejected instead of cached as truncated blobs.
			if size > maxCoverImageBytes {
				require.Error(t, err)
				require.Nil(t, image)
				return
			}
			require.NoError(t, err)
			require.Len(t, image.Blob, size)
		})
	}
}

func TestHTMLMetaFetcherLimitsConcurrentImagesAndCancelsWaiters(t *testing.T) {
	var inFlight, maximum atomic.Int32
	release := make(chan struct{})
	entered := make(chan struct{}, maxConcurrentFetches+1)
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		current := inFlight.Add(1)
		defer inFlight.Add(-1)
		for {
			seen := maximum.Load()
			if current <= seen || maximum.CompareAndSwap(seen, current) {
				break
			}
		}
		entered <- struct{}{}
		select {
		case <-release:
			return response(req, http.StatusOK, "image/png", "x"), nil
		case <-req.Context().Done():
			return nil, req.Context().Err()
		}
	}))

	var wait sync.WaitGroup
	for range maxConcurrentFetches {
		wait.Add(1)
		go func() {
			defer wait.Done()
			_, _ = fetcher.GetImage(context.Background(), "http://example.com/cover.png")
		}()
	}
	for range maxConcurrentFetches {
		<-entered
	}
	waitCtx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := fetcher.GetImage(waitCtx, "http://example.com/waiting.png")
	require.ErrorIs(t, err, context.Canceled)
	require.Len(t, entered, 0, "cancelled waiter must not issue an HTTP request")
	close(release)
	wait.Wait()
	require.Equal(t, int32(maxConcurrentFetches), maximum.Load())

	_, err = fetcher.GetImage(context.Background(), "http://example.com/recovered.png")
	require.NoError(t, err, "all permits must be returned")
}

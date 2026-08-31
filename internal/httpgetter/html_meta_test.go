package httpgetter

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestExtractDocumentMetadataPrecedenceAndFallbacks(t *testing.T) {
	tests := []struct {
		name     string
		markup   string
		expected HTMLMeta
	}{
		{
			name: "Open Graph wins field by field",
			markup: `<html><head>
				<title>Standard title</title>
				<meta name="description" content="Standard description">
				<meta property="og:title" content="Open Graph title">
				<meta name="twitter:title" content="Twitter title">
				<meta name="twitter:description" content="Twitter description">
				<meta name="twitter:image" content="/twitter.png">
			</head></html>`,
			expected: HTMLMeta{
				Title:       "Open Graph title",
				Description: "Twitter description",
				Image:       "https://example.com/twitter.png",
			},
		},
		{
			name: "JSON-LD graph and image object",
			markup: `<html><head><script type="application/ld+json">{
				"@graph": [
					{"@type":"Organization","name":"Publisher"},
					{"@type":"NewsArticle","headline":"JSON-LD title","description":"JSON-LD description","image":{"contentUrl":"images/cover.jpg"}}
				]
			}</script></head></html>`,
			expected: HTMLMeta{
				Title:       "JSON-LD title",
				Description: "JSON-LD description",
				Image:       "https://example.com/posts/images/cover.jpg",
			},
		},
		{
			name: "nested JSON-LD main entity",
			markup: `<html><head><script type="application/ld+json">{
				"@type":"WebPage",
				"mainEntity":{
					"@type":"Article",
					"headline":"Nested article title",
					"description":"Nested article description",
					"image":"/nested.png"
				}
			}</script></head></html>`,
			expected: HTMLMeta{
				Title:       "Nested article title",
				Description: "Nested article description",
				Image:       "https://example.com/nested.png",
			},
		},
		{
			name: "standard metadata",
			markup: `<html><head><title>Standard title</title>
				<meta NAME="Description" content="Standard description">
				<link rel="IMAGE_SRC" href="/standard.png">
			</head></html>`,
			expected: HTMLMeta{
				Title:       "Standard title",
				Description: "Standard description",
				Image:       "https://example.com/standard.png",
			},
		},
		{
			name: "semantic main content",
			markup: `<html><body><nav><h1>Navigation title</h1></nav><main>
				<h1>Semantic title</h1>
				<p>This paragraph is deliberately long enough to become the semantic preview description.</p>
				<img src="./semantic.png">
			</main></body></html>`,
			expected: HTMLMeta{
				Title:       "Semantic title",
				Description: "This paragraph is deliberately long enough to become the semantic preview description.",
				Image:       "https://example.com/posts/semantic.png",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			meta := extractTestMetadata(t, test.markup)
			require.Equal(t, test.expected, *meta)
		})
	}
}

func TestExtractJSONLDImageForms(t *testing.T) {
	tests := []struct {
		name  string
		image string
		want  string
	}{
		{name: "string", image: `"/one.png"`, want: "https://example.com/one.png"},
		{name: "array", image: `["data:image/png;base64,abc", "/two.png"]`, want: "https://example.com/two.png"},
		{name: "url object", image: `{"url":"/three.png"}`, want: "https://example.com/three.png"},
		{name: "content URL object", image: `{"url":"javascript:alert(1)","contentUrl":"/four.png"}`, want: "https://example.com/four.png"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			markup := `<script type="application/ld+json">{"@type":"Article","headline":"Title","image":` + test.image + `}</script>`
			meta := extractTestMetadata(t, markup)
			require.Equal(t, test.want, meta.Image)
		})
	}
}

func TestExtractDocumentMetadataNormalizesAndTruncatesText(t *testing.T) {
	markup := `<html><head><meta property="og:title" content="  ` + strings.Repeat("A", maxTitleRunes+25) + `&#10;   title  ">
		<meta property="og:description" content="` + strings.Repeat("界", maxDescriptionRunes+25) + `"></head></html>`
	meta := extractTestMetadata(t, markup)

	require.Len(t, []rune(meta.Title), maxTitleRunes)
	require.NotContains(t, meta.Title, "  ")
	require.True(t, strings.HasSuffix(meta.Title, "…"))
	require.Len(t, []rune(meta.Description), maxDescriptionRunes)
	require.True(t, strings.HasSuffix(meta.Description, "…"))
}

func TestExtractDocumentMetadataSkipsUnsafeImages(t *testing.T) {
	markup := `<html><head>
		<meta property="og:image" content="javascript:alert(1)">
		<meta property="og:image" content="/safe.png">
	</head></html>`
	meta := extractTestMetadata(t, markup)
	require.Equal(t, "https://example.com/safe.png", meta.Image)
}

func TestHTMLMetaFetcherOEmbed(t *testing.T) {
	var requests atomic.Int32
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		requests.Add(1)
		switch req.URL.Path {
		case "/post":
			return htmlResponse(req, `<html><head>
				<link rel="alternate" type="Application/JSON+OEMBED; charset=utf-8" href="/oembed">
				<meta property="og:title" content="Open Graph title">
				<meta property="og:description" content="Open Graph description">
				<meta property="og:image" content="/og.png">
			</head></html>`), nil
		case "/oembed":
			assert.Contains(t, req.Header.Get("Accept"), "application/json+oembed")
			return response(req, http.StatusOK, "application/json+oembed", `{
				"type":"rich","title":"oEmbed title","description":"oEmbed description",
				"thumbnail_url":"/oembed.png","html":"<script>must not be returned</script>"
			}`), nil
		default:
			return nil, errors.New("unexpected request path: " + req.URL.Path)
		}
	}))

	meta, err := fetcher.Get(context.Background(), "http://93.184.216.34/post")
	require.NoError(t, err)
	require.Equal(t, &HTMLMeta{
		Title:       "oEmbed title",
		Description: "oEmbed description",
		Image:       "http://93.184.216.34/oembed.png",
	}, meta)
	require.EqualValues(t, 2, requests.Load())
}

func TestHTMLMetaFetcherIgnoresInvalidOEmbed(t *testing.T) {
	tests := []struct {
		name        string
		endpoint    string
		contentType string
		body        string
		wantCalls   int32
	}{
		{name: "unsupported content type", endpoint: "/oembed", contentType: "text/html", body: `<p>not JSON</p>`, wantCalls: 2},
		{name: "oversized response", endpoint: "/oembed", contentType: "application/json", body: strings.Repeat("x", maxOEmbedBytes+1), wantCalls: 2},
		{name: "unsafe endpoint", endpoint: "http://127.0.0.1/oembed", contentType: "application/json", body: `{}`, wantCalls: 1},
		{name: "XML discovery", endpoint: "/oembed", contentType: "application/json", body: `{}`, wantCalls: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var calls atomic.Int32
			fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
				call := calls.Add(1)
				if call == 1 {
					discoveryType := "application/json+oembed"
					if test.name == "XML discovery" {
						discoveryType = "text/xml+oembed"
					}
					return htmlResponse(req, `<link rel="alternate" type="`+discoveryType+`" href="`+test.endpoint+`">
						<meta property="og:title" content="Fallback title">`), nil
				}
				return response(req, http.StatusOK, test.contentType, test.body), nil
			}))

			meta, err := fetcher.Get(context.Background(), "http://93.184.216.34/post")
			require.NoError(t, err)
			require.Equal(t, "Fallback title", meta.Title)
			require.Equal(t, test.wantCalls, calls.Load())
		})
	}
}

func TestHTMLMetaFetcherBotAwareSPA(t *testing.T) {
	transport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		assert.Contains(t, req.Header.Get("Accept"), "text/html")
		if req.Header.Get("User-Agent") == defaultLinkPreviewUserAgent {
			return htmlResponse(req, `<meta property="og:title" content="Rich SPA title">
				<meta property="og:description" content="Prerendered for MemosBot">`), nil
		}
		return htmlResponse(req, `<title>Application shell</title><div id="root"></div>`), nil
	})

	fetcher := newTestFetcher(transport)
	meta, err := fetcher.Get(context.Background(), "http://93.184.216.34/spa")
	require.NoError(t, err)
	require.Equal(t, "Rich SPA title", meta.Title)
	require.Equal(t, "Prerendered for MemosBot", meta.Description)
}

func TestHTMLMetaFetcherDefaultHeadersAndDeadline(t *testing.T) {
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		assert.Equal(t, defaultLinkPreviewUserAgent, req.Header.Get("User-Agent"))
		deadline, ok := req.Context().Deadline()
		assert.True(t, ok)
		assert.LessOrEqual(t, time.Until(deadline), fetchTimeout)
		return htmlResponse(req, `<title>Title</title>`), nil
	}))

	_, err := fetcher.Get(context.Background(), "http://93.184.216.34/page")
	require.NoError(t, err)
	require.Equal(t, fetchTimeout, newHTTPClient().Timeout)
}

func TestHTMLMetaFetcherResolvesAgainstFinalResponseURL(t *testing.T) {
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		finalRequest := req.Clone(req.Context())
		finalRequest.URL, _ = url.Parse("https://cdn.example.com/final/path/")
		return htmlResponse(finalRequest, `<meta property="og:image" content="cover.png">`), nil
	}))

	meta, err := fetcher.Get(context.Background(), "http://93.184.216.34/original")
	require.NoError(t, err)
	require.Equal(t, "https://cdn.example.com/final/path/cover.png", meta.Image)
}

func TestHTMLMetaFetcherValidatesResponse(t *testing.T) {
	tests := []struct {
		name        string
		status      int
		contentType string
	}{
		{name: "non-2xx", status: http.StatusNotFound, contentType: "text/html"},
		{name: "unsupported content type", status: http.StatusOK, contentType: "application/pdf"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return response(req, test.status, test.contentType, "body"), nil
			}))
			_, err := fetcher.Get(context.Background(), "http://93.184.216.34/page")
			require.Error(t, err)
		})
	}
}

func TestHTMLMetaFetcherBoundsHTMLResponse(t *testing.T) {
	body := `<title>Bounded title</title>` + strings.Repeat("x", maxHTMLMetaBytes) + `<meta property="og:title" content="Outside limit">`
	reader := &countingReadCloser{Reader: strings.NewReader(body)}
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		result := response(req, http.StatusOK, "text/html", "")
		result.Body = reader
		return result, nil
	}))

	meta, err := fetcher.Get(context.Background(), "http://93.184.216.34/page")
	require.NoError(t, err)
	require.Equal(t, "Bounded title", meta.Title)
	require.LessOrEqual(t, reader.bytesRead, int64(maxHTMLMetaBytes))
}

func TestHTMLMetaFetcherContextCancellation(t *testing.T) {
	requestStarted := make(chan struct{})
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		close(requestStarted)
		<-req.Context().Done()
		return nil, req.Context().Err()
	}))

	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() {
		_, err := fetcher.Get(ctx, "http://93.184.216.34/page")
		result <- err
	}()
	<-requestStarted
	cancel()
	require.ErrorIs(t, <-result, context.Canceled)
}

func TestHTMLMetaFetcherCache(t *testing.T) {
	var now = time.Date(2026, time.August, 17, 0, 0, 0, 0, time.UTC)
	var successCalls atomic.Int32
	successFetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		successCalls.Add(1)
		return htmlResponse(req, `<title>Cached title</title>`), nil
	}))
	successFetcher.now = func() time.Time { return now }

	first, err := successFetcher.Get(context.Background(), "HTTP://93.184.216.34:80/page#one")
	require.NoError(t, err)
	first.Title = "mutated"
	second, err := successFetcher.Get(context.Background(), "http://93.184.216.34/page#two")
	require.NoError(t, err)
	require.Equal(t, "Cached title", second.Title)
	require.EqualValues(t, 1, successCalls.Load())

	now = now.Add(successCacheTTL + time.Second)
	_, err = successFetcher.Get(context.Background(), "http://93.184.216.34/page")
	require.NoError(t, err)
	require.EqualValues(t, 2, successCalls.Load())

	var failureCalls atomic.Int32
	failureFetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		failureCalls.Add(1)
		return response(req, http.StatusBadGateway, "text/html", "failure"), nil
	}))
	failureFetcher.now = func() time.Time { return now }
	for range 2 {
		_, err := failureFetcher.Get(context.Background(), "http://93.184.216.34/failure")
		require.Error(t, err)
	}
	require.EqualValues(t, 1, failureCalls.Load())
	now = now.Add(failureCacheTTL + time.Second)
	_, err = failureFetcher.Get(context.Background(), "http://93.184.216.34/failure")
	require.Error(t, err)
	require.EqualValues(t, 2, failureCalls.Load())
}

func TestHTMLMetaFetcherBoundsCache(t *testing.T) {
	fetcher := NewHTMLMetaFetcher()
	now := time.Date(2026, time.August, 17, 0, 0, 0, 0, time.UTC)
	fetcher.now = func() time.Time { return now }
	for index := range maxCacheEntries + 1 {
		fetcher.setCached(fmt.Sprintf("https://example.com/%d", index), &HTMLMeta{Title: "title"}, nil, successCacheTTL)
		now = now.Add(time.Second)
	}

	require.Len(t, fetcher.cache, maxCacheEntries)
	_, exists := fetcher.cache["https://example.com/0"]
	require.False(t, exists)
}

func TestHTMLMetaFetcherCoalescesRequests(t *testing.T) {
	var calls atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if calls.Add(1) == 1 {
			close(started)
		}
		<-release
		return htmlResponse(req, `<title>Shared title</title>`), nil
	}))

	const requestCount = 20
	var waitGroup sync.WaitGroup
	errorsChannel := make(chan error, requestCount)
	for range requestCount {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			meta, err := fetcher.Get(context.Background(), "http://93.184.216.34/shared")
			if err == nil && meta.Title != "Shared title" {
				err = errors.New("unexpected metadata")
			}
			errorsChannel <- err
		}()
	}
	<-started
	close(release)
	waitGroup.Wait()
	close(errorsChannel)
	for err := range errorsChannel {
		require.NoError(t, err)
	}
	require.EqualValues(t, 1, calls.Load())
}

func TestHTMLMetaFetcherLimitsConcurrency(t *testing.T) {
	var active atomic.Int32
	var maximum atomic.Int32
	entered := make(chan struct{}, 12)
	release := make(chan struct{})
	fetcher := newTestFetcher(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		current := active.Add(1)
		for {
			previous := maximum.Load()
			if current <= previous || maximum.CompareAndSwap(previous, current) {
				break
			}
		}
		entered <- struct{}{}
		<-release
		active.Add(-1)
		return htmlResponse(req, `<title>Title</title>`), nil
	}))

	const requestCount = 12
	var waitGroup sync.WaitGroup
	for index := range requestCount {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			_, _ = fetcher.Get(context.Background(), "http://93.184.216.34/page?id="+string(rune('a'+index)))
		}()
	}
	for range maxConcurrentFetches {
		<-entered
	}
	select {
	case <-entered:
		t.Fatal("more than eight uncached fetches started concurrently")
	case <-time.After(100 * time.Millisecond):
	}
	close(release)
	waitGroup.Wait()
	require.EqualValues(t, maxConcurrentFetches, maximum.Load())
}

func TestHTMLMetaFetcherRejectsUnsafeURLsAndRedirects(t *testing.T) {
	fetcher := NewHTMLMetaFetcher()
	_, err := fetcher.Get(context.Background(), "http://192.168.0.1/page")
	require.ErrorIs(t, err, ErrInternalIP)

	redirect, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/private", nil)
	require.NoError(t, err)
	err = newHTTPClient().CheckRedirect(redirect, nil)
	require.ErrorIs(t, err, ErrInternalIP)
}

func TestSecureDialContextRejectsResolvedInternalIP(t *testing.T) {
	originalLookupIPAddr := lookupIPAddr
	originalDialContext := dialContext
	t.Cleanup(func() {
		lookupIPAddr = originalLookupIPAddr
		dialContext = originalDialContext
	})

	lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("127.0.0.1")}}, nil
	}
	dialContext = func(context.Context, string, string) (net.Conn, error) {
		t.Fatal("internal IP should be rejected before dialing")
		return nil, nil
	}

	_, err := secureDialContext(context.Background(), "tcp", "rebind.example:80")
	require.ErrorIs(t, err, ErrInternalIP)
}

func TestSecureDialContextDialsResolvedIP(t *testing.T) {
	originalLookupIPAddr := lookupIPAddr
	originalDialContext := dialContext
	t.Cleanup(func() {
		lookupIPAddr = originalLookupIPAddr
		dialContext = originalDialContext
	})

	lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("93.184.216.34")}}, nil
	}

	var dialedAddress string
	dialContext = func(_ context.Context, _ string, address string) (net.Conn, error) {
		dialedAddress = address
		clientConn, serverConn := net.Pipe()
		t.Cleanup(func() {
			clientConn.Close()
			serverConn.Close()
		})
		return clientConn, nil
	}

	conn, err := secureDialContext(context.Background(), "tcp", "rebind.example:80")
	require.NoError(t, err)
	require.NotNil(t, conn)
	require.Equal(t, "93.184.216.34:80", dialedAddress)
}

func extractTestMetadata(t *testing.T, markup string) *HTMLMeta {
	t.Helper()
	document, err := html.Parse(strings.NewReader(markup))
	require.NoError(t, err)
	sources, _ := extractDocumentMetadata(document)
	pageURL, err := url.Parse("https://example.com/posts/page")
	require.NoError(t, err)
	return mergeMetadata(pageURL, metadataSource{}, sources.openGraph, sources.twitter, sources.jsonLD, sources.standard, sources.semantic)
}

func newTestFetcher(transport http.RoundTripper) *HTMLMetaFetcher {
	fetcher := NewHTMLMetaFetcher()
	fetcher.client = &http.Client{Transport: transport}
	return fetcher
}

func htmlResponse(request *http.Request, body string) *http.Response {
	return response(request, http.StatusOK, "text/html; charset=utf-8", body)
}

func response(request *http.Request, statusCode int, contentType, body string) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Status:     http.StatusText(statusCode),
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    request,
	}
}

type countingReadCloser struct {
	*strings.Reader
	bytesRead int64
}

func (reader *countingReadCloser) Read(buffer []byte) (int, error) {
	count, err := reader.Reader.Read(buffer)
	reader.bytesRead += int64(count)
	return count, err
}

func (*countingReadCloser) Close() error {
	return nil
}

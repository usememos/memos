package httpgetter

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/net/html"
	"golang.org/x/sync/semaphore"
	"golang.org/x/sync/singleflight"
)

// ErrInternalIP indicates that a link preview target resolves to a disallowed internal address.
var ErrInternalIP = errors.New("internal IP addresses are not allowed")

const (
	defaultLinkPreviewUserAgent = "MemosBot/1.0 (+https://usememos.com)"

	maxHTMLMetaBytes     = 512 * 1024
	maxOEmbedBytes       = 128 * 1024
	maxCacheEntries      = 1000
	maxConcurrentFetches = 8
	fetchTimeout         = 5 * time.Second
	successCacheTTL      = 24 * time.Hour
	failureCacheTTL      = time.Minute
)

var (
	lookupIPAddr = net.DefaultResolver.LookupIPAddr
	dialContext  = (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext
)

func newHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = secureDialContext

	return &http.Client{
		Transport: transport,
		Timeout:   fetchTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if err := validateURL(req.URL.String()); err != nil {
				return errors.Wrap(err, "redirect to internal IP")
			}
			if len(via) >= 10 {
				return errors.New("too many redirects")
			}
			return nil
		},
	}
}

func secureDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, errors.Wrap(err, "invalid address")
	}

	ips, err := resolveAllowedIPs(ctx, host)
	if err != nil {
		return nil, err
	}

	var dialErr error
	for _, ip := range ips {
		conn, err := dialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		if err == nil {
			return conn, nil
		}
		dialErr = err
	}
	return nil, dialErr
}

func resolveAllowedIPs(ctx context.Context, host string) ([]net.IP, error) {
	if ip := net.ParseIP(host); ip != nil {
		if isInternalIP(ip) {
			return nil, errors.Wrap(ErrInternalIP, ip.String())
		}
		return []net.IP{ip}, nil
	}

	addrs, err := lookupIPAddr(ctx, host)
	if err != nil {
		return nil, errors.Errorf("failed to resolve hostname: %v", err)
	}

	ips := make([]net.IP, 0, len(addrs))
	for _, addr := range addrs {
		ip := addr.IP
		if ip == nil {
			continue
		}
		if isInternalIP(ip) {
			return nil, errors.Wrapf(ErrInternalIP, "host=%s, ip=%s", host, ip.String())
		}
		ips = append(ips, ip)
	}
	if len(ips) == 0 {
		return nil, errors.New("hostname resolved to no addresses")
	}

	return ips, nil
}

func isInternalIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified()
}

func validateURL(urlStr string) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return errors.New("invalid URL format")
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("only http/https protocols are allowed")
	}

	host := u.Hostname()
	if host == "" {
		return errors.New("empty hostname")
	}

	if ip := net.ParseIP(host); ip != nil && isInternalIP(ip) {
		return errors.Wrap(ErrInternalIP, ip.String())
	}

	return nil
}

// HTMLMeta contains metadata used to build a link preview.
type HTMLMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
}

type cacheEntry struct {
	meta      *HTMLMeta
	err       error
	expiresAt time.Time
	storedAt  time.Time
}

// HTMLMetaFetcher fetches and caches standards-based link preview metadata.
type HTMLMetaFetcher struct {
	client    *http.Client
	semaphore *semaphore.Weighted
	group     singleflight.Group
	now       func() time.Time

	cacheMu sync.Mutex
	cache   map[string]cacheEntry
}

// NewHTMLMetaFetcher creates a link preview fetcher with an SSRF-safe HTTP client.
func NewHTMLMetaFetcher() *HTMLMetaFetcher {
	return &HTMLMetaFetcher{
		client:    newHTTPClient(),
		semaphore: semaphore.NewWeighted(maxConcurrentFetches),
		now:       time.Now,
		cache:     make(map[string]cacheEntry),
	}
}

// Get fetches metadata for a URL.
func (f *HTMLMetaFetcher) Get(ctx context.Context, urlStr string) (*HTMLMeta, error) {
	key, err := normalizeURL(urlStr)
	if err != nil {
		return nil, err
	}
	if meta, ok, err := f.getCached(key); ok {
		return meta, err
	}

	resultChannel := f.group.DoChan(key, func() (any, error) {
		if meta, ok, err := f.getCached(key); ok {
			return meta, err
		}

		// The flight is shared by every coalesced waiter, so one caller's
		// cancellation must not abort it for the remaining waiters. The single
		// deadline covers both queueing and outbound requests.
		flightContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), fetchTimeout)
		defer cancel()
		if err := f.semaphore.Acquire(flightContext, 1); err != nil {
			return nil, err
		}
		defer f.semaphore.Release(1)

		meta, err := f.fetch(flightContext, key)
		if err == nil {
			f.setCached(key, meta, nil, successCacheTTL)
		} else {
			f.setCached(key, nil, err, failureCacheTTL)
		}
		return meta, err
	})

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-resultChannel:
		if result.Err != nil {
			return nil, result.Err
		}
		meta, ok := result.Val.(*HTMLMeta)
		if !ok {
			return nil, errors.New("invalid link metadata result")
		}
		return cloneHTMLMeta(meta), nil
	}
}

func (f *HTMLMetaFetcher) fetch(ctx context.Context, urlStr string) (*HTMLMeta, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create link preview request")
	}
	setRequestHeaders(request, "text/html, application/xhtml+xml;q=0.9, */*;q=0.1")

	response, err := f.client.Do(request)
	if err != nil {
		return nil, errors.Wrap(err, "failed to fetch link preview")
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, errors.Errorf("unexpected HTTP status: %s", response.Status)
	}

	mediaType, err := getMediatype(response)
	if err != nil {
		return nil, err
	}
	if mediaType != "text/html" && mediaType != "application/xhtml+xml" {
		return nil, errors.New("not a HTML page")
	}

	document, err := html.Parse(io.LimitReader(response.Body, maxHTMLMetaBytes))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse HTML")
	}
	pageURL, err := finalResponseURL(response, urlStr)
	if err != nil {
		return nil, err
	}

	sources, oEmbedEndpoint := extractDocumentMetadata(document)
	baseURL := resolveDocumentBase(pageURL, sources.baseHref)
	var oEmbed metadataSource
	if endpoint := resolveHTTPURL(baseURL, oEmbedEndpoint); endpoint != "" {
		// oEmbed is optional enrichment, so its failure must not discard the
		// metadata already extracted from the HTML document.
		oEmbed, _ = f.fetchOEmbed(ctx, endpoint)
	}

	meta := mergeMetadata(baseURL, oEmbed, sources.openGraph, sources.twitter, sources.jsonLD, sources.standard, siteImageSource(pageURL), sources.semantic)
	return meta, nil
}

func (f *HTMLMetaFetcher) fetchOEmbed(ctx context.Context, endpoint string) (metadataSource, error) {
	if err := validateURL(endpoint); err != nil {
		return metadataSource{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return metadataSource{}, errors.Wrap(err, "failed to create oEmbed request")
	}
	setRequestHeaders(request, "application/json+oembed, application/json;q=0.9")

	response, err := f.client.Do(request)
	if err != nil {
		return metadataSource{}, errors.Wrap(err, "failed to fetch oEmbed endpoint")
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return metadataSource{}, errors.Errorf("unexpected oEmbed HTTP status: %s", response.Status)
	}

	mediaType, err := getMediatype(response)
	if err != nil {
		return metadataSource{}, err
	}
	if mediaType != "application/json" && mediaType != "application/json+oembed" && !strings.HasSuffix(mediaType, "+json") {
		return metadataSource{}, errors.New("oEmbed response is not JSON")
	}

	data, err := io.ReadAll(io.LimitReader(response.Body, maxOEmbedBytes+1))
	if err != nil {
		return metadataSource{}, errors.Wrap(err, "failed to read oEmbed response")
	}
	if len(data) > maxOEmbedBytes {
		return metadataSource{}, errors.New("oEmbed response exceeds size limit")
	}

	baseURL, err := finalResponseURL(response, endpoint)
	if err != nil {
		return metadataSource{}, err
	}
	return extractOEmbedMetadata(data, baseURL)
}

func setRequestHeaders(request *http.Request, accept string) {
	request.Header.Set("User-Agent", defaultLinkPreviewUserAgent)
	request.Header.Set("Accept", accept)
}

func (f *HTMLMetaFetcher) getCached(key string) (*HTMLMeta, bool, error) {
	f.cacheMu.Lock()
	defer f.cacheMu.Unlock()

	entry, ok := f.cache[key]
	if !ok {
		return nil, false, nil
	}
	if !f.now().Before(entry.expiresAt) {
		delete(f.cache, key)
		return nil, false, nil
	}
	return cloneHTMLMeta(entry.meta), true, entry.err
}

func (f *HTMLMetaFetcher) setCached(key string, meta *HTMLMeta, err error, ttl time.Duration) {
	f.cacheMu.Lock()
	defer f.cacheMu.Unlock()

	now := f.now()
	if _, exists := f.cache[key]; !exists && len(f.cache) >= maxCacheEntries {
		var oldestKey string
		var oldestTime time.Time
		for candidateKey, entry := range f.cache {
			if oldestKey == "" || entry.storedAt.Before(oldestTime) {
				oldestKey = candidateKey
				oldestTime = entry.storedAt
			}
		}
		delete(f.cache, oldestKey)
	}
	f.cache[key] = cacheEntry{
		meta:      cloneHTMLMeta(meta),
		err:       err,
		expiresAt: now.Add(ttl),
		storedAt:  now,
	}
}

func normalizeURL(urlStr string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(urlStr))
	if err != nil {
		return "", errors.New("invalid URL format")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.Fragment = ""
	if parsed.Path == "" {
		parsed.Path = "/"
	}
	if (parsed.Scheme == "http" && parsed.Port() == "80") || (parsed.Scheme == "https" && parsed.Port() == "443") {
		parsed.Host = parsed.Hostname()
		if strings.Contains(parsed.Host, ":") {
			parsed.Host = "[" + parsed.Host + "]"
		}
	}
	if err := validateURL(parsed.String()); err != nil {
		return "", err
	}
	return parsed.String(), nil
}

func finalResponseURL(response *http.Response, fallback string) (*url.URL, error) {
	if response.Request != nil && response.Request.URL != nil {
		return response.Request.URL, nil
	}
	parsed, err := url.Parse(fallback)
	if err != nil {
		return nil, errors.Wrap(err, "invalid response URL")
	}
	return parsed, nil
}

func cloneHTMLMeta(meta *HTMLMeta) *HTMLMeta {
	if meta == nil {
		return nil
	}
	copy := *meta
	return &copy
}

// siteImageSource supplies deterministic site-specific thumbnails that outrank
// the low-confidence semantic <img> fallback but lose to metadata the site
// itself declares.
func siteImageSource(pageURL *url.URL) metadataSource {
	if pageURL.Hostname() == "www.youtube.com" && pageURL.Path == "/watch" {
		if videoID := pageURL.Query().Get("v"); videoID != "" {
			return metadataSource{image: fmt.Sprintf("https://img.youtube.com/vi/%s/mqdefault.jpg", url.PathEscape(videoID))}
		}
	}
	return metadataSource{}
}

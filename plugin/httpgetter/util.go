package httpgetter

import (
	"mime"
	"net/http"
	"net/url"
	"strings"
)

func getMediatype(response *http.Response) (string, error) {
	contentType := response.Header.Get("content-type")
	mediatype, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", err
	}
	return mediatype, nil
}

// NormalizeURLForCache normalizes a URL for use as a cache key.
// It removes fragments (hash) and trailing slashes (except root) to ensure
// that URLs like "https://example.com/" and "https://example.com" map to the same cache entry.
func NormalizeURLForCache(urlStr string) string {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		// If parsing fails, return original URL
		return urlStr
	}

	// Remove fragment (hash)
	parsed.Fragment = ""

	// Remove trailing slash from pathname (except root)
	if parsed.Path != "/" && strings.HasSuffix(parsed.Path, "/") {
		parsed.Path = strings.TrimSuffix(parsed.Path, "/")
	}

	return parsed.String()
}

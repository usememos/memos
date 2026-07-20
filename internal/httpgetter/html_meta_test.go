package httpgetter

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestGetHTMLMeta(t *testing.T) {
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, "http://93.184.216.34/article", req.URL.String())
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"text/html; charset=utf-8"}},
				Body: io.NopCloser(strings.NewReader(`<!doctype html>
<html>
<head>
  <title>Fallback title</title>
  <meta name="description" content="Fallback description">
  <meta property="og:title" content="Open Graph title">
  <meta property="og:description" content="Open Graph description">
  <meta property="og:image" content="https://example.com/cover.png">
</head>
<body>ignored</body>
</html>`)),
				Request: req,
			}, nil
		}),
	}

	metadata, err := GetHTMLMeta("http://93.184.216.34/article")
	require.NoError(t, err)
	require.Equal(t, HTMLMeta{
		Title:       "Open Graph title",
		Description: "Open Graph description",
		Image:       "https://example.com/cover.png",
	}, *metadata)
}

func TestGetHTMLMetaWithNameOnly(t *testing.T) {
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, "http://93.184.216.34/blog", req.URL.String())
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"text/html; charset=utf-8"}},
				Body: io.NopCloser(strings.NewReader(`<!doctype html>
<html>
<head>
  <title>Sample Page</title>
  <meta name="description" content="This description should appear in the link preview.">
</head>
<body>Hello</body>
</html>`)),
				Request: req,
			}, nil
		}),
	}

	metadata, err := GetHTMLMeta("http://93.184.216.34/blog")
	require.NoError(t, err)
	require.Equal(t, HTMLMeta{
		Title:       "Sample Page",
		Description: "This description should appear in the link preview.",
		Image:       "",
	}, *metadata)
}

func TestGetHTMLMetaWithNameCaseInsensitive(t *testing.T) {
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, "http://93.184.216.34/blog", req.URL.String())
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"text/html; charset=utf-8"}},
				Body: io.NopCloser(strings.NewReader(`<!doctype html>
<html>
<head>
  <title>Sample Page</title>
  <meta name="Description" content="Case insensitive description match.">
</head>
<body>Hello</body>
</html>`)),
				Request: req,
			}, nil
		}),
	}

	metadata, err := GetHTMLMeta("http://93.184.216.34/blog")
	require.NoError(t, err)
	require.Equal(t, HTMLMeta{
		Title:       "Sample Page",
		Description: "Case insensitive description match.",
		Image:       "",
	}, *metadata)
}

func TestGetHTMLMetaForInternal(t *testing.T) {
	// test for internal IP
	if _, err := GetHTMLMeta("http://192.168.0.1"); !errors.Is(err, ErrInternalIP) {
		t.Errorf("Expected error for internal IP, got %v", err)
	}

	// test for resolved internal IP
	if _, err := GetHTMLMeta("http://localhost"); !errors.Is(err, ErrInternalIP) {
		t.Errorf("Expected error for resolved internal IP, got %v", err)
	}
}

func TestIsInternalIP(t *testing.T) {
	internal := []string{
		"127.0.0.1",         // loopback
		"10.0.0.1",          // RFC 1918
		"192.168.1.1",       // RFC 1918
		"169.254.169.254",   // link-local (cloud metadata)
		"100.64.0.1",        // RFC 6598 lower bound
		"100.100.100.200",   // Alibaba Cloud instance metadata
		"100.127.255.255",   // RFC 6598 upper bound
		"::1",               // IPv6 loopback
		"fd00::1",           // IPv6 unique local
		"::ffff:127.0.0.1",  // IPv4-mapped loopback
		"::ffff:100.64.0.1", // IPv4-mapped shared address space
	}
	for _, s := range internal {
		require.Truef(t, isInternalIP(net.ParseIP(s)), "expected %s to be internal", s)
	}

	external := []string{
		"93.184.216.34",  // example.com
		"8.8.8.8",        // public DNS
		"100.63.255.255", // just below RFC 6598
		"100.128.0.0",    // just above RFC 6598
	}
	for _, s := range external {
		require.Falsef(t, isInternalIP(net.ParseIP(s)), "expected %s to be external", s)
	}
}

func TestHTTPClientHasTimeout(t *testing.T) {
	require.NotZero(t, httpClient.Timeout)
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

package clientip

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func headers(pairs ...string) http.Header {
	header := http.Header{}
	for i := 0; i+1 < len(pairs); i += 2 {
		header.Add(pairs[i], pairs[i+1])
	}
	return header
}

func TestResolve(t *testing.T) {
	tests := []struct {
		name    string
		trusted []string
		remote  string
		header  http.Header
		want    string
	}{
		{name: "untrusted peer ignores forwarded header", trusted: []string{"none"}, remote: "203.0.113.5:4321", header: headers("X-Forwarded-For", "198.51.100.1"), want: "203.0.113.5"},
		{name: "untrusted peer ignores real ip", trusted: []string{"none"}, remote: "203.0.113.5:4321", header: headers("X-Real-Ip", "198.51.100.1"), want: "203.0.113.5"},
		{name: "default trusts a private peer's forwarded header", trusted: nil, remote: "172.18.0.2:80", header: headers("X-Forwarded-For", "198.51.100.1"), want: "198.51.100.1"},
		{name: "explicit private keyword", trusted: []string{"private"}, remote: "192.168.1.50:80", header: headers("X-Forwarded-For", "198.51.100.1"), want: "198.51.100.1"},
		{name: "none ignores a private peer's forwarded header", trusted: []string{"none"}, remote: "192.168.1.50:80", header: headers("X-Forwarded-For", "198.51.100.1"), want: "192.168.1.50"},
		{name: "none ignores a loopback peer's forwarded header", trusted: []string{"none"}, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "198.51.100.1", "X-Real-Ip", "198.51.100.1"), want: "127.0.0.1"},
		{name: "rightmost untrusted entry wins", trusted: nil, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "10.0.0.9, 198.51.100.1, 192.168.1.1"), want: "198.51.100.1"},
		{name: "client-supplied left entries are ignored", trusted: nil, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "1.2.3.4, 198.51.100.1"), want: "198.51.100.1"},
		{name: "multiple header values are joined", trusted: nil, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "1.2.3.4", "X-Forwarded-For", "198.51.100.1"), want: "198.51.100.1"},
		{name: "all entries trusted falls back to real ip", trusted: nil, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "10.0.0.1", "X-Real-Ip", "198.51.100.7"), want: "198.51.100.7"},
		{name: "all entries trusted and no real ip falls back to peer", trusted: nil, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "10.0.0.1"), want: "127.0.0.1"},
		{name: "malformed entry stops the walk", trusted: nil, remote: "127.0.0.1:80", header: headers("X-Forwarded-For", "198.51.100.1, not-an-ip"), want: "127.0.0.1"},
		{name: "explicit cidr", trusted: []string{"203.0.113.0/24"}, remote: "203.0.113.9:1", header: headers("X-Forwarded-For", "198.51.100.1"), want: "198.51.100.1"},
		{name: "explicit single address", trusted: []string{"203.0.113.9"}, remote: "203.0.113.9:1", header: headers("X-Forwarded-For", "198.51.100.1"), want: "198.51.100.1"},
		{name: "explicit cidr does not include private", trusted: []string{"203.0.113.0/24"}, remote: "127.0.0.1:1", header: headers("X-Forwarded-For", "198.51.100.1"), want: "127.0.0.1"},
		{name: "ipv6 peer and client", trusted: nil, remote: "[::1]:8080", header: headers("X-Forwarded-For", "2001:db8::1"), want: "2001:db8::1"},
		{name: "ipv4-mapped ipv6 is unmapped", trusted: []string{"none"}, remote: "[::ffff:203.0.113.5]:1", header: nil, want: "203.0.113.5"},
		{name: "bare host without port", trusted: []string{"none"}, remote: "203.0.113.5", header: nil, want: "203.0.113.5"},
		{name: "unparseable peer is returned as is", trusted: nil, remote: "unix", header: headers("X-Forwarded-For", "198.51.100.1"), want: "unix"},
		{name: "comma separated config", trusted: []string{"203.0.113.0/24, none"}, remote: "203.0.113.9:1", header: headers("X-Forwarded-For", "198.51.100.1"), want: "198.51.100.1"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resolver, err := ParseTrustedProxies(test.trusted)
			require.NoError(t, err)
			require.Equal(t, test.want, resolver.Resolve(test.remote, test.header))
		})
	}
}

func TestParseTrustedProxiesRejectsGarbage(t *testing.T) {
	_, err := ParseTrustedProxies([]string{"proxy.internal"})
	require.Error(t, err)
}

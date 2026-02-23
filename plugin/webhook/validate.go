package webhook

import (
	"net"
	"net/url"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// reservedCIDRs lists IP ranges that must never be targeted by outbound webhook requests.
// Covers loopback, RFC-1918 private, link-local (including cloud IMDS at 169.254.169.254),
// and their IPv6 equivalents.
var reservedCIDRs = []string{
	"127.0.0.0/8",    // IPv4 loopback
	"10.0.0.0/8",     // RFC-1918 class A
	"172.16.0.0/12",  // RFC-1918 class B
	"192.168.0.0/16", // RFC-1918 class C
	"169.254.0.0/16", // Link-local / cloud IMDS
	"::1/128",        // IPv6 loopback
	"fc00::/7",       // IPv6 unique local
	"fe80::/10",      // IPv6 link-local
}

// reservedNetworks is the parsed form of reservedCIDRs, built once at startup.
var reservedNetworks []*net.IPNet

func init() {
	for _, cidr := range reservedCIDRs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			panic("webhook: invalid reserved CIDR " + cidr + ": " + err.Error())
		}
		reservedNetworks = append(reservedNetworks, network)
	}
}

// isReservedIP reports whether ip falls within any reserved/private range.
func isReservedIP(ip net.IP) bool {
	for _, network := range reservedNetworks {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// ValidateURL checks that rawURL:
//  1. Parses as a valid absolute URL.
//  2. Uses the http or https scheme.
//  3. Does not resolve to a reserved/private IP address.
//
// It returns a gRPC InvalidArgument status error so callers can return it directly.
func ValidateURL(rawURL string) error {
	u, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid webhook URL: %v", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return status.Errorf(codes.InvalidArgument, "webhook URL must use http or https scheme, got %q", u.Scheme)
	}

	ips, err := net.LookupHost(u.Hostname())
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "webhook URL hostname could not be resolved: %v", err)
	}

	for _, ipStr := range ips {
		ip := net.ParseIP(ipStr)
		if ip != nil && isReservedIP(ip) {
			return status.Errorf(codes.InvalidArgument, "webhook URL must not resolve to a reserved or private IP address")
		}
	}
	return nil
}

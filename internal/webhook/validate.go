package webhook

import (
	"net"
	"net/netip"
	"net/url"
	"strings"
	"sync/atomic"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// reservedNetworks lists IP ranges blocked by default for outbound webhook requests.
// Explicit allowlist entries or the deprecated blanket override may permit them. The
// ranges cover loopback, RFC-1918 private, link-local (including cloud IMDS at
// 169.254.169.254), and their IPv6 equivalents.
var reservedNetworks = []netip.Prefix{
	netip.MustParsePrefix("127.0.0.0/8"),    // IPv4 loopback
	netip.MustParsePrefix("10.0.0.0/8"),     // RFC-1918 class A
	netip.MustParsePrefix("172.16.0.0/12"),  // RFC-1918 class B
	netip.MustParsePrefix("192.168.0.0/16"), // RFC-1918 class C
	netip.MustParsePrefix("169.254.0.0/16"), // Link-local / cloud IMDS
	netip.MustParsePrefix("::1/128"),        // IPv6 loopback
	netip.MustParsePrefix("fc00::/7"),       // IPv6 unique local
	netip.MustParsePrefix("fe80::/10"),      // IPv6 link-local
}

type privateDestinationPolicy struct {
	hostnames map[string]struct{}
	prefixes  []netip.Prefix
}

var configuredPrivateDestinations atomic.Pointer[privateDestinationPolicy]

// AllowPrivateIPs controls whether webhook URLs may resolve to reserved/private
// IP addresses. When true, the SSRF protection is disabled. This is useful for
// self-hosted deployments where webhooks target services on the local network.
//
// Deprecated: use ConfigurePrivateDestinationAllowlist to allow only the
// destinations that the deployment needs.
var AllowPrivateIPs bool

// isReservedIP reports whether ip falls within any reserved/private range.
func isReservedIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	for _, network := range reservedNetworks {
		if network.Contains(addr) {
			return true
		}
	}
	return false
}

// ConfigurePrivateDestinationAllowlist replaces the deployment's webhook
// allowlist. Each entry must be an exact hostname, an IP address, or a CIDR.
// Hostnames are matched case-insensitively, IP addresses are treated as
// single-address CIDRs, and CIDRs are masked to their network address.
//
// The new policy is published only after every entry is valid, so a failed
// configuration leaves the previous policy intact. Passing an empty slice
// clears the allowlist.
func ConfigurePrivateDestinationAllowlist(entries []string) error {
	policy := &privateDestinationPolicy{
		hostnames: make(map[string]struct{}),
		prefixes:  make([]netip.Prefix, 0, len(entries)),
	}

	for _, rawEntry := range entries {
		entry := strings.TrimSpace(rawEntry)
		if entry == "" {
			return errors.Errorf("webhook: private destination allowlist contains an empty entry")
		}

		if addr, err := netip.ParseAddr(entry); err == nil {
			if addr.Zone() != "" {
				return errors.Errorf("webhook: invalid private destination allowlist entry %q: scoped IP addresses are not supported", rawEntry)
			}
			addr = addr.Unmap()
			policy.prefixes = append(policy.prefixes, netip.PrefixFrom(addr, addr.BitLen()))
			continue
		}

		if prefix, err := netip.ParsePrefix(entry); err == nil {
			normalized, err := normalizePrefix(prefix)
			if err != nil {
				return errors.Wrapf(err, "webhook: invalid private destination allowlist entry %q", rawEntry)
			}
			policy.prefixes = append(policy.prefixes, normalized)
			continue
		} else if strings.Contains(entry, "/") {
			return errors.Wrapf(err, "webhook: invalid private destination allowlist entry %q", rawEntry)
		}

		hostname, err := normalizeHostname(entry)
		if err != nil {
			return errors.Wrapf(err, "webhook: invalid private destination allowlist entry %q", rawEntry)
		}
		policy.hostnames[hostname] = struct{}{}
	}

	configuredPrivateDestinations.Store(policy)
	return nil
}

func normalizePrefix(prefix netip.Prefix) (netip.Prefix, error) {
	addr := prefix.Addr()
	bits := prefix.Bits()
	if addr.Is4In6() {
		if bits < 96 {
			return netip.Prefix{}, errors.Errorf("IPv4-mapped IPv6 prefix must have at least 96 prefix bits")
		}
		addr = addr.Unmap()
		bits -= 96
	}
	return netip.PrefixFrom(addr, bits).Masked(), nil
}

func normalizeHostname(hostname string) (string, error) {
	hostname = strings.ToLower(strings.TrimSuffix(hostname, "."))
	if hostname == "" || len(hostname) > 253 {
		return "", errors.Errorf("hostname must contain between 1 and 253 characters")
	}

	for _, label := range strings.Split(hostname, ".") {
		if label == "" || len(label) > 63 {
			return "", errors.Errorf("hostname labels must contain between 1 and 63 characters")
		}
		for i, r := range label {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || (r == '-' && i > 0 && i < len(label)-1) {
				continue
			}
			return "", errors.Errorf("hostname contains an invalid character")
		}
	}

	return hostname, nil
}

func isPrivateDestinationAllowed(hostname string, ip net.IP) bool {
	if AllowPrivateIPs {
		return true
	}

	policy := configuredPrivateDestinations.Load()
	if policy == nil {
		return false
	}
	if normalizedHostname, err := normalizeHostname(hostname); err == nil {
		if _, ok := policy.hostnames[normalizedHostname]; ok {
			return true
		}
	}

	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	for _, prefix := range policy.prefixes {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

func isBlockedDestination(hostname string, ip net.IP) bool {
	return isReservedIP(ip) && !isPrivateDestinationAllowed(hostname, ip)
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
		if ip != nil && isBlockedDestination(u.Hostname(), ip) {
			return status.Errorf(codes.InvalidArgument, "webhook URL must not resolve to a reserved or private IP address")
		}
	}
	return nil
}

// ValidateSigningSecret checks that secret is either empty (allowed) or contains
// only printable ASCII characters (0x20–0x7E), excluding all control characters
// such as \r and \n, which would corrupt the webhook signature headers. When the
// secret uses the Standard Webhooks "whsec_<base64>" serialization, the base64
// body must decode cleanly so signing cannot silently fall back to the wrong key.
func ValidateSigningSecret(secret string) error {
	if secret == "" {
		return nil
	}
	for _, r := range secret {
		if r < 0x20 || r > 0x7E {
			return status.Errorf(codes.InvalidArgument, "signing secret contains invalid character")
		}
	}
	if _, err := resolveSigningKey(secret); err != nil {
		return status.Errorf(codes.InvalidArgument, "%v", err)
	}
	return nil
}

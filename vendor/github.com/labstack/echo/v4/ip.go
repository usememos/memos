package echo

import (
	"net"
	"net/http"
	"strings"
)

/**
By: https://github.com/tmshn (See: https://github.com/labstack/echo/pull/1478 , https://github.com/labstack/echox/pull/134 )
Source: https://echo.labstack.com/guide/ip-address/

IP address plays fundamental role in HTTP; it's used for access control, auditing, geo-based access analysis and more.
Echo provides handy method [`Context#RealIP()`](https://godoc.org/github.com/labstack/echo#Context) for that.

However, it is not trivial to retrieve the _real_ IP address from requests especially when you put L7 proxies before the application.
In such situation, _real_ IP needs to be relayed on HTTP layer from proxies to your app, but you must not trust HTTP headers unconditionally.
Otherwise, you might give someone a chance of deceiving you. **A security risk!**

To retrieve IP address reliably/securely, you must let your application be aware of the entire architecture of your infrastructure.
In Echo, this can be done by configuring `Echo#IPExtractor` appropriately.
This guides show you why and how.

> Note: if you dont' set `Echo#IPExtractor` explicitly, Echo fallback to legacy behavior, which is not a good choice.

Let's start from two questions to know the right direction:

1. Do you put any HTTP (L7) proxy in front of the application?
    - It includes both cloud solutions (such as AWS ALB or GCP HTTP LB) and OSS ones (such as Nginx, Envoy or Istio ingress gateway).
2. If yes, what HTTP header do your proxies use to pass client IP to the application?

## Case 1. With no proxy

If you put no proxy (e.g.: directory facing to the internet), all you need to (and have to) see is IP address from network layer.
Any HTTP header is untrustable because the clients have full control what headers to be set.

In this case, use `echo.ExtractIPDirect()`.

```go
e.IPExtractor = echo.ExtractIPDirect()
```

## Case 2. With proxies using `X-Forwarded-For` header

[`X-Forwared-For` (XFF)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For) is the popular header
to relay clients' IP addresses.
At each hop on the proxies, they append the request IP address at the end of the header.

Following example diagram illustrates this behavior.

```text
┌──────────┐            ┌──────────┐            ┌──────────┐            ┌──────────┐
│ "Origin" │───────────>│ Proxy 1  │───────────>│ Proxy 2  │───────────>│ Your app │
│ (IP: a)  │            │ (IP: b)  │            │ (IP: c)  │            │          │
└──────────┘            └──────────┘            └──────────┘            └──────────┘

Case 1.
XFF:  ""                    "a"                     "a, b"
                                                    ~~~~~~
Case 2.
XFF:  "x"                   "x, a"                  "x, a, b"
                                                    ~~~~~~~~~
                                                    ↑ What your app will see
```

In this case, use **first _untrustable_ IP reading from right**. Never use first one reading from left, as it is
configurable by client. Here "trustable" means "you are sure the IP address belongs to your infrastructre".
In above example, if `b` and `c` are trustable, the IP address of the client is `a` for both cases, never be `x`.

In Echo, use `ExtractIPFromXFFHeader(...TrustOption)`.

```go
e.IPExtractor = echo.ExtractIPFromXFFHeader()
```

By default, it trusts internal IP addresses (loopback, link-local unicast, private-use and unique local address
from [RFC6890](https://tools.ietf.org/html/rfc6890), [RFC4291](https://tools.ietf.org/html/rfc4291) and
[RFC4193](https://tools.ietf.org/html/rfc4193)).
To control this behavior, use [`TrustOption`](https://godoc.org/github.com/labstack/echo#TrustOption)s.

E.g.:

```go
e.IPExtractor = echo.ExtractIPFromXFFHeader(
	TrustLinkLocal(false),
	TrustIPRanges(lbIPRange),
)
```

- Ref: https://godoc.org/github.com/labstack/echo#TrustOption

## Case 3. With proxies using `X-Real-IP` header

`X-Real-IP` is another HTTP header to relay clients' IP addresses, but it carries only one address unlike XFF.

If your proxies set this header, use `ExtractIPFromRealIPHeader(...TrustOption)`.

```go
e.IPExtractor = echo.ExtractIPFromRealIPHeader()
```

Again, it trusts internal IP addresses by default (loopback, link-local unicast, private-use and unique local address
from [RFC6890](https://tools.ietf.org/html/rfc6890), [RFC4291](https://tools.ietf.org/html/rfc4291) and
[RFC4193](https://tools.ietf.org/html/rfc4193)).
To control this behavior, use [`TrustOption`](https://godoc.org/github.com/labstack/echo#TrustOption)s.

- Ref: https://godoc.org/github.com/labstack/echo#TrustOption

> **Never forget** to configure the outermost proxy (i.e.; at the edge of your infrastructure) **not to pass through incoming headers**.
> Otherwise there is a chance of fraud, as it is what clients can control.

## About default behavior

In default behavior, Echo sees all of first XFF header, X-Real-IP header and IP from network layer.

As you might already notice, after reading this article, this is not good.
Sole reason this is default is just backward compatibility.

## Private IP ranges

See: https://en.wikipedia.org/wiki/Private_network

Private IPv4 address ranges (RFC 1918):
* 10.0.0.0 – 10.255.255.255 (24-bit block)
* 172.16.0.0 – 172.31.255.255 (20-bit block)
* 192.168.0.0 – 192.168.255.255 (16-bit block)

Private IPv6 address ranges:
* fc00::/7 address block = RFC 4193 Unique Local Addresses (ULA)

*/

type ipChecker struct {
	trustLoopback    bool
	trustLinkLocal   bool
	trustPrivateNet  bool
	trustExtraRanges []*net.IPNet
}

// TrustOption is config for which IP address to trust
type TrustOption func(*ipChecker)

// TrustLoopback configures if you trust loopback address (default: true).
func TrustLoopback(v bool) TrustOption {
	return func(c *ipChecker) {
		c.trustLoopback = v
	}
}

// TrustLinkLocal configures if you trust link-local address (default: true).
func TrustLinkLocal(v bool) TrustOption {
	return func(c *ipChecker) {
		c.trustLinkLocal = v
	}
}

// TrustPrivateNet configures if you trust private network address (default: true).
func TrustPrivateNet(v bool) TrustOption {
	return func(c *ipChecker) {
		c.trustPrivateNet = v
	}
}

// TrustIPRange add trustable IP ranges using CIDR notation.
func TrustIPRange(ipRange *net.IPNet) TrustOption {
	return func(c *ipChecker) {
		c.trustExtraRanges = append(c.trustExtraRanges, ipRange)
	}
}

func newIPChecker(configs []TrustOption) *ipChecker {
	checker := &ipChecker{trustLoopback: true, trustLinkLocal: true, trustPrivateNet: true}
	for _, configure := range configs {
		configure(checker)
	}
	return checker
}

// Go1.16+ added `ip.IsPrivate()` but until that use this implementation
func isPrivateIPRange(ip net.IP) bool {
	if ip4 := ip.To4(); ip4 != nil {
		return ip4[0] == 10 ||
			ip4[0] == 172 && ip4[1]&0xf0 == 16 ||
			ip4[0] == 192 && ip4[1] == 168
	}
	return len(ip) == net.IPv6len && ip[0]&0xfe == 0xfc
}

func (c *ipChecker) trust(ip net.IP) bool {
	if c.trustLoopback && ip.IsLoopback() {
		return true
	}
	if c.trustLinkLocal && ip.IsLinkLocalUnicast() {
		return true
	}
	if c.trustPrivateNet && isPrivateIPRange(ip) {
		return true
	}
	for _, trustedRange := range c.trustExtraRanges {
		if trustedRange.Contains(ip) {
			return true
		}
	}
	return false
}

// IPExtractor is a function to extract IP addr from http.Request.
// Set appropriate one to Echo#IPExtractor.
// See https://echo.labstack.com/guide/ip-address for more details.
type IPExtractor func(*http.Request) string

// ExtractIPDirect extracts IP address using actual IP address.
// Use this if your server faces to internet directory (i.e.: uses no proxy).
func ExtractIPDirect() IPExtractor {
	return extractIP
}

func extractIP(req *http.Request) string {
	ra, _, _ := net.SplitHostPort(req.RemoteAddr)
	return ra
}

// ExtractIPFromRealIPHeader extracts IP address using x-real-ip header.
// Use this if you put proxy which uses this header.
func ExtractIPFromRealIPHeader(options ...TrustOption) IPExtractor {
	checker := newIPChecker(options)
	return func(req *http.Request) string {
		realIP := req.Header.Get(HeaderXRealIP)
		if realIP != "" {
			if ip := net.ParseIP(realIP); ip != nil && checker.trust(ip) {
				return realIP
			}
		}
		return extractIP(req)
	}
}

// ExtractIPFromXFFHeader extracts IP address using x-forwarded-for header.
// Use this if you put proxy which uses this header.
// This returns nearest untrustable IP. If all IPs are trustable, returns furthest one (i.e.: XFF[0]).
func ExtractIPFromXFFHeader(options ...TrustOption) IPExtractor {
	checker := newIPChecker(options)
	return func(req *http.Request) string {
		directIP := extractIP(req)
		xffs := req.Header[HeaderXForwardedFor]
		if len(xffs) == 0 {
			return directIP
		}
		ips := append(strings.Split(strings.Join(xffs, ","), ","), directIP)
		for i := len(ips) - 1; i >= 0; i-- {
			ip := net.ParseIP(strings.TrimSpace(ips[i]))
			if ip == nil {
				// Unable to parse IP; cannot trust entire records
				return directIP
			}
			if !checker.trust(ip) {
				return ip.String()
			}
		}
		// All of the IPs are trusted; return first element because it is furthest from server (best effort strategy).
		return strings.TrimSpace(ips[0])
	}
}

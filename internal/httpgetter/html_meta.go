package httpgetter

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var ErrInternalIP = errors.New("internal IP addresses are not allowed")

const maxHTMLMetaBytes = 512 * 1024

var (
	lookupIPAddr = net.DefaultResolver.LookupIPAddr
	dialContext  = (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext
	httpClient = newHTTPClient()
)

func newHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = secureDialContext

	return &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
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

type HTMLMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
}

func GetHTMLMeta(urlStr string) (*HTMLMeta, error) {
	if err := validateURL(urlStr); err != nil {
		return nil, err
	}

	response, err := httpClient.Get(urlStr)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	mediatype, err := getMediatype(response)
	if err != nil {
		return nil, err
	}
	if mediatype != "text/html" {
		return nil, errors.New("not a HTML page")
	}

	htmlMeta := extractHTMLMeta(io.LimitReader(response.Body, maxHTMLMetaBytes))
	enrichSiteMeta(response.Request.URL, htmlMeta)
	return htmlMeta, nil
}

func extractHTMLMeta(resp io.Reader) *HTMLMeta {
	tokenizer := html.NewTokenizer(resp)
	htmlMeta := new(HTMLMeta)

	for {
		tokenType := tokenizer.Next()
		if tokenType == html.ErrorToken {
			break
		} else if tokenType == html.StartTagToken || tokenType == html.SelfClosingTagToken {
			token := tokenizer.Token()
			if token.DataAtom == atom.Body {
				break
			}

			if token.DataAtom == atom.Title {
				tokenizer.Next()
				token := tokenizer.Token()
				htmlMeta.Title = token.Data
			} else if token.DataAtom == atom.Meta {
				description, ok := extractMetaProperty(token, "description")
				if ok {
					htmlMeta.Description = description
				}

				ogTitle, ok := extractMetaProperty(token, "og:title")
				if ok {
					htmlMeta.Title = ogTitle
				}

				ogDescription, ok := extractMetaProperty(token, "og:description")
				if ok {
					htmlMeta.Description = ogDescription
				}

				ogImage, ok := extractMetaProperty(token, "og:image")
				if ok {
					htmlMeta.Image = ogImage
				}
			}
		}
	}

	return htmlMeta
}

func extractMetaProperty(token html.Token, prop string) (content string, ok bool) {
	content, ok = "", false
	for _, attr := range token.Attr {
		if attr.Key == "property" && attr.Val == prop {
			ok = true
		}
		if attr.Key == "content" {
			content = attr.Val
		}
	}
	return content, ok
}

func enrichSiteMeta(url *url.URL, meta *HTMLMeta) {
	if url.Hostname() == "www.youtube.com" {
		if url.Path == "/watch" {
			vid := url.Query().Get("v")
			if vid != "" {
				meta.Image = fmt.Sprintf("https://img.youtube.com/vi/%s/mqdefault.jpg", vid)
			}
		}
	}
}

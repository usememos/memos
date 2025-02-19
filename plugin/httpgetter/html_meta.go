package httpgetter

import (
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type HTMLMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
}

func GetHTMLMeta(urlStr string) (*HTMLMeta, error) {
	if err := validateURL(urlStr); err != nil {
		return nil, err
	}

	response, err := http.Get(urlStr)
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

	// TODO: limit the size of the response body

	htmlMeta := extractHTMLMeta(response.Body)
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

func validateURL(urlStr string) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return errors.New("invalid URL format")
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("only http/https protocols are allowed")
	}

	if host := u.Hostname(); host != "" {
		ip := net.ParseIP(host)
		if ip != nil {
			if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
				return errors.New("internal IP addresses are not allowed")
			}
		}
	}

	return nil
}

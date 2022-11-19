package crawler

import (
	"io"
	"net/http"
	urlUtil "net/url"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type HTMLMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
}

func GetWebsiteMeta(url string) (*HTMLMeta, error) {
	if _, err := urlUtil.Parse(url); err != nil {
		return nil, err
	}

	response, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

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

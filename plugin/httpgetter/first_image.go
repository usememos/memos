package httpgetter

import (
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// GetFirstImageURL returns the first <img src> found on the page, or empty string.
func GetFirstImageURL(urlStr string) (string, error) {
	if err := validateURL(urlStr); err != nil {
		return "", err
	}

	resp, err := httpClient.Get(urlStr)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", errors.Errorf("failed to fetch page: status %d", resp.StatusCode)
	}

	tokenizer := html.NewTokenizer(resp.Body)
	for {
		tt := tokenizer.Next()
		if tt == html.ErrorToken {
			break
		}
		if tt == html.StartTagToken || tt == html.SelfClosingTagToken {
			token := tokenizer.Token()
			if token.DataAtom == atom.Img {
				for _, attr := range token.Attr {
					if strings.EqualFold(attr.Key, "src") && attr.Val != "" {
						return attr.Val, nil
					}
				}
			}
		}
	}

	return "", nil
}

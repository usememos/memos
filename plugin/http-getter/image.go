package getter

import (
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

type Image struct {
	Blob      []byte
	Mediatype string
}

func GetImage(urlStr string) (*Image, error) {
	if _, err := url.Parse(urlStr); err != nil {
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
	if !strings.HasPrefix(mediatype, "image/") {
		return nil, errors.New("Wrong image mediatype")
	}

	bodyBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	bodyBytes, err = SanitizeContent(bodyBytes)
	if err != nil {
		return nil, err
	}

	image := &Image{
		Blob:      bodyBytes,
		Mediatype: mediatype,
	}
	return image, nil
}

func SanitizeContent(content []byte) ([]byte, error) {
	bodyString := string(content)

	bm := bluemonday.UGCPolicy()
	return []byte(bm.Sanitize(bodyString)), nil
}

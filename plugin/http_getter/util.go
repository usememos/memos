package getter

import (
	"mime"
	"net/http"
)

func getMediatype(response *http.Response) (string, error) {
	contentType := response.Header.Get("content-type")
	mediatype, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", err
	}
	return mediatype, nil
}

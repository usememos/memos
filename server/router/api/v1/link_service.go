package v1

import (
	"net/http"
	"net/url"
	"path"

	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/plugin/httpgetter"
)

// RegisterLinkRoutes registers lightweight HTTP routes for link previews.
// We keep this as a REST handler (not gRPC) to avoid schema churn
// and to reuse existing safety checks in the httpgetter plugin.
func (s *APIV1Service) RegisterLinkRoutes(g *echo.Group) {
	g.GET("/api/v1/link:preview", s.handleGetLinkPreview)
}

type linkPreviewResponse struct {
	Preview linkPreview `json:"preview"`
}

type linkPreview struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	SiteName    string `json:"siteName"`
	URL         string `json:"url"`
}

func (s *APIV1Service) handleGetLinkPreview(c echo.Context) error {
	_ = s
	rawURL := c.QueryParam("url")
	if rawURL == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "url is required")
	}

	meta, err := httpgetter.GetHTMLMeta(rawURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	parsedURL, _ := url.Parse(rawURL)
	siteName := ""
	if parsedURL != nil {
		siteName = parsedURL.Hostname()
	}

	imageURL := meta.Image
	if parsedURL != nil && imageURL != "" {
		if u, err := url.Parse(imageURL); err == nil {
			if !u.IsAbs() {
				// handle protocol-relative
				if u.Host != "" {
					u.Scheme = parsedURL.Scheme
					imageURL = u.String()
				} else {
					// relative path -> join with base
					u.Scheme = parsedURL.Scheme
					u.Host = parsedURL.Host
					if !path.IsAbs(u.Path) {
						u.Path = path.Join(parsedURL.Path, "..", u.Path)
					}
					imageURL = u.String()
				}
			}
		}
	}

	// If meta image missing, try first <img> on page.
	if imageURL == "" {
		if firstImg, err := httpgetter.GetFirstImageURL(rawURL); err == nil && firstImg != "" {
			if parsedURL != nil {
				imageURL = toAbsoluteFromBase(parsedURL, firstImg)
			} else {
				imageURL = firstImg
			}
		}
	}

	resp := linkPreviewResponse{
		Preview: linkPreview{
			Title:       meta.Title,
			Description: meta.Description,
			ImageURL:    imageURL,
			SiteName:    siteName,
			URL:         rawURL,
		},
	}
	return c.JSON(http.StatusOK, resp)
}

func toAbsoluteFromBase(base *url.URL, raw string) string {
	if raw == "" || base == nil {
		return raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if u.IsAbs() {
		return u.String()
	}
	// Protocol-relative //host/path
	if u.Host != "" && u.Scheme == "" {
		u.Scheme = base.Scheme
		return u.String()
	}
	// Pure relative path
	u.Scheme = base.Scheme
	u.Host = base.Host
	if !path.IsAbs(u.Path) {
		u.Path = path.Join(path.Dir(base.Path), u.Path)
	}
	return u.String()
}

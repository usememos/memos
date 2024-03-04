// html_getter.go
package v1

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/labstack/echo/v4"
	getter "github.com/usememos/memos/plugin/http-getter"
)

func (*APIV1Service) registerMetaPublicRoutes(g *echo.Group) {
	// GET /get/meta?url={url} - Get HTML meta.
	g.GET("/get/meta", GetHTMLMeta)
}

// GetHTMLMeta godoc
//
//	@Summary	Get HTML meta from URL
//	@Tags		html-meta
//	@Produce	json
//	@Param		url	query		string	true	"HTML meta url"
//	@Success	200	{object}	getter.HTMLMeta	"HTML meta"
//	@Failure	400	{object}	nil		"Missing HTML meta url | Wrong url | Failed to get HTML meta url: %s"
//	@Router		/o/get/GetHTMLMeta [GET]
func GetHTMLMeta(c echo.Context) error {
	urlStr := c.QueryParam("url")
	if urlStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing HTML meta url")
	}
	if _, err := url.Parse(urlStr); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Wrong url").SetInternal(err)
	}

	htmlMeta, err := getter.GetHTMLMeta(urlStr)

	c.Response().Writer.WriteHeader(http.StatusOK)
	c.Response().Writer.Header().Set("Content-Type", echo.MIMETextHTML)
	c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=10800, immutable")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Failed to get HTML meta url: %s", urlStr)).SetInternal(err)
	}

	return c.JSON(http.StatusOK, htmlMeta)
}

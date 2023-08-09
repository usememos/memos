package v1

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/labstack/echo/v4"
	getter "github.com/usememos/memos/plugin/http-getter"
)

func (*APIV1Service) registerGetterPublicRoutes(g *echo.Group) {
	// GET /get/httpmeta?url={url} - Get website meta.
	g.GET("/get/httpmeta", GetWebsiteMetadata)

	// GET /get/image?url={url} - Get image.
	g.GET("/get/image", GetImage)
}

// GetWebsiteMetadata godoc
//
//	@Summary	Get website metadata
//	@Tags		get
//	@Produce	json
//	@Param		url	query		string			true	"Website URL"
//	@Success	200	{object}	getter.HTMLMeta	"Extracted metadata"
//	@Failure	400	{object}	nil				"Missing website url | Wrong url"
//	@Failure	406	{object}	nil				"Failed to get website meta with url: %s"
//	@Router		/o/get/GetWebsiteMetadata [GET]
func GetWebsiteMetadata(c echo.Context) error {
	urlStr := c.QueryParam("url")
	if urlStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing website url")
	}
	if _, err := url.Parse(urlStr); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Wrong url").SetInternal(err)
	}

	htmlMeta, err := getter.GetHTMLMeta(urlStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotAcceptable, fmt.Sprintf("Failed to get website meta with url: %s", urlStr)).SetInternal(err)
	}
	return c.JSON(http.StatusOK, htmlMeta)
}

// GetImage godoc
//
//	@Summary	Get GetImage from URL
//	@Tags		get
//	@Produce	GetImage/*
//	@Param		url	query		string	true	"Image url"
//	@Success	200	{object}	nil		"Image"
//	@Failure	400	{object}	nil		"Missing GetImage url | Wrong url | Failed to get GetImage url: %s"
//	@Failure	500	{object}	nil		"Failed to write GetImage blob"
//	@Router		/o/get/GetImage [GET]
func GetImage(c echo.Context) error {
	urlStr := c.QueryParam("url")
	if urlStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing image url")
	}
	if _, err := url.Parse(urlStr); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Wrong url").SetInternal(err)
	}

	image, err := getter.GetImage(urlStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Failed to get image url: %s", urlStr)).SetInternal(err)
	}

	c.Response().Writer.WriteHeader(http.StatusOK)
	c.Response().Writer.Header().Set("Content-Type", image.Mediatype)
	c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
	if _, err := c.Response().Writer.Write(image.Blob); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to write image blob").SetInternal(err)
	}
	return nil
}

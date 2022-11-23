package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/labstack/echo/v4"
	getter "github.com/usememos/memos/plugin/http_getter"
	metric "github.com/usememos/memos/plugin/metrics"
)

func (s *Server) registerGetterPublicRoutes(g *echo.Group) {
	g.GET("/get/httpmeta", func(c echo.Context) error {
		ctx := c.Request().Context()
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
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "getter used",
			Labels: map[string]string{
				"type": "httpmeta",
			},
		})

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(htmlMeta)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode website HTML meta").SetInternal(err)
		}
		return nil
	})

	g.GET("/get/image", func(c echo.Context) error {
		ctx := c.Request().Context()
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
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "getter used",
			Labels: map[string]string{
				"type": "image",
			},
		})

		c.Response().Writer.WriteHeader(http.StatusOK)
		c.Response().Writer.Header().Set("Content-Type", image.Mediatype)
		c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
		if _, err := c.Response().Writer.Write(image.Blob); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to write image blob").SetInternal(err)
		}
		return nil
	})
}

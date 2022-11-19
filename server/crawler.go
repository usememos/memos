package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/plugin/crawler"
	metric "github.com/usememos/memos/plugin/metrics"
)

func (s *Server) registerCrawlerPublicRoutes(g *echo.Group) {
	g.GET("/crawler/website", func(c echo.Context) error {
		ctx := c.Request().Context()
		url := c.QueryParam("url")
		if url == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing website url")
		}

		htmlMeta, err := crawler.GetWebsiteMeta(url)
		if err != nil {
			return echo.NewHTTPError(http.StatusNotAcceptable, fmt.Sprintf("Failed to get website meta with url: %s", url)).SetInternal(err)
		}
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "crawler used",
			Labels: map[string]string{
				"type": "website",
			},
		})

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(htmlMeta)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode website HTML meta").SetInternal(err)
		}
		return nil
	})
}

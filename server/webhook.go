package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/usememos/memos/api"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerWebhookRoutes(g *echo.Group) {
	g.GET("/test", func(c echo.Context) error {
		return c.HTML(http.StatusOK, "<strong>Hello, World!</strong>")
	})

	g.GET("/r/:resourceId/:filename", func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		filename := c.Param("filename")
		resourceFind := &api.ResourceFind{
			ID:       &resourceID,
			Filename: &filename,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to fetch resource ID: %v", resourceID)).SetInternal(err)
		}

		c.Response().Writer.WriteHeader(http.StatusOK)
		c.Response().Writer.Header().Set("Content-Type", resource.Type)
		if _, err := c.Response().Writer.Write(resource.Blob); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to write response").SetInternal(err)
		}

		return nil
	})
}

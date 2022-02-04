package server

import (
	"encoding/json"
	"fmt"
	"memos/api"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerWebhookRoutes(g *echo.Group) {
	g.GET("/test", func(c echo.Context) error {
		return c.HTML(http.StatusOK, "<strong>Hello, World!</strong>")
	})
	g.POST("/:openId/memo", func(c echo.Context) error {
		openId := c.Param("openId")

		userFind := &api.UserFind{
			OpenId: &openId,
		}
		user, err := s.UserService.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by open_id").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("User openId not found: %s", openId))
		}

		memoCreate := &api.MemoCreate{
			CreatorId: user.Id,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request by open api").SetInternal(err)
		}

		memo, err := s.MemoService.CreateMemo(memoCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(memo); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to marshal memo response").SetInternal(err)
		}

		return nil
	})
	g.GET("r/:resourceId/:filename", func(c echo.Context) error {
		resourceId, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		filename := c.Param("filename")

		resourceFind := &api.ResourceFind{
			Id:       &resourceId,
			Filename: &filename,
		}

		resource, err := s.ResourceService.FindResource(resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to fetch resource ID: %v", resourceId)).SetInternal(err)
		}

		c.Response().Writer.WriteHeader(http.StatusOK)
		c.Response().Writer.Header().Set("Content-Type", "application/octet-stream")
		c.Response().Writer.Write(resource.Blob)

		return nil
	})
}

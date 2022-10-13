package server

import (
	"encoding/json"
	"net/http"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerSystemRoutes(g *echo.Group) {
	g.GET("/ping", func(c echo.Context) error {
		data := s.Profile

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(data)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose system profile").SetInternal(err)
		}
		return nil
	})

	g.GET("/status", func(c echo.Context) error {
		ctx := c.Request().Context()
		hostUserType := api.Host
		hostUserFind := api.UserFind{
			Role: &hostUserType,
		}
		hostUser, err := s.Store.FindUser(ctx, &hostUserFind)
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find host user").SetInternal(err)
		}

		if hostUser != nil {
			// data desensitize
			hostUser.Email = ""
			hostUser.OpenID = ""
		}

		systemStatus := api.SystemStatus{
			Host:    hostUser,
			Profile: s.Profile,
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(systemStatus)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode system status response").SetInternal(err)
		}
		return nil
	})
}

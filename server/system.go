package server

import (
	"encoding/json"
	"memos/api"
	"net/http"

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
		ownerUserType := api.Owner
		ownerUserFind := api.UserFind{
			Role: &ownerUserType,
		}
		ownerUser, err := s.Store.FindUser(&ownerUserFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find owner user").SetInternal(err)
		}

		// data desensitize
		ownerUser.OpenID = ""

		systemStatus := api.SystemStatus{
			Owner:   ownerUser,
			Profile: s.Profile,
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(systemStatus)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode system status response").SetInternal(err)
		}
		return nil
	})
}

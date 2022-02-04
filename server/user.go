package server

import (
	"encoding/json"
	"memos/api"
	"memos/common"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerUserRoutes(g *echo.Group) {
	g.GET("/user/me", func(c echo.Context) error {
		userId := c.Get(getUserIdContextKey()).(int)
		userFind := &api.UserFind{
			Id: &userId,
		}
		user, err := s.UserService.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to marshal user response").SetInternal(err)
		}

		return nil
	})
	g.POST("/user/rename_check", func(c echo.Context) error {
		userRenameCheck := &api.UserRenameCheck{}
		if err := json.NewDecoder(c.Request().Body).Decode(userRenameCheck); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user rename check request").SetInternal(err)
		}

		if userRenameCheck.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user rename check request")
		}

		userFind := &api.UserFind{
			Name: &userRenameCheck.Name,
		}
		user, err := s.UserService.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to marshal user response").SetInternal(err)
		}

		return nil
	})
	g.PATCH("user/me", func(c echo.Context) error {
		userId := c.Get(getUserIdContextKey()).(int)
		userPatch := &api.UserPatch{
			Id: userId,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(userPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch user request").SetInternal(err)
		}

		if *userPatch.ResetOpenId {
			openId := common.GenUUID()
			userPatch.OpenId = &openId
		}

		user, err := s.UserService.PatchUser(userPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch user").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to marshal user response").SetInternal(err)
		}

		return nil
	})
}

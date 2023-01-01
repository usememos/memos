package server

import (
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type response struct {
	Data interface{} `json:"data"`
}

func composeResponse(data interface{}) response {
	return response{
		Data: data,
	}
}

func (server *Server) DefaultAuthSkipper(c echo.Context) bool {
	ctx := c.Request().Context()
	path := c.Path()

	// Skip auth.
	if common.HasPrefixes(path, "/api/auth") {
		return true
	}

	// If there is openId in query string and related user is found, then skip auth.
	openID := c.QueryParam("openId")
	if openID != "" {
		userFind := &api.UserFind{
			OpenID: &openID,
		}
		user, err := server.Store.FindUser(ctx, userFind)
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return false
		}
		if user != nil {
			// Stores userID into context.
			c.Set(getUserIDContextKey(), user.ID)
			return true
		}
	}

	return false
}

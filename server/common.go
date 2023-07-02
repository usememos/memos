package server

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"
)

type response struct {
	Data any `json:"data"`
}

func composeResponse(data any) response {
	return response{
		Data: data,
	}
}

func defaultGetRequestSkipper(c echo.Context) bool {
	return c.Request().Method == http.MethodGet
}

func defaultAPIRequestSkipper(c echo.Context) bool {
	path := c.Path()
	return common.HasPrefixes(path, "/api")
}

func (s *Server) defaultAuthSkipper(c echo.Context) bool {
	ctx := c.Request().Context()
	path := c.Path()

	// Skip auth.
	if common.HasPrefixes(path, "/api/v1/auth") {
		return true
	}

	// If there is openId in query string and related user is found, then skip auth.
	openID := c.QueryParam("openId")
	if openID != "" {
		user, err := s.Store.GetUser(ctx, &store.FindUser{
			OpenID: &openID,
		})
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

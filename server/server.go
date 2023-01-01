package server

import (
	"fmt"
	"time"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"

	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Server struct {
	e *echo.Echo

	Collector *MetricCollector

	Profile *profile.Profile

	Store *store.Store
}

func NewServer(profile *profile.Profile) *Server {
	e := echo.New()
	e.Debug = true
	e.HideBanner = true
	e.HidePort = true

	s := &Server{
		e:       e,
		Profile: profile,
	}

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: `{"time":"${time_rfc3339}",` +
			`"method":"${method}","uri":"${uri}",` +
			`"status":${status},"error":"${error}"}` + "\n",
	}))

	e.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
		Skipper:     s.OpenAPISkipper,
		TokenLookup: "cookie:_csrf",
	}))

	e.Use(middleware.CORS())

	e.Use(middleware.Secure())

	e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
		Skipper:      middleware.DefaultSkipper,
		ErrorMessage: "Request timeout",
		Timeout:      30 * time.Second,
	}))

	embedFrontend(e)

	// In dev mode, set the const secret key to make signin session persistence.
	secret := []byte("usememos")
	if profile.Mode == "prod" {
		secret = securecookie.GenerateRandomKey(16)
	}
	e.Use(session.Middleware(sessions.NewCookieStore(secret)))

	rootGroup := e.Group("")
	s.registerRSSRoutes(rootGroup)

	webhookGroup := e.Group("/h")
	s.registerResourcePublicRoutes(webhookGroup)

	publicGroup := e.Group("/o")
	s.registerResourcePublicRoutes(publicGroup)
	s.registerGetterPublicRoutes(publicGroup)

	apiGroup := e.Group("/api")
	apiGroup.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return aclMiddleware(s, next)
	})
	s.registerSystemRoutes(apiGroup)
	s.registerAuthRoutes(apiGroup)
	s.registerUserRoutes(apiGroup)
	s.registerMemoRoutes(apiGroup)
	s.registerShortcutRoutes(apiGroup)
	s.registerResourceRoutes(apiGroup)
	s.registerTagRoutes(apiGroup)

	return s
}

func (server *Server) Run() error {
	return server.e.Start(fmt.Sprintf(":%d", server.Profile.Port))
}

func (server *Server) OpenAPISkipper(c echo.Context) bool {
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

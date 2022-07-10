package server

import (
	"fmt"
	"time"

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

	Profile *profile.Profile

	Store *store.Store
}

func NewServer(profile *profile.Profile) *Server {
	e := echo.New()
	e.Debug = true
	e.HideBanner = true
	e.HidePort = true

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "${method} ${uri} ${status}\n",
	}))

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

	s := &Server{
		e:       e,
		Profile: profile,
	}

	// Webhooks api skips auth checker.
	webhookGroup := e.Group("/h")
	s.registerWebhookRoutes(webhookGroup)

	apiGroup := e.Group("/api")
	apiGroup.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return BasicAuthMiddleware(s, next)
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

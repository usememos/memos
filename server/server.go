package server

import (
	"fmt"
	"memos/api"
	"memos/common"

	"github.com/gorilla/sessions"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Server struct {
	e *echo.Echo

	UserService     api.UserService
	MemoService     api.MemoService
	ShortcutService api.ShortcutService
	ResourceService api.ResourceService

	port int
}

func NewServer() *Server {
	e := echo.New()
	e.Debug = true
	e.HideBanner = true
	e.HidePort = false

	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Skipper: middleware.DefaultSkipper,
		Root:    "web/dist",
		Browse:  false,
		HTML5:   true,
	}))

	e.Use(session.Middleware(sessions.NewCookieStore([]byte(common.GenUUID()))))

	s := &Server{
		e:    e,
		port: 8080,
	}

	webhookGroup := e.Group("/h")
	s.registerWebhookRoutes(webhookGroup)

	apiGroup := e.Group("/api")
	apiGroup.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return JWTMiddleware(s.UserService, next)
	})
	s.registerAuthRoutes(apiGroup)
	s.registerUserRoutes(apiGroup)
	s.registerMemoRoutes(apiGroup)
	s.registerShortcutRoutes(apiGroup)
	s.registerResourceRoutes(apiGroup)

	return s
}

func (server *Server) Run() error {
	return server.e.Start(fmt.Sprintf(":%d", server.port))
}

package server

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
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

	e.Use(middleware.Gzip())

	e.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
		Skipper: func(c echo.Context) bool {
			return s.DefaultAuthSkipper(c)
		},
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
	registerGetterPublicRoutes(publicGroup)

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

func (s *Server) Run(ctx context.Context) error {
	if err := s.createServerStartActivity(ctx); err != nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return s.e.Start(fmt.Sprintf(":%d", s.Profile.Port))
}

func (s *Server) createServerStartActivity(ctx context.Context) error {
	payload := api.ActivityServerStartPayload{
		Profile: s.Profile,
	}
	payloadStr, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	_, err = s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: api.UnknownID,
		Type:      api.ActivityServerStart,
		Level:     api.ActivityInfo,
		Payload:   string(payloadStr),
	})
	return err
}

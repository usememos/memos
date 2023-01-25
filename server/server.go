package server

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	metric "github.com/usememos/memos/plugin/metrics"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"

	"github.com/gorilla/sessions"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Server struct {
	e *echo.Echo

	ID        string
	Profile   *profile.Profile
	Store     *store.Store
	Collector *MetricCollector
}

func NewServer(ctx context.Context, profile *profile.Profile) (*Server, error) {
	e := echo.New()
	e.Debug = true
	e.HideBanner = true
	e.HidePort = true

	s := &Server{
		e:       e,
		Profile: profile,
	}

	db := db.NewDB(profile)
	if err := db.Open(ctx); err != nil {
		return nil, errors.Wrap(err, "cannot open db")
	}

	storeInstance := store.New(db.DBInstance, profile)
	s.Store = storeInstance

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: `{"time":"${time_rfc3339}",` +
			`"method":"${method}","uri":"${uri}",` +
			`"status":${status},"error":"${error}"}` + "\n",
	}))

	e.Use(middleware.Gzip())

	e.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
		Skipper:     s.DefaultAuthSkipper,
		TokenLookup: "cookie:_csrf",
	}))

	e.Use(middleware.CORS())

	e.Use(middleware.SecureWithConfig(middleware.SecureConfig{
		Skipper:            DefaultGetRequestSkipper,
		XSSProtection:      "1; mode=block",
		ContentTypeNosniff: "nosniff",
		XFrameOptions:      "SAMEORIGIN",
		HSTSPreloadEnabled: false,
	}))

	e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
		ErrorMessage: "Request timeout",
		Timeout:      30 * time.Second,
	}))

	serverID, err := s.getSystemServerID(ctx)
	if err != nil {
		return nil, err
	}
	s.ID = serverID

	secretSessionName := "usememos"
	if profile.Mode == "prod" {
		secretSessionName, err = s.getSystemSecretSessionName(ctx)
		if err != nil {
			return nil, err
		}
	}
	e.Use(session.Middleware(sessions.NewCookieStore([]byte(secretSessionName))))

	embedFrontend(e)

	// Register MetricCollector to server.
	s.registerMetricCollector()

	rootGroup := e.Group("")
	s.registerRSSRoutes(rootGroup)

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

	return s, nil
}

func (s *Server) Run(ctx context.Context) error {
	if err := s.createServerStartActivity(ctx); err != nil {
		return errors.Wrap(err, "failed to create activity")
	}
	s.Collector.Identify(ctx)
	return s.e.Start(fmt.Sprintf(":%d", s.Profile.Port))
}

func (s *Server) createServerStartActivity(ctx context.Context) error {
	payload := api.ActivityServerStartPayload{
		ServerID: s.ID,
		Profile:  s.Profile,
	}
	payloadStr, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: api.UnknownID,
		Type:      api.ActivityServerStart,
		Level:     api.ActivityInfo,
		Payload:   string(payloadStr),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	s.Collector.Collect(ctx, &metric.Metric{
		Name: string(activity.Type),
	})
	return err
}

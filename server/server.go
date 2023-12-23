package server

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/pkg/errors"

	apiv1 "github.com/usememos/memos/api/v1"
	apiv2 "github.com/usememos/memos/api/v2"
	"github.com/usememos/memos/plugin/telegram"
	"github.com/usememos/memos/server/frontend"
	"github.com/usememos/memos/server/integration"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/service/metric"
	versionchecker "github.com/usememos/memos/server/service/version_checker"
	"github.com/usememos/memos/store"
)

type Server struct {
	e *echo.Echo

	ID      string
	Secret  string
	Profile *profile.Profile
	Store   *store.Store

	// Asynchronous runners.
	telegramBot *telegram.Bot
}

func NewServer(ctx context.Context, profile *profile.Profile, store *store.Store) (*Server, error) {
	e := echo.New()
	e.Debug = true
	e.HideBanner = true
	e.HidePort = true

	s := &Server{
		e:       e,
		Store:   store,
		Profile: profile,

		// Asynchronous runners.
		telegramBot: telegram.NewBotWithHandler(integration.NewTelegramHandler(store)),
	}

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: `{"time":"${time_rfc3339}","latency":"${latency_human}",` +
			`"method":"${method}","uri":"${uri}",` +
			`"status":${status},"error":"${error}"}` + "\n",
	}))

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		Skipper:      grpcRequestSkipper,
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete},
	}))

	e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
		Skipper: timeoutSkipper,
		Timeout: 30 * time.Second,
	}))

	serverID, err := s.getSystemServerID(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to retrieve system server ID")
	}
	s.ID = serverID

	// Register frontend service.
	frontendService := frontend.NewFrontendService(profile, store)
	frontendService.Serve(ctx, e)

	secret := "usememos"
	if profile.Mode == "prod" {
		secret, err = s.getSystemSecretSessionName(ctx)
		if err != nil {
			return nil, errors.Wrap(err, "failed to retrieve system secret session name")
		}
	}
	s.Secret = secret

	// Register healthz endpoint.
	e.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "Service ready.")
	})

	// Register API v1 endpoints.
	rootGroup := e.Group("")
	apiV1Service := apiv1.NewAPIV1Service(s.Secret, profile, store, s.telegramBot)
	apiV1Service.Register(rootGroup)

	apiV2Service := apiv2.NewAPIV2Service(s.Secret, profile, store, s.Profile.Port+1)
	// Register gRPC gateway as api v2.
	if err := apiV2Service.RegisterGateway(ctx, e); err != nil {
		return nil, errors.Wrap(err, "failed to register gRPC gateway")
	}

	return s, nil
}

func (s *Server) Start(ctx context.Context) error {
	go versionchecker.NewVersionChecker(s.Store, s.Profile).Start(ctx)
	go s.telegramBot.Start(ctx)

	metric.Enqueue("server start")
	return s.e.Start(fmt.Sprintf("%s:%d", s.Profile.Addr, s.Profile.Port))
}

func (s *Server) Shutdown(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Shutdown echo server
	if err := s.e.Shutdown(ctx); err != nil {
		fmt.Printf("failed to shutdown server, error: %v\n", err)
	}

	// Close database connection
	if err := s.Store.Close(); err != nil {
		fmt.Printf("failed to close database, error: %v\n", err)
	}

	fmt.Printf("memos stopped properly\n")
}

func (s *Server) GetEcho() *echo.Echo {
	return s.e
}

func (s *Server) getSystemServerID(ctx context.Context) (string, error) {
	serverIDSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingServerIDName.String(),
	})
	if err != nil {
		return "", err
	}
	if serverIDSetting == nil || serverIDSetting.Value == "" {
		serverIDSetting, err = s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
			Name:  apiv1.SystemSettingServerIDName.String(),
			Value: uuid.NewString(),
		})
		if err != nil {
			return "", err
		}
	}
	return serverIDSetting.Value, nil
}

func (s *Server) getSystemSecretSessionName(ctx context.Context) (string, error) {
	secretSessionNameValue, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingSecretSessionName.String(),
	})
	if err != nil {
		return "", err
	}
	if secretSessionNameValue == nil || secretSessionNameValue.Value == "" {
		secretSessionNameValue, err = s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
			Name:  apiv1.SystemSettingSecretSessionName.String(),
			Value: uuid.NewString(),
		})
		if err != nil {
			return "", err
		}
	}
	return secretSessionNameValue.Value, nil
}

func grpcRequestSkipper(c echo.Context) bool {
	return strings.HasPrefix(c.Request().URL.Path, "/memos.api.v2.")
}

func timeoutSkipper(c echo.Context) bool {
	if grpcRequestSkipper(c) {
		return true
	}

	// Skip timeout for blob upload which is frequently timed out.
	return c.Request().Method == http.MethodPost && c.Request().URL.Path == "/api/v1/resource/blob"
}

package v1

import (
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type APIV1Service struct {
	Secret  string
	Profile *profile.Profile
	Store   *store.Store
}

func NewAPIV1Service(secret string, profile *profile.Profile, store *store.Store) *APIV1Service {
	return &APIV1Service{
		Secret:  secret,
		Profile: profile,
		Store:   store,
	}
}

func (s *APIV1Service) Register(e *echo.Echo) {
	apiV1Group := e.Group("/api/v1")
	s.registerTestRoutes(apiV1Group)
	s.registerAuthRoutes(apiV1Group, s.Secret)
}

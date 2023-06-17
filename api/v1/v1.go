package v1

import (
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

const (
	// Context section
	// The key name used to store user id in the context
	// user id is extracted from the jwt token subject field.
	userIDContextKey = "user-id"
)

func getUserIDContextKey() string {
	return userIDContextKey
}

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

func (s *APIV1Service) Register(apiV1Group *echo.Group) {
	s.registerTestRoutes(apiV1Group)
	s.registerAuthRoutes(apiV1Group, s.Secret)
	s.registerIdentityProviderRoutes(apiV1Group)
}

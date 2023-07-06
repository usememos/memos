package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/store"
)

type IdentityProviderType string

const (
	IdentityProviderOAuth2Type IdentityProviderType = "OAUTH2"
)

func (t IdentityProviderType) String() string {
	return string(t)
}

type IdentityProviderConfig struct {
	OAuth2Config *IdentityProviderOAuth2Config `json:"oauth2Config"`
}

type IdentityProviderOAuth2Config struct {
	ClientID     string        `json:"clientId"`
	ClientSecret string        `json:"clientSecret"`
	AuthURL      string        `json:"authUrl"`
	TokenURL     string        `json:"tokenUrl"`
	UserInfoURL  string        `json:"userInfoUrl"`
	Scopes       []string      `json:"scopes"`
	FieldMapping *FieldMapping `json:"fieldMapping"`
}

type FieldMapping struct {
	Identifier  string `json:"identifier"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
}

type IdentityProvider struct {
	ID               int                     `json:"id"`
	Name             string                  `json:"name"`
	Type             IdentityProviderType    `json:"type"`
	IdentifierFilter string                  `json:"identifierFilter"`
	Config           *IdentityProviderConfig `json:"config"`
}

type CreateIdentityProviderRequest struct {
	Name             string                  `json:"name"`
	Type             IdentityProviderType    `json:"type"`
	IdentifierFilter string                  `json:"identifierFilter"`
	Config           *IdentityProviderConfig `json:"config"`
}

type UpdateIdentityProviderRequest struct {
	ID               int                     `json:"-"`
	Type             IdentityProviderType    `json:"type"`
	Name             *string                 `json:"name"`
	IdentifierFilter *string                 `json:"identifierFilter"`
	Config           *IdentityProviderConfig `json:"config"`
}

func (s *APIV1Service) registerIdentityProviderRoutes(g *echo.Group) {
	g.POST("/idp", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderCreate := &CreateIdentityProviderRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(identityProviderCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post identity provider request").SetInternal(err)
		}

		identityProvider, err := s.Store.CreateIdentityProvider(ctx, &store.IdentityProvider{
			Name:             identityProviderCreate.Name,
			Type:             store.IdentityProviderType(identityProviderCreate.Type),
			IdentifierFilter: identityProviderCreate.IdentifierFilter,
			Config:           convertIdentityProviderConfigToStore(identityProviderCreate.Config),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, convertIdentityProviderFromStore(identityProvider))
	})

	g.PATCH("/idp/:idpId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderID, err := strconv.Atoi(c.Param("idpId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
		}

		identityProviderPatch := &UpdateIdentityProviderRequest{
			ID: identityProviderID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(identityProviderPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch identity provider request").SetInternal(err)
		}

		identityProvider, err := s.Store.UpdateIdentityProvider(ctx, &store.UpdateIdentityProvider{
			ID:               identityProviderPatch.ID,
			Type:             store.IdentityProviderType(identityProviderPatch.Type),
			Name:             identityProviderPatch.Name,
			IdentifierFilter: identityProviderPatch.IdentifierFilter,
			Config:           convertIdentityProviderConfigToStore(identityProviderPatch.Config),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, convertIdentityProviderFromStore(identityProvider))
	})

	g.GET("/idp", func(c echo.Context) error {
		ctx := c.Request().Context()
		list, err := s.Store.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find identity provider list").SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		isHostUser := false
		if ok {
			user, err := s.Store.GetUser(ctx, &store.FindUser{
				ID: &userID,
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
			}
			if user == nil || user.Role == store.RoleHost {
				isHostUser = true
			}
		}

		identityProviderList := []*IdentityProvider{}
		for _, item := range list {
			identityProvider := convertIdentityProviderFromStore(item)
			// data desensitize
			if !isHostUser {
				identityProvider.Config.OAuth2Config.ClientSecret = ""
			}
			identityProviderList = append(identityProviderList, identityProvider)
		}
		return c.JSON(http.StatusOK, identityProviderList)
	})

	g.GET("/idp/:idpId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderID, err := strconv.Atoi(c.Param("idpId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
		}
		identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
			ID: &identityProviderID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get identity provider").SetInternal(err)
		}
		if identityProvider == nil {
			return echo.NewHTTPError(http.StatusNotFound, "Identity provider not found")
		}

		return c.JSON(http.StatusOK, convertIdentityProviderFromStore(identityProvider))
	})

	g.DELETE("/idp/:idpId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderID, err := strconv.Atoi(c.Param("idpId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
		}

		if err = s.Store.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: identityProviderID}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func convertIdentityProviderFromStore(identityProvider *store.IdentityProvider) *IdentityProvider {
	return &IdentityProvider{
		ID:               identityProvider.ID,
		Name:             identityProvider.Name,
		Type:             IdentityProviderType(identityProvider.Type),
		IdentifierFilter: identityProvider.IdentifierFilter,
		Config:           convertIdentityProviderConfigFromStore(identityProvider.Config),
	}
}

func convertIdentityProviderConfigFromStore(config *store.IdentityProviderConfig) *IdentityProviderConfig {
	return &IdentityProviderConfig{
		OAuth2Config: &IdentityProviderOAuth2Config{
			ClientID:     config.OAuth2Config.ClientID,
			ClientSecret: config.OAuth2Config.ClientSecret,
			AuthURL:      config.OAuth2Config.AuthURL,
			TokenURL:     config.OAuth2Config.TokenURL,
			UserInfoURL:  config.OAuth2Config.UserInfoURL,
			Scopes:       config.OAuth2Config.Scopes,
			FieldMapping: &FieldMapping{
				Identifier:  config.OAuth2Config.FieldMapping.Identifier,
				DisplayName: config.OAuth2Config.FieldMapping.DisplayName,
				Email:       config.OAuth2Config.FieldMapping.Email,
			},
		},
	}
}

func convertIdentityProviderConfigToStore(config *IdentityProviderConfig) *store.IdentityProviderConfig {
	return &store.IdentityProviderConfig{
		OAuth2Config: &store.IdentityProviderOAuth2Config{
			ClientID:     config.OAuth2Config.ClientID,
			ClientSecret: config.OAuth2Config.ClientSecret,
			AuthURL:      config.OAuth2Config.AuthURL,
			TokenURL:     config.OAuth2Config.TokenURL,
			UserInfoURL:  config.OAuth2Config.UserInfoURL,
			Scopes:       config.OAuth2Config.Scopes,
			FieldMapping: &store.FieldMapping{
				Identifier:  config.OAuth2Config.FieldMapping.Identifier,
				DisplayName: config.OAuth2Config.FieldMapping.DisplayName,
				Email:       config.OAuth2Config.FieldMapping.Email,
			},
		},
	}
}

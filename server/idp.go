package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"
)

func (s *Server) registerIdentityProviderRoutes(g *echo.Group) {
	g.POST("/idp", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderCreate := &api.IdentityProviderCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(identityProviderCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post identity provider request").SetInternal(err)
		}

		identityProviderMessage, err := s.Store.CreateIdentityProvider(ctx, &store.IdentityProviderMessage{
			Name:             identityProviderCreate.Name,
			Type:             store.IdentityProviderType(identityProviderCreate.Type),
			IdentifierFilter: identityProviderCreate.IdentifierFilter,
			Config:           convertIdentityProviderConfigToStore(identityProviderCreate.Config),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(convertIdentityProviderFromStore(identityProviderMessage)))
	})

	g.PATCH("/idp/:idpId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderID, err := strconv.Atoi(c.Param("idpId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
		}

		identityProviderPatch := &api.IdentityProviderPatch{
			ID: identityProviderID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(identityProviderPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch identity provider request").SetInternal(err)
		}

		identityProviderMessage, err := s.Store.UpdateIdentityProvider(ctx, &store.UpdateIdentityProviderMessage{
			ID:               identityProviderPatch.ID,
			Type:             store.IdentityProviderType(identityProviderPatch.Type),
			Name:             identityProviderPatch.Name,
			IdentifierFilter: identityProviderPatch.IdentifierFilter,
			Config:           convertIdentityProviderConfigToStore(identityProviderPatch.Config),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(convertIdentityProviderFromStore(identityProviderMessage)))
	})

	g.GET("/idp", func(c echo.Context) error {
		ctx := c.Request().Context()
		identityProviderMessageList, err := s.Store.ListIdentityProviders(ctx, &store.FindIdentityProviderMessage{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find identity provider list").SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		isHostUser := false
		if ok {
			user, err := s.Store.FindUser(ctx, &api.UserFind{
				ID: &userID,
			})
			if err != nil && common.ErrorCode(err) != common.NotFound {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
			}
			if user != nil && user.Role == api.Host {
				isHostUser = true
			}
		}

		identityProviderList := []*api.IdentityProvider{}
		for _, identityProviderMessage := range identityProviderMessageList {
			identityProvider := convertIdentityProviderFromStore(identityProviderMessage)
			// data desensitize
			if !isHostUser {
				identityProvider.Config.OAuth2Config.ClientSecret = ""
			}
			identityProviderList = append(identityProviderList, identityProvider)
		}
		return c.JSON(http.StatusOK, composeResponse(identityProviderList))
	})

	g.GET("/idp/:idpId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		// We should only show identity provider list to host user.
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderID, err := strconv.Atoi(c.Param("idpId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
		}
		identityProviderMessage, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProviderMessage{
			ID: &identityProviderID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(convertIdentityProviderFromStore(identityProviderMessage)))
	})

	g.DELETE("/idp/:idpId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		identityProviderID, err := strconv.Atoi(c.Param("idpId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
		}

		if err = s.Store.DeleteIdentityProvider(ctx, &store.DeleteIdentityProviderMessage{ID: identityProviderID}); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Identity provider ID not found: %d", identityProviderID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete identity provider").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func convertIdentityProviderFromStore(identityProviderMessage *store.IdentityProviderMessage) *api.IdentityProvider {
	return &api.IdentityProvider{
		ID:               identityProviderMessage.ID,
		Name:             identityProviderMessage.Name,
		Type:             api.IdentityProviderType(identityProviderMessage.Type),
		IdentifierFilter: identityProviderMessage.IdentifierFilter,
		Config:           convertIdentityProviderConfigFromStore(identityProviderMessage.Config),
	}
}

func convertIdentityProviderConfigFromStore(config *store.IdentityProviderConfig) *api.IdentityProviderConfig {
	return &api.IdentityProviderConfig{
		OAuth2Config: &api.IdentityProviderOAuth2Config{
			ClientID:     config.OAuth2Config.ClientID,
			ClientSecret: config.OAuth2Config.ClientSecret,
			AuthURL:      config.OAuth2Config.AuthURL,
			TokenURL:     config.OAuth2Config.TokenURL,
			UserInfoURL:  config.OAuth2Config.UserInfoURL,
			Scopes:       config.OAuth2Config.Scopes,
			FieldMapping: &api.FieldMapping{
				Identifier:  config.OAuth2Config.FieldMapping.Identifier,
				DisplayName: config.OAuth2Config.FieldMapping.DisplayName,
				Email:       config.OAuth2Config.FieldMapping.Email,
			},
		},
	}
}

func convertIdentityProviderConfigToStore(config *api.IdentityProviderConfig) *store.IdentityProviderConfig {
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

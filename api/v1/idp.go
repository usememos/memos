package v1

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/common/util"
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
	ID               int32                   `json:"id"`
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
	ID               int32                   `json:"-"`
	Type             IdentityProviderType    `json:"type"`
	Name             *string                 `json:"name"`
	IdentifierFilter *string                 `json:"identifierFilter"`
	Config           *IdentityProviderConfig `json:"config"`
}

func (s *APIV1Service) registerIdentityProviderRoutes(g *echo.Group) {
	g.GET("/idp", s.GetIdentityProviderList)
	g.POST("/idp", s.CreateIdentityProvider)
	g.GET("/idp/:idpId", s.GetIdentityProvider)
	g.PATCH("/idp/:idpId", s.UpdateIdentityProvider)
	g.DELETE("/idp/:idpId", s.DeleteIdentityProvider)
}

// GetIdentityProviderList godoc
//
//	@Summary		Get a list of identity providers
//	@Description	*clientSecret is only available for host user
//	@Tags			idp
//	@Produce		json
//	@Success		200	{object}	[]IdentityProvider	"List of available identity providers"
//	@Failure		500	{object}	nil					"Failed to find identity provider list | Failed to find user"
//	@Router			/api/v1/idp [GET]
func (s *APIV1Service) GetIdentityProviderList(c echo.Context) error {
	ctx := c.Request().Context()
	list, err := s.Store.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find identity provider list").SetInternal(err)
	}

	userID, ok := c.Get(userIDContextKey).(int32)
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
}

// CreateIdentityProvider godoc
//
//	@Summary	Create Identity Provider
//	@Tags		idp
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateIdentityProviderRequest	true	"Identity provider information"
//	@Success	200		{object}	store.IdentityProvider			"Identity provider information"
//	@Failure	401		{object}	nil								"Missing user in session | Unauthorized"
//	@Failure	400		{object}	nil								"Malformatted post identity provider request"
//	@Failure	500		{object}	nil								"Failed to find user | Failed to create identity provider"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/idp [POST]
func (s *APIV1Service) CreateIdentityProvider(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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
}

// GetIdentityProvider godoc
//
//	@Summary	Get an identity provider by ID
//	@Tags		idp
//	@Accept		json
//	@Produce	json
//	@Param		idpId	path		int						true	"Identity provider ID"
//	@Success	200		{object}	store.IdentityProvider	"Requested identity provider"
//	@Failure	400		{object}	nil						"ID is not a number: %s"
//	@Failure	401		{object}	nil						"Missing user in session | Unauthorized"
//	@Failure	404		{object}	nil						"Identity provider not found"
//	@Failure	500		{object}	nil						"Failed to find identity provider list | Failed to find user"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/idp/{idpId} [GET]
func (s *APIV1Service) GetIdentityProvider(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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

	identityProviderID, err := util.ConvertStringToInt32(c.Param("idpId"))
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
}

// DeleteIdentityProvider godoc
//
//	@Summary	Delete an identity provider by ID
//	@Tags		idp
//	@Accept		json
//	@Produce	json
//	@Param		idpId	path		int		true	"Identity Provider ID"
//	@Success	200		{boolean}	true	"Identity Provider deleted"
//	@Failure	400		{object}	nil		"ID is not a number: %s | Malformatted patch identity provider request"
//	@Failure	401		{object}	nil		"Missing user in session | Unauthorized"
//	@Failure	500		{object}	nil		"Failed to find user | Failed to patch identity provider"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/idp/{idpId} [DELETE]
func (s *APIV1Service) DeleteIdentityProvider(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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

	identityProviderID, err := util.ConvertStringToInt32(c.Param("idpId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("idpId"))).SetInternal(err)
	}

	if err = s.Store.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: identityProviderID}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete identity provider").SetInternal(err)
	}
	return c.JSON(http.StatusOK, true)
}

// UpdateIdentityProvider godoc
//
//	@Summary	Update an identity provider by ID
//	@Tags		idp
//	@Accept		json
//	@Produce	json
//	@Param		idpId	path		int								true	"Identity Provider ID"
//	@Param		body	body		UpdateIdentityProviderRequest	true	"Patched identity provider information"
//	@Success	200		{object}	store.IdentityProvider			"Patched identity provider"
//	@Failure	400		{object}	nil								"ID is not a number: %s | Malformatted patch identity provider request"
//	@Failure	401		{object}	nil								"Missing user in session | Unauthorized
//	@Failure	500		{object}	nil								"Failed to find user | Failed to patch identity provider"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/idp/{idpId} [PATCH]
func (s *APIV1Service) UpdateIdentityProvider(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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

	identityProviderID, err := util.ConvertStringToInt32(c.Param("idpId"))
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

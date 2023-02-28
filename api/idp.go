package api

type IdentityProviderType string

const (
	IdentityProviderOAuth2 IdentityProviderType = "OAUTH2"
)

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

type IdentityProviderCreate struct {
	Name             string                  `json:"name"`
	Type             IdentityProviderType    `json:"type"`
	IdentifierFilter string                  `json:"identifierFilter"`
	Config           *IdentityProviderConfig `json:"config"`
}

type IdentityProviderFind struct {
	ID *int
}

type IdentityProviderPatch struct {
	ID               int
	Type             IdentityProviderType    `json:"type"`
	Name             *string                 `json:"name"`
	IdentifierFilter *string                 `json:"identifierFilter"`
	Config           *IdentityProviderConfig `json:"config"`
}

type IdentityProviderDelete struct {
	ID int
}

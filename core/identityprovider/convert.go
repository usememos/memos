package identityprovider

import (
	"strings"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// NamePrefix starts every identity provider resource name.
const NamePrefix = "identity-providers/"

// ToStore converts an API identity provider for the store. The UID comes from
// the resource name when it has one.
func ToStore(provider *apipb.IdentityProvider) *storepb.IdentityProvider {
	if provider == nil {
		return nil
	}
	return &storepb.IdentityProvider{
		Uid:              strings.TrimPrefix(provider.Name, NamePrefix),
		Name:             provider.Title,
		IdentifierFilter: provider.IdentifierFilter,
		Type:             storepb.IdentityProvider_Type(storepb.IdentityProvider_Type_value[provider.Type.String()]),
		Config:           ConfigToStore(provider.Type, provider.Config),
	}
}

// ConfigToStore converts the type-specific configuration for the store. It
// returns nil for a type without a configuration.
func ConfigToStore(providerType apipb.IdentityProvider_Type, config *apipb.IdentityProviderConfig) *storepb.IdentityProviderConfig {
	if providerType != apipb.IdentityProvider_OAUTH2 {
		return nil
	}
	oauth2Config := config.GetOauth2Config()
	if oauth2Config == nil {
		return &storepb.IdentityProviderConfig{}
	}
	fieldMapping := oauth2Config.GetFieldMapping()
	return &storepb.IdentityProviderConfig{
		Config: &storepb.IdentityProviderConfig_Oauth2Config{
			Oauth2Config: &storepb.OAuth2Config{
				ClientId:     oauth2Config.ClientId,
				ClientSecret: oauth2Config.ClientSecret,
				AuthUrl:      oauth2Config.AuthUrl,
				TokenUrl:     oauth2Config.TokenUrl,
				UserInfoUrl:  oauth2Config.UserInfoUrl,
				Scopes:       oauth2Config.Scopes,
				FieldMapping: &storepb.FieldMapping{
					Identifier:  fieldMapping.GetIdentifier(),
					DisplayName: fieldMapping.GetDisplayName(),
					Email:       fieldMapping.GetEmail(),
					AvatarUrl:   fieldMapping.GetAvatarUrl(),
				},
			},
		},
	}
}

// FromStore converts a stored identity provider for the API. It keeps the
// client secret; a response must clear it.
func FromStore(provider *storepb.IdentityProvider) *apipb.IdentityProvider {
	if provider == nil {
		return nil
	}
	result := &apipb.IdentityProvider{
		Name:             NamePrefix + provider.Uid,
		Title:            provider.Name,
		IdentifierFilter: provider.IdentifierFilter,
		Type:             apipb.IdentityProvider_Type(apipb.IdentityProvider_Type_value[provider.Type.String()]),
	}
	if provider.Type == storepb.IdentityProvider_OAUTH2 {
		oauth2Config := provider.GetConfig().GetOauth2Config()
		fieldMapping := oauth2Config.GetFieldMapping()
		result.Config = &apipb.IdentityProviderConfig{
			Config: &apipb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &apipb.OAuth2Config{
					ClientId:     oauth2Config.GetClientId(),
					ClientSecret: oauth2Config.GetClientSecret(),
					AuthUrl:      oauth2Config.GetAuthUrl(),
					TokenUrl:     oauth2Config.GetTokenUrl(),
					UserInfoUrl:  oauth2Config.GetUserInfoUrl(),
					Scopes:       oauth2Config.GetScopes(),
					FieldMapping: &apipb.FieldMapping{
						Identifier:  fieldMapping.GetIdentifier(),
						DisplayName: fieldMapping.GetDisplayName(),
						Email:       fieldMapping.GetEmail(),
						AvatarUrl:   fieldMapping.GetAvatarUrl(),
					},
				},
			},
		}
	}
	return result
}

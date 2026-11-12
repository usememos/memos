package identityprovider

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func validProvider() *storepb.IdentityProvider {
	return &storepb.IdentityProvider{
		Uid:  "company-sso",
		Name: "Company SSO",
		Type: storepb.IdentityProvider_OAUTH2,
		Config: &storepb.IdentityProviderConfig{
			Config: &storepb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &storepb.OAuth2Config{
					ClientId:     "memos",
					ClientSecret: "secret",
					AuthUrl:      "https://idp.example.com/authorize",
					TokenUrl:     "https://idp.example.com/token",
					UserInfoUrl:  "http://idp.internal/userinfo",
					Scopes:       []string{"openid"},
					FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
				},
			},
		},
	}
}

func TestValidate(t *testing.T) {
	require.NoError(t, Validate(validProvider()))

	public := validProvider()
	public.Config.GetOauth2Config().ClientSecret = ""
	public.Config.GetOauth2Config().Scopes = nil
	require.NoError(t, Validate(public), "a public client without a secret or scopes is allowed")

	tests := map[string]struct {
		mutate func(*storepb.IdentityProvider)
		want   string
	}{
		"invalid uid":        {func(p *storepb.IdentityProvider) { p.Uid = "-sso" }, "uid must be"},
		"blank title":        {func(p *storepb.IdentityProvider) { p.Name = "  " }, "title is required"},
		"unspecified type":   {func(p *storepb.IdentityProvider) { p.Type = storepb.IdentityProvider_TYPE_UNSPECIFIED }, "type must be OAUTH2"},
		"invalid filter":     {func(p *storepb.IdentityProvider) { p.IdentifierFilter = "(" }, "identifier_filter"},
		"missing config":     {func(p *storepb.IdentityProvider) { p.Config = nil }, "config.oauth2_config is required"},
		"missing client id":  {func(p *storepb.IdentityProvider) { p.Config.GetOauth2Config().ClientId = "" }, "client_id is required"},
		"relative auth url":  {func(p *storepb.IdentityProvider) { p.Config.GetOauth2Config().AuthUrl = "/authorize" }, "auth_url must be"},
		"non-http token url": {func(p *storepb.IdentityProvider) { p.Config.GetOauth2Config().TokenUrl = "ftp://idp/token" }, "token_url must be"},
		"empty scope":        {func(p *storepb.IdentityProvider) { p.Config.GetOauth2Config().Scopes = []string{"openid", " "} }, "scopes[1]"},
		"missing mapping":    {func(p *storepb.IdentityProvider) { p.Config.GetOauth2Config().FieldMapping = nil }, "field_mapping.identifier"},
		"missing identifier": {func(p *storepb.IdentityProvider) { p.Config.GetOauth2Config().FieldMapping.Identifier = "" }, "field_mapping.identifier"},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			provider := proto.CloneOf(validProvider())
			test.mutate(provider)
			err := Validate(provider)
			require.Error(t, err)
			require.Contains(t, err.Error(), test.want)
		})
	}

	require.Error(t, Validate(nil))
}

func TestConversionRoundTrips(t *testing.T) {
	stored := validProvider()
	stored.IdentifierFilter = "^.+@example\\.com$"
	stored.Config.GetOauth2Config().FieldMapping = &storepb.FieldMapping{Identifier: "sub", DisplayName: "name", Email: "email", AvatarUrl: "picture"}

	api := FromStore(stored)
	require.Equal(t, NamePrefix+"company-sso", api.GetName())
	require.Equal(t, "secret", api.GetConfig().GetOauth2Config().GetClientSecret(), "FromStore keeps the secret; responses clear it")
	require.True(t, proto.Equal(stored, ToStore(api)))

	// A missing config or field mapping converts without panicking and then fails validation.
	api.Config = nil
	require.Error(t, Validate(ToStore(api)))
}

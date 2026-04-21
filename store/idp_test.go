package store

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// TestConvertIdentityProviderConfigFromRaw_LegacyOAuth2Shape ensures rows
// written by pre-5868 memos binaries (raw OAuth2Config JSON) still decode
// correctly into an IdentityProviderConfig. Breaking this path would silently
// blank every existing OAuth2 IdP on first read after upgrade.
func TestConvertIdentityProviderConfigFromRaw_LegacyOAuth2Shape(t *testing.T) {
	legacy := `{"clientId":"abc","clientSecret":"s3cret","authUrl":"https://ex.com/auth","tokenUrl":"https://ex.com/token","userInfoUrl":"https://ex.com/user","scopes":["openid","profile"],"fieldMapping":{"identifier":"sub","displayName":"name","email":"email"}}`

	cfg, err := convertIdentityProviderConfigFromRaw(storepb.IdentityProvider_OAUTH2, legacy)
	require.NoError(t, err)
	require.NotNil(t, cfg)

	oauth2 := cfg.GetOauth2Config()
	require.NotNil(t, oauth2, "legacy format must still populate oauth2 config")
	require.Equal(t, "abc", oauth2.ClientId)
	require.Equal(t, "s3cret", oauth2.ClientSecret)
	require.Equal(t, "https://ex.com/auth", oauth2.AuthUrl)
	require.Equal(t, []string{"openid", "profile"}, oauth2.Scopes)
	require.Equal(t, "sub", oauth2.FieldMapping.Identifier)
	require.Empty(t, cfg.GetIdentifierTransform(), "legacy rows carry no transform")
}

// TestConvertIdentityProviderConfigFromRaw_NewWrapperShape ensures rows
// written with identifier_transform set decode using the wrapped
// IdentityProviderConfig JSON shape.
func TestConvertIdentityProviderConfigFromRaw_NewWrapperShape(t *testing.T) {
	transform := `lower(split(identifier, "@")[0])`
	src := &storepb.IdentityProviderConfig{
		Config: &storepb.IdentityProviderConfig_Oauth2Config{
			Oauth2Config: &storepb.OAuth2Config{
				ClientId:     "abc",
				ClientSecret: "s3cret",
				FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
			},
		},
		IdentifierTransform: &transform,
	}
	bytes, err := protojson.Marshal(src)
	require.NoError(t, err)
	require.Contains(t, string(bytes), "identifierTransform")

	cfg, err := convertIdentityProviderConfigFromRaw(storepb.IdentityProvider_OAUTH2, string(bytes))
	require.NoError(t, err)
	require.Equal(t, "abc", cfg.GetOauth2Config().ClientId)
	require.Equal(t, transform, cfg.GetIdentifierTransform())
}

// TestConvertIdentityProviderConfigToRaw_WritesLegacyWhenTransformEmpty is
// the downgrade guard: absent identifier_transform we must keep writing the
// historical OAuth2Config JSON shape so rolling back to an older memos binary
// continues to read every row.
func TestConvertIdentityProviderConfigToRaw_WritesLegacyWhenTransformEmpty(t *testing.T) {
	cfg := &storepb.IdentityProviderConfig{
		Config: &storepb.IdentityProviderConfig_Oauth2Config{
			Oauth2Config: &storepb.OAuth2Config{
				ClientId:     "abc",
				ClientSecret: "s3cret",
				AuthUrl:      "https://ex.com/auth",
				FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
			},
		},
	}

	raw, err := convertIdentityProviderConfigToRaw(storepb.IdentityProvider_OAUTH2, cfg)
	require.NoError(t, err)
	require.Contains(t, raw, `"clientId":"abc"`)
	require.False(t, strings.Contains(raw, "oauth2Config"), "empty transform must write legacy OAuth2Config shape: %s", raw)
	require.False(t, strings.Contains(raw, "identifierTransform"), "empty transform must not appear in serialized output")
}

// TestConvertIdentityProviderConfigToRaw_WritesWrapperWhenTransformSet
// verifies that the new shape is only engaged when the new field is in use.
func TestConvertIdentityProviderConfigToRaw_WritesWrapperWhenTransformSet(t *testing.T) {
	transform := `lower(split(identifier, "@")[0])`
	cfg := &storepb.IdentityProviderConfig{
		Config: &storepb.IdentityProviderConfig_Oauth2Config{
			Oauth2Config: &storepb.OAuth2Config{
				ClientId:     "abc",
				ClientSecret: "s3cret",
				FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
			},
		},
		IdentifierTransform: &transform,
	}

	raw, err := convertIdentityProviderConfigToRaw(storepb.IdentityProvider_OAUTH2, cfg)
	require.NoError(t, err)
	require.Contains(t, raw, `"oauth2Config"`)
	require.Contains(t, raw, `"identifierTransform"`)
}

// TestConvertIdentityProviderConfig_RoundTripLegacyToWrapper simulates
// upgrading an existing legacy row by configuring a transform and ensures the
// round-trip is lossless.
func TestConvertIdentityProviderConfig_RoundTripLegacyToWrapper(t *testing.T) {
	legacy := `{"clientId":"abc","clientSecret":"s3cret","authUrl":"https://ex.com/auth","tokenUrl":"https://ex.com/token","userInfoUrl":"https://ex.com/user","scopes":["openid"],"fieldMapping":{"identifier":"sub"}}`

	cfg, err := convertIdentityProviderConfigFromRaw(storepb.IdentityProvider_OAUTH2, legacy)
	require.NoError(t, err)

	transform := "identifier"
	cfg.IdentifierTransform = &transform
	raw, err := convertIdentityProviderConfigToRaw(storepb.IdentityProvider_OAUTH2, cfg)
	require.NoError(t, err)
	require.Contains(t, raw, `"identifierTransform":"identifier"`)

	roundtrip, err := convertIdentityProviderConfigFromRaw(storepb.IdentityProvider_OAUTH2, raw)
	require.NoError(t, err)
	require.Equal(t, "abc", roundtrip.GetOauth2Config().ClientId)
	require.Equal(t, "s3cret", roundtrip.GetOauth2Config().ClientSecret)
	require.Equal(t, "identifier", roundtrip.GetIdentifierTransform())
}

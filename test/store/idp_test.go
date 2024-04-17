package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestIdentityProviderStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	createdIDP, err := ts.CreateIdentityProvider(ctx, &storepb.IdentityProvider{
		Name:             "GitHub OAuth",
		Type:             storepb.IdentityProvider_OAUTH2,
		IdentifierFilter: "",
		Config: &storepb.IdentityProviderConfig{
			Config: &storepb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &storepb.OAuth2Config{
					ClientId:     "client_id",
					ClientSecret: "client_secret",
					AuthUrl:      "https://github.com/auth",
					TokenUrl:     "https://github.com/token",
					UserInfoUrl:  "https://github.com/user",
					Scopes:       []string{"login"},
					FieldMapping: &storepb.FieldMapping{
						Identifier:  "login",
						DisplayName: "name",
						Email:       "email",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	idp, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		ID: &createdIDP.Id,
	})
	require.NoError(t, err)
	require.NotNil(t, idp)
	require.Equal(t, createdIDP, idp)
	newName := "My GitHub OAuth"
	updatedIdp, err := ts.UpdateIdentityProvider(ctx, &store.UpdateIdentityProviderV1{
		ID:   idp.Id,
		Name: &newName,
	})
	require.NoError(t, err)
	require.Equal(t, newName, updatedIdp.Name)
	err = ts.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{
		ID: idp.Id,
	})
	require.NoError(t, err)
	idpList, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Equal(t, 0, len(idpList))
	ts.Close()
}

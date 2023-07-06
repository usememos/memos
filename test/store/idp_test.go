package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestIdentityProviderStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	createdIDP, err := ts.CreateIdentityProvider(ctx, &store.IdentityProvider{
		Name:             "GitHub OAuth",
		Type:             store.IdentityProviderOAuth2Type,
		IdentifierFilter: "",
		Config: &store.IdentityProviderConfig{
			OAuth2Config: &store.IdentityProviderOAuth2Config{
				ClientID:     "client_id",
				ClientSecret: "client_secret",
				AuthURL:      "https://github.com/auth",
				TokenURL:     "https://github.com/token",
				UserInfoURL:  "https://github.com/user",
				Scopes:       []string{"login"},
				FieldMapping: &store.FieldMapping{
					Identifier:  "login",
					DisplayName: "name",
					Email:       "emai",
				},
			},
		},
	})
	require.NoError(t, err)
	idp, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		ID: &createdIDP.ID,
	})
	require.NoError(t, err)
	require.NotNil(t, idp)
	require.Equal(t, createdIDP, idp)
	newName := "My GitHub OAuth"
	updatedIdp, err := ts.UpdateIdentityProvider(ctx, &store.UpdateIdentityProvider{
		ID:   idp.ID,
		Name: &newName,
	})
	require.NoError(t, err)
	require.Equal(t, newName, updatedIdp.Name)
	err = ts.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{
		ID: idp.ID,
	})
	require.NoError(t, err)
	idpList, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Equal(t, 0, len(idpList))
}

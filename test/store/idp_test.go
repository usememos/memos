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
	createdIDP, err := ts.CreateIdentityProvider(ctx, &store.IdentityProviderMessage{
		Name:             "GitHub OAuth",
		Type:             store.IdentityProviderOAuth2,
		IdentifierFilter: "",
		Config: &store.IdentityProviderConfig{
			OAuth2Config: &store.IdentityProviderOAuth2Config{
				ClientID:     "asd",
				ClientSecret: "123",
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
	idp, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProviderMessage{
		ID: &createdIDP.ID,
	})
	require.NoError(t, err)
	require.Equal(t, createdIDP, idp)
	err = ts.DeleteIdentityProvider(ctx, &store.DeleteIdentityProviderMessage{
		ID: idp.ID,
	})
	require.NoError(t, err)
	idpList, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProviderMessage{})
	require.NoError(t, err)
	require.Equal(t, 0, len(idpList))
}

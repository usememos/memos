package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestIdentityProviderStore(t *testing.T) {
	t.Parallel()
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

func TestIdentityProviderGetByID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create IDP
	idp, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Test IDP"))
	require.NoError(t, err)

	// Get by ID
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, idp.Id, found.Id)
	require.Equal(t, idp.Name, found.Name)

	// Get by non-existent ID
	nonExistentID := int32(99999)
	notFound, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &nonExistentID})
	require.NoError(t, err)
	require.Nil(t, notFound)

	ts.Close()
}

func TestIdentityProviderListMultiple(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create multiple IDPs
	_, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("GitHub OAuth"))
	require.NoError(t, err)
	_, err = ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Google OAuth"))
	require.NoError(t, err)
	_, err = ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("GitLab OAuth"))
	require.NoError(t, err)

	// List all
	idpList, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Len(t, idpList, 3)

	ts.Close()
}

func TestIdentityProviderListByID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create multiple IDPs
	idp1, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("GitHub OAuth"))
	require.NoError(t, err)
	_, err = ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Google OAuth"))
	require.NoError(t, err)

	// List by specific ID
	idpList, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{ID: &idp1.Id})
	require.NoError(t, err)
	require.Len(t, idpList, 1)
	require.Equal(t, "GitHub OAuth", idpList[0].Name)

	ts.Close()
}

func TestIdentityProviderUpdateName(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	idp, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Original Name"))
	require.NoError(t, err)
	require.Equal(t, "Original Name", idp.Name)

	// Update name
	newName := "Updated Name"
	updated, err := ts.UpdateIdentityProvider(ctx, &store.UpdateIdentityProviderV1{
		ID:   idp.Id,
		Type: storepb.IdentityProvider_OAUTH2,
		Name: &newName,
	})
	require.NoError(t, err)
	require.Equal(t, "Updated Name", updated.Name)

	// Verify update persisted
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.Equal(t, "Updated Name", found.Name)

	ts.Close()
}

func TestIdentityProviderUpdateIdentifierFilter(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	idp, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Test IDP"))
	require.NoError(t, err)
	require.Equal(t, "", idp.IdentifierFilter)

	// Update identifier filter
	newFilter := "@example.com$"
	updated, err := ts.UpdateIdentityProvider(ctx, &store.UpdateIdentityProviderV1{
		ID:               idp.Id,
		Type:             storepb.IdentityProvider_OAUTH2,
		IdentifierFilter: &newFilter,
	})
	require.NoError(t, err)
	require.Equal(t, "@example.com$", updated.IdentifierFilter)

	// Verify update persisted
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.Equal(t, "@example.com$", found.IdentifierFilter)

	ts.Close()
}

func TestIdentityProviderUpdateConfig(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	idp, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Test IDP"))
	require.NoError(t, err)

	// Update config
	newConfig := &storepb.IdentityProviderConfig{
		Config: &storepb.IdentityProviderConfig_Oauth2Config{
			Oauth2Config: &storepb.OAuth2Config{
				ClientId:     "new_client_id",
				ClientSecret: "new_client_secret",
				AuthUrl:      "https://newprovider.com/auth",
				TokenUrl:     "https://newprovider.com/token",
				UserInfoUrl:  "https://newprovider.com/user",
				Scopes:       []string{"openid", "profile", "email"},
				FieldMapping: &storepb.FieldMapping{
					Identifier:  "sub",
					DisplayName: "name",
					Email:       "email",
				},
			},
		},
	}
	updated, err := ts.UpdateIdentityProvider(ctx, &store.UpdateIdentityProviderV1{
		ID:     idp.Id,
		Type:   storepb.IdentityProvider_OAUTH2,
		Config: newConfig,
	})
	require.NoError(t, err)
	require.Equal(t, "new_client_id", updated.Config.GetOauth2Config().ClientId)
	require.Equal(t, "new_client_secret", updated.Config.GetOauth2Config().ClientSecret)
	require.Contains(t, updated.Config.GetOauth2Config().Scopes, "openid")

	// Verify update persisted
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.Equal(t, "new_client_id", found.Config.GetOauth2Config().ClientId)

	ts.Close()
}

func TestIdentityProviderUpdateMultipleFields(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	idp, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Original"))
	require.NoError(t, err)

	// Update multiple fields at once
	newName := "Updated IDP"
	newFilter := "^admin@"
	updated, err := ts.UpdateIdentityProvider(ctx, &store.UpdateIdentityProviderV1{
		ID:               idp.Id,
		Type:             storepb.IdentityProvider_OAUTH2,
		Name:             &newName,
		IdentifierFilter: &newFilter,
	})
	require.NoError(t, err)
	require.Equal(t, "Updated IDP", updated.Name)
	require.Equal(t, "^admin@", updated.IdentifierFilter)

	ts.Close()
}

func TestIdentityProviderDelete(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	idp, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Test IDP"))
	require.NoError(t, err)

	// Delete
	err = ts.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: idp.Id})
	require.NoError(t, err)

	// Verify deletion
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.Nil(t, found)

	ts.Close()
}

func TestIdentityProviderDeleteNotAffectOthers(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create multiple IDPs
	idp1, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("IDP 1"))
	require.NoError(t, err)
	idp2, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("IDP 2"))
	require.NoError(t, err)

	// Delete first one
	err = ts.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: idp1.Id})
	require.NoError(t, err)

	// Verify second still exists
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp2.Id})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, "IDP 2", found.Name)

	// Verify list only contains second
	idpList, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Len(t, idpList, 1)

	ts.Close()
}

func TestIdentityProviderOAuth2ConfigScopes(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create IDP with multiple scopes
	idp, err := ts.CreateIdentityProvider(ctx, &storepb.IdentityProvider{
		Name: "Multi-Scope OAuth",
		Type: storepb.IdentityProvider_OAUTH2,
		Config: &storepb.IdentityProviderConfig{
			Config: &storepb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &storepb.OAuth2Config{
					ClientId:     "client_id",
					ClientSecret: "client_secret",
					AuthUrl:      "https://provider.com/auth",
					TokenUrl:     "https://provider.com/token",
					UserInfoUrl:  "https://provider.com/userinfo",
					Scopes:       []string{"openid", "profile", "email", "groups"},
					FieldMapping: &storepb.FieldMapping{
						Identifier:  "sub",
						DisplayName: "name",
						Email:       "email",
					},
				},
			},
		},
	})
	require.NoError(t, err)

	// Verify scopes are preserved
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.Len(t, found.Config.GetOauth2Config().Scopes, 4)
	require.Contains(t, found.Config.GetOauth2Config().Scopes, "openid")
	require.Contains(t, found.Config.GetOauth2Config().Scopes, "groups")

	ts.Close()
}

func TestIdentityProviderFieldMapping(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create IDP with custom field mapping
	idp, err := ts.CreateIdentityProvider(ctx, &storepb.IdentityProvider{
		Name: "Custom Field Mapping",
		Type: storepb.IdentityProvider_OAUTH2,
		Config: &storepb.IdentityProviderConfig{
			Config: &storepb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &storepb.OAuth2Config{
					ClientId:     "client_id",
					ClientSecret: "client_secret",
					AuthUrl:      "https://provider.com/auth",
					TokenUrl:     "https://provider.com/token",
					UserInfoUrl:  "https://provider.com/userinfo",
					Scopes:       []string{"login"},
					FieldMapping: &storepb.FieldMapping{
						Identifier:  "preferred_username",
						DisplayName: "full_name",
						Email:       "email_address",
					},
				},
			},
		},
	})
	require.NoError(t, err)

	// Verify field mapping is preserved
	found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
	require.NoError(t, err)
	require.Equal(t, "preferred_username", found.Config.GetOauth2Config().FieldMapping.Identifier)
	require.Equal(t, "full_name", found.Config.GetOauth2Config().FieldMapping.DisplayName)
	require.Equal(t, "email_address", found.Config.GetOauth2Config().FieldMapping.Email)

	ts.Close()
}

func TestIdentityProviderIdentifierFilterPatterns(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	testCases := []struct {
		name   string
		filter string
	}{
		{"Domain filter", "@company\\.com$"},
		{"Prefix filter", "^admin_"},
		{"Complex regex", "^[a-z]+@(dept1|dept2)\\.example\\.com$"},
		{"Empty filter", ""},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			idp, err := ts.CreateIdentityProvider(ctx, &storepb.IdentityProvider{
				Name:             tc.name,
				Type:             storepb.IdentityProvider_OAUTH2,
				IdentifierFilter: tc.filter,
				Config: &storepb.IdentityProviderConfig{
					Config: &storepb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &storepb.OAuth2Config{
							ClientId:     "client_id",
							ClientSecret: "client_secret",
							AuthUrl:      "https://provider.com/auth",
							TokenUrl:     "https://provider.com/token",
							UserInfoUrl:  "https://provider.com/userinfo",
							Scopes:       []string{"login"},
							FieldMapping: &storepb.FieldMapping{
								Identifier: "sub",
							},
						},
					},
				},
			})
			require.NoError(t, err)

			found, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &idp.Id})
			require.NoError(t, err)
			require.Equal(t, tc.filter, found.IdentifierFilter)

			// Cleanup
			err = ts.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: idp.Id})
			require.NoError(t, err)
		})
	}

	ts.Close()
}

// Helper function to create a test OAuth2 IDP.
func createTestOAuth2IDP(name string) *storepb.IdentityProvider {
	return &storepb.IdentityProvider{
		Name:             name,
		Type:             storepb.IdentityProvider_OAUTH2,
		IdentifierFilter: "",
		Config: &storepb.IdentityProviderConfig{
			Config: &storepb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &storepb.OAuth2Config{
					ClientId:     "client_id",
					ClientSecret: "client_secret",
					AuthUrl:      "https://provider.com/auth",
					TokenUrl:     "https://provider.com/token",
					UserInfoUrl:  "https://provider.com/userinfo",
					Scopes:       []string{"login"},
					FieldMapping: &storepb.FieldMapping{
						Identifier:  "login",
						DisplayName: "name",
						Email:       "email",
					},
				},
			},
		},
	}
}

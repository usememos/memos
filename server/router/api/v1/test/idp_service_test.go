package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestCreateIdentityProvider(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateIdentityProvider success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		ctx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create OAuth2 identity provider
		req := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title:            "Test OAuth2 Provider",
				IdentifierFilter: "",
				Type:             v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:     "test-client-id",
							ClientSecret: "test-client-secret",
							AuthUrl:      "https://example.com/oauth/authorize",
							TokenUrl:     "https://example.com/oauth/token",
							UserInfoUrl:  "https://example.com/oauth/userinfo",
							Scopes:       []string{"openid", "profile", "email"},
							FieldMapping: &v1pb.FieldMapping{
								Identifier:  "id",
								DisplayName: "name",
								Email:       "email",
								AvatarUrl:   "avatar_url",
							},
						},
					},
				},
			},
		}

		resp, err := ts.Service.CreateIdentityProvider(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "Test OAuth2 Provider", resp.Title)
		require.Equal(t, v1pb.IdentityProvider_OAUTH2, resp.Type)
		require.Contains(t, resp.Name, "identity-providers/")
		require.NotNil(t, resp.Config.GetOauth2Config())
		require.Equal(t, "test-client-id", resp.Config.GetOauth2Config().ClientId)
	})

	t.Run("CreateIdentityProvider permission denied for non-host user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create regular user
		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)

		// Set user context
		ctx := ts.CreateUserContext(ctx, regularUser.ID)

		req := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Test Provider",
				Type:  v1pb.IdentityProvider_OAUTH2,
			},
		}

		_, err = ts.Service.CreateIdentityProvider(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("CreateIdentityProvider unauthenticated", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Test Provider",
				Type:  v1pb.IdentityProvider_OAUTH2,
			},
		}

		_, err := ts.Service.CreateIdentityProvider(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not authenticated")
	})
}

func TestListIdentityProviders(t *testing.T) {
	ctx := context.Background()

	t.Run("ListIdentityProviders empty", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.ListIdentityProvidersRequest{}
		resp, err := ts.Service.ListIdentityProviders(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Empty(t, resp.IdentityProviders)
	})

	t.Run("ListIdentityProviders with providers", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create a couple of identity providers
		createReq1 := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Provider 1",
				Type:  v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:    "client1",
							AuthUrl:     "https://example1.com/auth",
							TokenUrl:    "https://example1.com/token",
							UserInfoUrl: "https://example1.com/user",
							FieldMapping: &v1pb.FieldMapping{
								Identifier: "id",
							},
						},
					},
				},
			},
		}

		createReq2 := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Provider 2",
				Type:  v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:    "client2",
							AuthUrl:     "https://example2.com/auth",
							TokenUrl:    "https://example2.com/token",
							UserInfoUrl: "https://example2.com/user",
							FieldMapping: &v1pb.FieldMapping{
								Identifier: "id",
							},
						},
					},
				},
			},
		}

		_, err = ts.Service.CreateIdentityProvider(userCtx, createReq1)
		require.NoError(t, err)
		_, err = ts.Service.CreateIdentityProvider(userCtx, createReq2)
		require.NoError(t, err)

		// List providers
		listReq := &v1pb.ListIdentityProvidersRequest{}
		resp, err := ts.Service.ListIdentityProviders(ctx, listReq)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.IdentityProviders, 2)

		// Verify response contains expected providers
		titles := []string{resp.IdentityProviders[0].Title, resp.IdentityProviders[1].Title}
		require.Contains(t, titles, "Provider 1")
		require.Contains(t, titles, "Provider 2")
	})
}

func TestGetIdentityProvider(t *testing.T) {
	ctx := context.Background()

	t.Run("GetIdentityProvider success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create identity provider
		createReq := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Test Provider",
				Type:  v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:     "test-client",
							ClientSecret: "test-secret",
							AuthUrl:      "https://example.com/auth",
							TokenUrl:     "https://example.com/token",
							UserInfoUrl:  "https://example.com/user",
							Scopes:       []string{"openid", "profile"},
							FieldMapping: &v1pb.FieldMapping{
								Identifier:  "id",
								DisplayName: "name",
								Email:       "email",
							},
						},
					},
				},
			},
		}

		created, err := ts.Service.CreateIdentityProvider(userCtx, createReq)
		require.NoError(t, err)

		// Get identity provider
		getReq := &v1pb.GetIdentityProviderRequest{
			Name: created.Name,
		}

		// Test unauthenticated, should not contain client secret
		resp, err := ts.Service.GetIdentityProvider(ctx, getReq)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, created.Name, resp.Name)
		require.Equal(t, "Test Provider", resp.Title)
		require.Equal(t, v1pb.IdentityProvider_OAUTH2, resp.Type)
		require.NotNil(t, resp.Config.GetOauth2Config())
		require.Equal(t, "test-client", resp.Config.GetOauth2Config().ClientId)
		require.Equal(t, "", resp.Config.GetOauth2Config().ClientSecret)

		// Test as host user, should contain client secret
		respHostUser, err := ts.Service.GetIdentityProvider(userCtx, getReq)
		require.NoError(t, err)
		require.NotNil(t, respHostUser)
		require.Equal(t, created.Name, respHostUser.Name)
		require.Equal(t, "Test Provider", respHostUser.Title)
		require.Equal(t, v1pb.IdentityProvider_OAUTH2, respHostUser.Type)
		require.NotNil(t, respHostUser.Config.GetOauth2Config())
		require.Equal(t, "test-client", respHostUser.Config.GetOauth2Config().ClientId)
		require.Equal(t, "test-secret", respHostUser.Config.GetOauth2Config().ClientSecret)
	})

	t.Run("GetIdentityProvider not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.GetIdentityProviderRequest{
			Name: "identity-providers/999",
		}

		_, err := ts.Service.GetIdentityProvider(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})

	t.Run("GetIdentityProvider invalid name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.GetIdentityProviderRequest{
			Name: "invalid-name",
		}

		_, err := ts.Service.GetIdentityProvider(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid identity provider name")
	})
}

func TestUpdateIdentityProvider(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateIdentityProvider success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create identity provider
		createReq := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title:            "Original Provider",
				IdentifierFilter: "",
				Type:             v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:    "original-client",
							AuthUrl:     "https://original.com/auth",
							TokenUrl:    "https://original.com/token",
							UserInfoUrl: "https://original.com/user",
							FieldMapping: &v1pb.FieldMapping{
								Identifier: "id",
							},
						},
					},
				},
			},
		}

		created, err := ts.Service.CreateIdentityProvider(userCtx, createReq)
		require.NoError(t, err)

		// Update identity provider
		updateReq := &v1pb.UpdateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Name:             created.Name,
				Title:            "Updated Provider",
				IdentifierFilter: "test@example.com",
				Type:             v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:     "updated-client",
							ClientSecret: "updated-secret",
							AuthUrl:      "https://updated.com/auth",
							TokenUrl:     "https://updated.com/token",
							UserInfoUrl:  "https://updated.com/user",
							Scopes:       []string{"openid", "profile", "email"},
							FieldMapping: &v1pb.FieldMapping{
								Identifier:  "sub",
								DisplayName: "given_name",
								Email:       "email",
								AvatarUrl:   "picture",
							},
						},
					},
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "identifier_filter", "config"},
			},
		}

		updated, err := ts.Service.UpdateIdentityProvider(userCtx, updateReq)
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, "Updated Provider", updated.Title)
		require.Equal(t, "test@example.com", updated.IdentifierFilter)
		require.Equal(t, "updated-client", updated.Config.GetOauth2Config().ClientId)
	})

	t.Run("UpdateIdentityProvider missing update mask", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		req := &v1pb.UpdateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Name:  "identity-providers/1",
				Title: "Updated Provider",
			},
		}

		_, err = ts.Service.UpdateIdentityProvider(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "update_mask is required")
	})

	t.Run("UpdateIdentityProvider invalid name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		req := &v1pb.UpdateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Name:  "invalid-name",
				Title: "Updated Provider",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title"},
			},
		}

		_, err = ts.Service.UpdateIdentityProvider(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid identity provider name")
	})
}

func TestDeleteIdentityProvider(t *testing.T) {
	ctx := context.Background()

	t.Run("DeleteIdentityProvider success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create identity provider
		createReq := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Provider to Delete",
				Type:  v1pb.IdentityProvider_OAUTH2,
				Config: &v1pb.IdentityProviderConfig{
					Config: &v1pb.IdentityProviderConfig_Oauth2Config{
						Oauth2Config: &v1pb.OAuth2Config{
							ClientId:    "client-to-delete",
							AuthUrl:     "https://example.com/auth",
							TokenUrl:    "https://example.com/token",
							UserInfoUrl: "https://example.com/user",
							FieldMapping: &v1pb.FieldMapping{
								Identifier: "id",
							},
						},
					},
				},
			},
		}

		created, err := ts.Service.CreateIdentityProvider(userCtx, createReq)
		require.NoError(t, err)

		// Delete identity provider
		deleteReq := &v1pb.DeleteIdentityProviderRequest{
			Name: created.Name,
		}

		_, err = ts.Service.DeleteIdentityProvider(userCtx, deleteReq)
		require.NoError(t, err)

		// Verify deletion
		getReq := &v1pb.GetIdentityProviderRequest{
			Name: created.Name,
		}

		_, err = ts.Service.GetIdentityProvider(ctx, getReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})

	t.Run("DeleteIdentityProvider invalid name", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		req := &v1pb.DeleteIdentityProviderRequest{
			Name: "invalid-name",
		}

		_, err = ts.Service.DeleteIdentityProvider(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid identity provider name")
	})

	t.Run("DeleteIdentityProvider not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, hostUser.ID)

		req := &v1pb.DeleteIdentityProviderRequest{
			Name: "identity-providers/999",
		}

		_, err = ts.Service.DeleteIdentityProvider(userCtx, req)
		require.Error(t, err)
		// Note: Delete might succeed even if item doesn't exist, depending on store implementation
	})
}

func TestIdentityProviderPermissions(t *testing.T) {
	ctx := context.Background()

	t.Run("Only host users can create identity providers", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create regular user
		regularUser, err := ts.CreateRegularUser(ctx, "regularuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, regularUser.ID)

		req := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Test Provider",
				Type:  v1pb.IdentityProvider_OAUTH2,
			},
		}

		_, err = ts.Service.CreateIdentityProvider(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("Authentication required", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.CreateIdentityProviderRequest{
			IdentityProvider: &v1pb.IdentityProvider{
				Title: "Test Provider",
				Type:  v1pb.IdentityProvider_OAUTH2,
			},
		}

		_, err := ts.Service.CreateIdentityProvider(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not authenticated")
	})
}

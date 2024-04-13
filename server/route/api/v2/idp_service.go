package v2

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateIdentityProvider(ctx context.Context, request *apiv2pb.CreateIdentityProviderRequest) (*apiv2pb.CreateIdentityProviderResponse, error) {
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	identityProvider, err := s.Store.CreateIdentityProviderV1(ctx, convertIdentityProviderToStore(request.IdentityProvider))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create identity provider, error: %+v", err)
	}
	return &apiv2pb.CreateIdentityProviderResponse{
		IdentityProvider: convertIdentityProviderFromStore(identityProvider),
	}, nil
}

func (s *APIV2Service) ListIdentityProviders(ctx context.Context, _ *apiv2pb.ListIdentityProvidersRequest) (*apiv2pb.ListIdentityProvidersResponse, error) {
	identityProviders, err := s.Store.ListIdentityProvidersV1(ctx, &store.FindIdentityProvider{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list identity providers, error: %+v", err)
	}

	response := &apiv2pb.ListIdentityProvidersResponse{
		IdentityProviders: []*apiv2pb.IdentityProvider{},
	}
	for _, identityProvider := range identityProviders {
		response.IdentityProviders = append(response.IdentityProviders, convertIdentityProviderFromStore(identityProvider))
	}
	return response, nil
}

func (s *APIV2Service) GetIdentityProvider(ctx context.Context, request *apiv2pb.GetIdentityProviderRequest) (*apiv2pb.GetIdentityProviderResponse, error) {
	id, err := ExtractIdentityProviderIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	identityProvider, err := s.Store.GetIdentityProviderV1(ctx, &store.FindIdentityProvider{
		ID: &id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %+v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.NotFound, "identity provider not found")
	}
	return &apiv2pb.GetIdentityProviderResponse{
		IdentityProvider: convertIdentityProviderFromStore(identityProvider),
	}, nil
}

func (s *APIV2Service) UpdateIdentityProvider(ctx context.Context, request *apiv2pb.UpdateIdentityProviderRequest) (*apiv2pb.UpdateIdentityProviderResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	id, err := ExtractIdentityProviderIDFromName(request.IdentityProvider.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	update := &store.UpdateIdentityProviderV1{
		ID:   id,
		Type: storepb.IdentityProvider_Type(storepb.IdentityProvider_Type_value[request.IdentityProvider.Type.String()]),
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "title":
			update.Name = &request.IdentityProvider.Title
		case "config":
			update.Config = convertIdentityProviderConfigToStore(request.IdentityProvider.Type, request.IdentityProvider.Config)
		}
	}

	identityProvider, err := s.Store.UpdateIdentityProviderV1(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update identity provider, error: %+v", err)
	}
	return &apiv2pb.UpdateIdentityProviderResponse{
		IdentityProvider: convertIdentityProviderFromStore(identityProvider),
	}, nil
}

func (s *APIV2Service) DeleteIdentityProvider(ctx context.Context, request *apiv2pb.DeleteIdentityProviderRequest) (*apiv2pb.DeleteIdentityProviderResponse, error) {
	id, err := ExtractIdentityProviderIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	if err := s.Store.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: id}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete identity provider, error: %+v", err)
	}
	return &apiv2pb.DeleteIdentityProviderResponse{}, nil
}

func convertIdentityProviderFromStore(identityProvider *storepb.IdentityProvider) *apiv2pb.IdentityProvider {
	temp := &apiv2pb.IdentityProvider{
		Name:             fmt.Sprintf("%s%d", IdentityProviderNamePrefix, identityProvider.Id),
		Title:            identityProvider.Name,
		IdentifierFilter: identityProvider.IdentifierFilter,
		Type:             apiv2pb.IdentityProvider_Type(apiv2pb.IdentityProvider_Type_value[identityProvider.Type.String()]),
	}
	if identityProvider.Type == storepb.IdentityProvider_OAUTH2 {
		oauth2Config := identityProvider.Config.GetOauth2Config()
		temp.Config = &apiv2pb.IdentityProviderConfig{
			Config: &apiv2pb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &apiv2pb.OAuth2Config{
					ClientId:     oauth2Config.ClientId,
					ClientSecret: oauth2Config.ClientSecret,
					AuthUrl:      oauth2Config.AuthUrl,
					TokenUrl:     oauth2Config.TokenUrl,
					UserInfoUrl:  oauth2Config.UserInfoUrl,
					Scopes:       oauth2Config.Scopes,
					FieldMapping: &apiv2pb.FieldMapping{
						Identifier:  oauth2Config.FieldMapping.Identifier,
						DisplayName: oauth2Config.FieldMapping.DisplayName,
						Email:       oauth2Config.FieldMapping.Email,
					},
				},
			},
		}
	}
	return temp
}

func convertIdentityProviderToStore(identityProvider *apiv2pb.IdentityProvider) *storepb.IdentityProvider {
	id, _ := ExtractIdentityProviderIDFromName(identityProvider.Name)

	temp := &storepb.IdentityProvider{
		Id:               id,
		Name:             identityProvider.Title,
		IdentifierFilter: identityProvider.IdentifierFilter,
		Type:             storepb.IdentityProvider_Type(storepb.IdentityProvider_Type_value[identityProvider.Type.String()]),
		Config:           convertIdentityProviderConfigToStore(identityProvider.Type, identityProvider.Config),
	}
	return temp
}

func convertIdentityProviderConfigToStore(identityProviderType apiv2pb.IdentityProvider_Type, config *apiv2pb.IdentityProviderConfig) *storepb.IdentityProviderConfig {
	if identityProviderType == apiv2pb.IdentityProvider_OAUTH2 {
		oauth2Config := config.GetOauth2Config()
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
						Identifier:  oauth2Config.FieldMapping.Identifier,
						DisplayName: oauth2Config.FieldMapping.DisplayName,
						Email:       oauth2Config.FieldMapping.Email,
					},
				},
			},
		}
	}
	return nil
}

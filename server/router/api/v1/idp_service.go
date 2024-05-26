package v1

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateIdentityProvider(ctx context.Context, request *v1pb.CreateIdentityProviderRequest) (*v1pb.IdentityProvider, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	identityProvider, err := s.Store.CreateIdentityProvider(ctx, convertIdentityProviderToStore(request.IdentityProvider))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create identity provider, error: %+v", err)
	}
	return convertIdentityProviderFromStore(identityProvider), nil
}

func (s *APIV1Service) ListIdentityProviders(ctx context.Context, _ *v1pb.ListIdentityProvidersRequest) (*v1pb.ListIdentityProvidersResponse, error) {
	identityProviders, err := s.Store.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list identity providers, error: %+v", err)
	}

	response := &v1pb.ListIdentityProvidersResponse{
		IdentityProviders: []*v1pb.IdentityProvider{},
	}
	for _, identityProvider := range identityProviders {
		response.IdentityProviders = append(response.IdentityProviders, convertIdentityProviderFromStore(identityProvider))
	}
	return response, nil
}

func (s *APIV1Service) GetIdentityProvider(ctx context.Context, request *v1pb.GetIdentityProviderRequest) (*v1pb.IdentityProvider, error) {
	id, err := ExtractIdentityProviderIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		ID: &id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %+v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.NotFound, "identity provider not found")
	}
	return convertIdentityProviderFromStore(identityProvider), nil
}

func (s *APIV1Service) UpdateIdentityProvider(ctx context.Context, request *v1pb.UpdateIdentityProviderRequest) (*v1pb.IdentityProvider, error) {
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
		case "identifier_filter":
			update.IdentifierFilter = &request.IdentityProvider.IdentifierFilter
		case "config":
			update.Config = convertIdentityProviderConfigToStore(request.IdentityProvider.Type, request.IdentityProvider.Config)
		}
	}

	identityProvider, err := s.Store.UpdateIdentityProvider(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update identity provider, error: %+v", err)
	}
	return convertIdentityProviderFromStore(identityProvider), nil
}

func (s *APIV1Service) DeleteIdentityProvider(ctx context.Context, request *v1pb.DeleteIdentityProviderRequest) (*emptypb.Empty, error) {
	id, err := ExtractIdentityProviderIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	if err := s.Store.DeleteIdentityProvider(ctx, &store.DeleteIdentityProvider{ID: id}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete identity provider, error: %+v", err)
	}
	return &emptypb.Empty{}, nil
}

func convertIdentityProviderFromStore(identityProvider *storepb.IdentityProvider) *v1pb.IdentityProvider {
	temp := &v1pb.IdentityProvider{
		Name:             fmt.Sprintf("%s%d", IdentityProviderNamePrefix, identityProvider.Id),
		Title:            identityProvider.Name,
		IdentifierFilter: identityProvider.IdentifierFilter,
		Type:             v1pb.IdentityProvider_Type(v1pb.IdentityProvider_Type_value[identityProvider.Type.String()]),
	}
	if identityProvider.Type == storepb.IdentityProvider_OAUTH2 {
		oauth2Config := identityProvider.Config.GetOauth2Config()
		temp.Config = &v1pb.IdentityProviderConfig{
			Config: &v1pb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &v1pb.OAuth2Config{
					ClientId:     oauth2Config.ClientId,
					ClientSecret: oauth2Config.ClientSecret,
					AuthUrl:      oauth2Config.AuthUrl,
					TokenUrl:     oauth2Config.TokenUrl,
					UserInfoUrl:  oauth2Config.UserInfoUrl,
					Scopes:       oauth2Config.Scopes,
					FieldMapping: &v1pb.FieldMapping{
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

func convertIdentityProviderToStore(identityProvider *v1pb.IdentityProvider) *storepb.IdentityProvider {
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

func convertIdentityProviderConfigToStore(identityProviderType v1pb.IdentityProvider_Type, config *v1pb.IdentityProviderConfig) *storepb.IdentityProviderConfig {
	if identityProviderType == v1pb.IdentityProvider_OAUTH2 {
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

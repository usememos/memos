package api

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/core/configuration"
	"github.com/usememos/memos/core/identityprovider"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIService) CreateIdentityProvider(ctx context.Context, request *apipb.CreateIdentityProviderRequest) (*apipb.IdentityProvider, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.IdentityProvider == nil {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider is required")
	}
	idpUID, err := ValidateAndGenerateUID(request.IdentityProviderId)
	if err != nil {
		return nil, err
	}
	if err := s.checkManagedExistence(ctx, identityprovider.NamePrefix+idpUID); err != nil {
		return nil, err
	}
	storeIdp := identityprovider.ToStore(request.IdentityProvider)
	storeIdp.Uid = idpUID
	if err := identityprovider.Validate(storeIdp); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider: %v", err)
	}

	identityProvider, err := s.Store.CreateIdentityProvider(ctx, storeIdp)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create identity provider, error: %+v", err)
	}
	return convertIdentityProviderFromStore(identityProvider), nil
}

func (s *APIService) ListIdentityProviders(ctx context.Context, _ *apipb.ListIdentityProvidersRequest) (*apipb.ListIdentityProvidersResponse, error) {
	identityProviders, err := s.Store.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list identity providers, error: %+v", err)
	}

	response := &apipb.ListIdentityProvidersResponse{
		IdentityProviders: []*apipb.IdentityProvider{},
	}
	for _, identityProvider := range identityProviders {
		response.IdentityProviders = append(response.IdentityProviders, convertIdentityProviderFromStore(identityProvider))
	}
	return response, nil
}

func (s *APIService) GetIdentityProvider(ctx context.Context, request *apipb.GetIdentityProviderRequest) (*apipb.IdentityProvider, error) {
	uid, err := ExtractIdentityProviderUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		UID: &uid,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %+v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.NotFound, "identity provider not found")
	}

	return convertIdentityProviderFromStore(identityProvider), nil
}

func (s *APIService) UpdateIdentityProvider(ctx context.Context, request *apipb.UpdateIdentityProviderRequest) (*apipb.IdentityProvider, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.IdentityProvider == nil {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	uid, err := ExtractIdentityProviderUIDFromName(request.IdentityProvider.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	// Look up the IdP by UID to get the internal ID for update.
	existing, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: &uid})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %+v", err)
	}
	if existing == nil {
		return nil, status.Errorf(codes.NotFound, "identity provider not found")
	}

	update := &store.UpdateIdentityProviderV1{
		ID:   existing.Id,
		Type: storepb.IdentityProvider_Type(storepb.IdentityProvider_Type_value[request.IdentityProvider.Type.String()]),
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "title":
			update.Name = &request.IdentityProvider.Title
		case "identifier_filter":
			update.IdentifierFilter = &request.IdentityProvider.IdentifierFilter
		case "config":
			update.Config = identityprovider.ConfigToStore(request.IdentityProvider.Type, request.IdentityProvider.Config)
		default:
			// Ignore unsupported fields
		}
	}

	// Preserve write-only credential when the caller sends an empty value.
	if update.Config != nil {
		if oauth2Config := update.Config.GetOauth2Config(); oauth2Config != nil && oauth2Config.ClientSecret == "" {
			if existingOAuth := existing.Config.GetOauth2Config(); existingOAuth != nil {
				oauth2Config.ClientSecret = existingOAuth.ClientSecret
			}
		}
	}

	// Validate the provider as it will be stored, not the partial update.
	merged := proto.CloneOf(existing)
	if update.Name != nil {
		merged.Name = *update.Name
	}
	if update.IdentifierFilter != nil {
		merged.IdentifierFilter = *update.IdentifierFilter
	}
	if update.Config != nil {
		merged.Config = update.Config
	}
	if err := identityprovider.Validate(merged); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider: %v", err)
	}
	changed := configuration.ChangedPaths(identityprovider.FromStore(existing), identityprovider.FromStore(merged))
	if err := s.checkManagedChange(ctx, identityprovider.NamePrefix+uid, changed); err != nil {
		return nil, err
	}

	identityProvider, err := s.Store.UpdateIdentityProvider(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update identity provider, error: %+v", err)
	}
	return convertIdentityProviderFromStore(identityProvider), nil
}

func (s *APIService) DeleteIdentityProvider(ctx context.Context, request *apipb.DeleteIdentityProviderRequest) (*emptypb.Empty, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	uid, err := ExtractIdentityProviderUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	if err := s.checkManagedExistence(ctx, identityprovider.NamePrefix+uid); err != nil {
		return nil, err
	}
	if err := s.checkManagedReference(ctx, identityprovider.NamePrefix+uid); err != nil {
		return nil, err
	}
	// Look up the IdP by UID to get the internal ID for deletion.
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: &uid})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to check identity provider existence: %v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.NotFound, "identity provider not found")
	}

	if err := s.Store.DeleteIdentityProviderSafely(ctx, &store.DeleteIdentityProvider{ID: identityProvider.Id}); err != nil {
		if errors.Is(err, store.ErrUnsafeAuthenticationConfiguration) {
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to delete identity provider, error: %+v", err)
	}
	return &emptypb.Empty{}, nil
}

// convertIdentityProviderFromStore converts a stored provider for a response.
// The client secret is write-only and never returned.
func convertIdentityProviderFromStore(provider *storepb.IdentityProvider) *apipb.IdentityProvider {
	result := identityprovider.FromStore(provider)
	if oauth2Config := result.GetConfig().GetOauth2Config(); oauth2Config != nil {
		oauth2Config.ClientSecret = ""
	}
	return result
}

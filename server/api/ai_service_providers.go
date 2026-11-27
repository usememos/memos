package api

import (
	"context"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/store"
)

// aiModelListTimeout bounds a model listing for the settings page, which lists
// every provider when it opens.
const aiModelListTimeout = 15 * time.Second

// ListAIProviderTypes describes the provider types this server supports.
func (s *APIService) ListAIProviderTypes(ctx context.Context, _ *apipb.ListAIProviderTypesRequest) (*apipb.ListAIProviderTypesResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	response := &apipb.ListAIProviderTypesResponse{}
	for _, spec := range ai.Catalog() {
		response.ProviderTypes = append(response.ProviderTypes, convertAIProviderSpecToProto(spec))
	}
	return response, nil
}

// ListAIProviderModels lists the models a configured provider reports.
//
// A provider that does not serve the listing, or a key allowed to call models
// but not to list them, yields an empty list: the provider answered, and the
// administrator types a model instead.
func (s *APIService) ListAIProviderModels(ctx context.Context, request *apipb.ListAIProviderModelsRequest) (*apipb.ListAIProviderModelsResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	if request.ProviderId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "provider_id is required")
	}
	setting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}
	provider, err := s.resolveAIProvider(setting, request.ProviderId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "AI provider %q not found", request.ProviderId)
	}
	listCtx, cancel := context.WithTimeout(ctx, aiModelListTimeout)
	defer cancel()
	models, err := ai.ListModels(ai.WithSingleAttempt(listCtx), provider)
	if err == nil {
		return &apipb.ListAIProviderModelsResponse{Models: models}, nil
	}
	if ctx.Err() != nil {
		return nil, status.FromContextError(ctx.Err()).Err()
	}
	failure := ai.ClassifyFailure(err)
	if failure.Kind == ai.FailureNotFound || ai.ModelListUnavailable(provider, failure) {
		return &apipb.ListAIProviderModelsResponse{Models: []string{}}, nil
	}
	if errors.Is(listCtx.Err(), context.DeadlineExceeded) {
		failure.Kind = ai.FailureTimeout
	}
	logAIFailure("list_models", provider, "", failure)
	return nil, newAIFailureError("provider \""+provider.Title+"\": ", provider, failure)
}

func (s *APIService) requireAdmin(ctx context.Context) error {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if user.Role != store.RoleAdmin {
		return status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return nil
}

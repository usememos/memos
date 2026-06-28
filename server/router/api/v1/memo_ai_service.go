package v1

import (
	"context"
	stdErrors "errors"
	"fmt"
	"net"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/llm"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const defaultMemoAIProviderBatchSize = 10

func (s *APIV1Service) GenerateMemoSummary(ctx context.Context, request *v1pb.GenerateMemoSummaryRequest) (*v1pb.GenerateMemoSummaryResponse, error) {
	memo, err := s.getAccessibleMemoByName(ctx, request.GetName())
	if err != nil {
		return nil, err
	}

	provider, err := s.resolveOllamaAIProvider(ctx, request.GetProviderId())
	if err != nil {
		return nil, err
	}
	client, err := s.newOllamaProvider(provider)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create Ollama provider: %v", err)
	}

	summary, err := client.GenerateSummary(ctx, memo.Content)
	if err != nil {
		return nil, s.wrapOllamaGenerationError("summary", provider, err)
	}
	return &v1pb.GenerateMemoSummaryResponse{Summary: summary}, nil
}

func (s *APIV1Service) GenerateMemoTags(ctx context.Context, request *v1pb.GenerateMemoTagsRequest) (*v1pb.GenerateMemoTagsResponse, error) {
	memo, err := s.getAccessibleMemoByName(ctx, request.GetName())
	if err != nil {
		return nil, err
	}

	provider, err := s.resolveOllamaAIProvider(ctx, request.GetProviderId())
	if err != nil {
		return nil, err
	}
	client, err := s.newOllamaProvider(provider)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create Ollama provider: %v", err)
	}

	tags, err := client.ExtractTags(ctx, memo.Content)
	if err != nil {
		return nil, s.wrapOllamaGenerationError("tags", provider, err)
	}
	return &v1pb.GenerateMemoTagsResponse{Tags: tags}, nil
}

func (s *APIV1Service) GenerateMemoRelations(ctx context.Context, request *v1pb.GenerateMemoRelationsRequest) (*v1pb.GenerateMemoRelationsResponse, error) {
	memo, err := s.getAccessibleMemoByName(ctx, request.GetName())
	if err != nil {
		return nil, err
	}

	provider, err := s.resolveOllamaAIProvider(ctx, request.GetProviderId())
	if err != nil {
		return nil, err
	}
	client, err := s.newOllamaProvider(provider)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create Ollama provider: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	limit := int(request.GetLimit())
	if limit <= 0 {
		limit = defaultMemoAIProviderBatchSize
	}

	candidates, err := s.listMemoAICandidateMemos(ctx, memo.ID, currentUser, limit)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return &v1pb.GenerateMemoRelationsResponse{Relations: []*v1pb.GenerateMemoRelation{}}, nil
	}

	candidateContents := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		snippet, err := s.getMemoContentSnippet(candidate.Content)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to build candidate memo snippet: %v", err)
		}
		candidateContents = append(candidateContents, fmt.Sprintf("%s — %s", buildMemoName(candidate.UID), snippet))
	}

	relations, err := client.DeriveRelations(ctx, memo.Content, candidateContents)
	if err != nil {
		return nil, s.wrapOllamaGenerationError("relations", provider, err)
	}

	response := &v1pb.GenerateMemoRelationsResponse{Relations: []*v1pb.GenerateMemoRelation{}}
	for _, relation := range relations {
		if relation.CandidateIndex < 0 || relation.CandidateIndex >= len(candidates) {
			continue
		}
		candidate := candidates[relation.CandidateIndex]
		snippet, err := s.getMemoContentSnippet(candidate.Content)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to build related memo snippet: %v", err)
		}
		response.Relations = append(response.Relations, &v1pb.GenerateMemoRelation{
			Name:    buildMemoName(candidate.UID),
			Score:   float32(relation.Score),
			Reason:  relation.Reason,
			Snippet: snippet,
		})
	}
	return response, nil
}

func (s *APIV1Service) getAccessibleMemoByName(ctx context.Context, name string) (*store.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(strings.TrimSpace(name))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if err := s.checkMemoReadAccess(ctx, memo); err != nil {
		return nil, err
	}
	return memo, nil
}

func (s *APIV1Service) resolveOllamaAIProvider(ctx context.Context, providerID string) (ai.ProviderConfig, error) {
	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return ai.ProviderConfig{}, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}

	providers := make([]ai.ProviderConfig, 0, len(aiSetting.GetProviders()))
	for _, provider := range aiSetting.GetProviders() {
		if provider == nil {
			continue
		}
		converted := convertAIProviderConfigFromStore(provider)
		if converted.Type == ai.ProviderOllama {
			providers = append(providers, converted)
		}
	}
	if len(providers) == 0 {
		return ai.ProviderConfig{}, status.Errorf(codes.FailedPrecondition, "no Ollama provider is configured")
	}

	if strings.TrimSpace(providerID) == "" {
		return providers[0], nil
	}
	provider, err := ai.FindProvider(providers, providerID)
	if err != nil {
		return ai.ProviderConfig{}, status.Errorf(codes.FailedPrecondition, "Ollama provider is not configured")
	}
	return *provider, nil
}

func (s *APIV1Service) newOllamaProvider(provider ai.ProviderConfig) (*llm.OllamaProvider, error) {
	baseURL := strings.TrimSpace(provider.Endpoint)
	if baseURL == "" {
		baseURL = strings.TrimSpace(s.Profile.OllamaBaseURL)
	}
	return llm.NewOllamaProvider(llm.Config{
		BaseURL: baseURL,
		Model:   strings.TrimSpace(s.Profile.OllamaModel),
	})
}

func (s *APIV1Service) wrapOllamaGenerationError(action string, provider ai.ProviderConfig, err error) error {
	if stdErrors.Is(err, context.Canceled) || stdErrors.Is(err, context.DeadlineExceeded) {
		return status.Errorf(codes.DeadlineExceeded, "Ollama request for %s was canceled or timed out: %v", action, err)
	}

	var netErr net.Error
	if stdErrors.As(err, &netErr) {
		baseURL := strings.TrimSpace(provider.Endpoint)
		if baseURL == "" {
			baseURL = strings.TrimSpace(s.Profile.OllamaBaseURL)
		}
		if baseURL == "" {
			baseURL = "http://localhost:11434"
		}
		return status.Errorf(codes.Unavailable, "Ollama is unreachable at %s. Start Ollama or update the provider endpoint, then try generating %s again: %v", baseURL, action, err)
	}

	return status.Errorf(codes.Internal, "failed to generate %s: %v", action, err)
}

func (s *APIV1Service) listMemoAICandidateMemos(ctx context.Context, currentMemoID int32, currentUser *store.User, limit int) ([]*store.Memo, error) {
	rowStatus := store.Normal
	memoFind := &store.FindMemo{
		RowStatus:        &rowStatus,
		ExcludeComments:   true,
		OrderByUpdatedTs:  true,
		Limit:             &limit,
	}
	if currentUser == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else {
		memoFind.Filters = append(memoFind.Filters, fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, currentUser.ID))
	}

	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list candidate memos: %v", err)
	}

	filtered := make([]*store.Memo, 0, len(memos))
	for _, candidate := range memos {
		if candidate.ID == currentMemoID {
			continue
		}
		filtered = append(filtered, candidate)
	}
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}
	return filtered, nil
}
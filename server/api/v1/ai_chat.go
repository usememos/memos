package v1

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
	chatopenai "github.com/usememos/memos/provider/ai/chat/openai"
	"github.com/usememos/memos/store"
)

const (
	// maxChatMessagesPerTurn bounds the conversation resent in one turn.
	maxChatMessagesPerTurn = 100
	// maxChatMessageLength bounds one message's text.
	maxChatMessageLength = 100_000
	// maxChatModelLength bounds the requested model identifier.
	maxChatModelLength = 256
	// providerModelsCacheTTL is how long a provider's model catalog is reused.
	// Catalogs change on the order of weeks, and each miss costs a provider call.
	providerModelsCacheTTL = 10 * time.Minute
)

// providerModelsCache memoizes per-provider model catalogs so opening the model
// picker repeatedly does not call the provider every time.
type providerModelsCache struct {
	mu      sync.Mutex
	entries map[string]providerModelsEntry
}

type providerModelsEntry struct {
	models []*v1pb.AIProviderModel
	expiry time.Time
}

func (c *providerModelsCache) get(providerID string) ([]*v1pb.AIProviderModel, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[providerID]
	if !ok || time.Now().After(entry.expiry) {
		return nil, false
	}
	return entry.models, true
}

func (c *providerModelsCache) set(providerID string, models []*v1pb.AIProviderModel, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = make(map[string]providerModelsEntry)
	}
	c.entries[providerID] = providerModelsEntry{models: models, expiry: time.Now().Add(ttl)}
}

// ListProviderModels lists the models an instance AI provider offers.
func (s *APIV1Service) ListProviderModels(ctx context.Context, request *v1pb.ListProviderModelsRequest) (*v1pb.ListProviderModelsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	if user.Role != store.RoleAdmin {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}

	providerID := strings.TrimSpace(request.GetProviderId())
	if providerID == "" {
		return nil, status.Error(codes.InvalidArgument, "provider_id is required")
	}

	provider, err := s.resolveChatProvider(ctx, providerID)
	if err != nil {
		return nil, err
	}

	if cached, ok := s.providerModelsCache.get(providerID); ok {
		return &v1pb.ListProviderModelsResponse{Models: cached}, nil
	}

	client, err := newChatClient(provider)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "failed to configure provider: %v", err)
	}

	models, err := client.ListModels(ctx)
	if err != nil {
		return nil, mapChatProviderError(err)
	}

	converted := make([]*v1pb.AIProviderModel, 0, len(models))
	for _, model := range models {
		converted = append(converted, &v1pb.AIProviderModel{
			Id:            model.ID,
			ContextLength: model.ContextLength,
		})
	}
	s.providerModelsCache.set(providerID, converted, providerModelsCacheTTL)
	return &v1pb.ListProviderModelsResponse{Models: converted}, nil
}

// EstimateChatContext reports how much of the chat context budget a selection
// would consume, so the Hub can refuse an over-budget selection before sending.
func (s *APIV1Service) EstimateChatContext(ctx context.Context, request *v1pb.EstimateChatContextRequest) (*v1pb.EstimateChatContextResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	if err := s.throttleAndCharge(ratelimit.ScopeChatEstimateUser, userKey(user.ID), 1); err != nil {
		return nil, err
	}

	budget, err := s.resolveChatContextBudget(ctx)
	if err != nil {
		return nil, err
	}

	selection, err := s.estimateChatContext(ctx, request.GetFilter(), budget)
	if err != nil {
		return nil, err
	}
	return &v1pb.EstimateChatContextResponse{
		MemoCount:           selection.memoCount,
		TotalChars:          selection.totalChars,
		EstimatedTokens:     selection.estimatedTokens,
		ContextBudgetTokens: selection.budgetTokens,
		Fits:                selection.estimatedTokens <= selection.budgetTokens,
	}, nil
}

// Chat runs one conversational turn. The model may propose note changes, but
// this method never writes a memo: the Hub applies a proposal through the normal
// memo API after the user confirms it.
func (s *APIV1Service) Chat(ctx context.Context, request *v1pb.ChatRequest) (*v1pb.ChatResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	if err := s.throttleAndCharge(ratelimit.ScopeChatUser, userKey(user.ID), 1); err != nil {
		return nil, err
	}

	messages, err := validateChatMessages(request.GetMessages())
	if err != nil {
		return nil, err
	}

	// The stored chat config is authoritative. A regular caller must not be able
	// to select another provider or raise the administrator's spending limits.
	provider, chatConfig, err := s.resolveChatTarget(ctx)
	if err != nil {
		return nil, err
	}

	budget := chatConfig.GetContextBudgetTokens()
	if budget == 0 {
		budget = DefaultChatContextBudgetTokens
	}
	maxCompletionTokens := chatConfig.GetMaxCompletionTokens()

	// Resolve the selection and enforce the hard cap. A refused selection is an
	// error, never a silent subset: the user sees which selection was too large.
	accessScope, currentUser, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}
	selected, err := s.resolveChatContextMemos(ctx, request.GetFilter(), accessScope, currentUser)
	if err != nil {
		return nil, err
	}

	var totalChars int64
	for _, memo := range selected {
		totalChars += int64(len(memo.Content))
	}
	selection := &chatContext{
		memoCount:       int64(len(selected)),
		totalChars:      totalChars,
		estimatedTokens: estimateTokens(totalChars),
		budgetTokens:    budget,
	}
	if selection.estimatedTokens > selection.budgetTokens {
		return nil, overBudgetError(selection)
	}
	selection.prompt = buildChatContextPrompt(selected)

	client, err := newChatClient(provider)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "failed to configure provider: %v", err)
	}

	completion, err := client.Chat(ctx, chat.Request{
		Model:               chatConfig.GetModel(),
		Messages:            buildChatRequestMessages(selection.prompt, messages),
		MaxCompletionTokens: maxCompletionTokens,
	})
	if err != nil {
		return nil, mapChatProviderError(err)
	}

	visibleText, proposals := parseChatProposals(completion.Text)
	selectedByName := make(map[string]*store.Memo, len(selected))
	for _, memo := range selected {
		selectedByName["memos/"+memo.UID] = memo
	}
	response := &v1pb.ChatResponse{
		Content:                visibleText,
		Proposals:              make([]*v1pb.ChatProposal, 0, len(proposals)),
		ContextMemoCount:       selection.memoCount,
		ContextEstimatedTokens: selection.estimatedTokens,
		ContextBudgetTokens:    selection.budgetTokens,
		PromptTokens:           completion.Usage.PromptTokens,
		CompletionTokens:       completion.Usage.CompletionTokens,
		TotalTokens:            completion.Usage.TotalTokens,
		Model:                  completion.Model,
		Truncated:              completion.FinishReason == chat.FinishLength,
	}
	for _, proposal := range proposals {
		converted := &v1pb.ChatProposal{
			Action:  proposal.Action,
			Content: proposal.Content,
			Target:  proposal.Target,
		}
		if target, ok := selectedByName[proposal.Target]; ok {
			converted.TargetContent = &target.Content
		}
		response.Proposals = append(response.Proposals, converted)
	}
	return response, nil
}

// resolveChatProvider loads the instance AI setting and resolves a provider id.
func (s *APIV1Service) resolveChatProvider(ctx context.Context, providerID string) (ai.ProviderConfig, error) {
	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return ai.ProviderConfig{}, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}
	return s.resolveAIProvider(aiSetting, providerID)
}

// resolveChatTarget resolves the administrator-controlled provider and model
// for a turn. Chat requires the OpenAI wire protocol, which OpenRouter and
// DeepInfra share.
func (s *APIV1Service) resolveChatTarget(ctx context.Context) (ai.ProviderConfig, *storepb.ChatConfig, error) {
	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return ai.ProviderConfig{}, nil, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}

	chatConfig := aiSetting.GetChat()
	providerID := strings.TrimSpace(chatConfig.GetProviderId())
	if providerID == "" {
		return ai.ProviderConfig{}, nil, status.Error(codes.FailedPrecondition, "chat is not configured")
	}

	provider, err := s.resolveAIProvider(aiSetting, providerID)
	if err != nil {
		return ai.ProviderConfig{}, nil, err
	}
	if !ai.IsOpenAICompatible(provider.Type) {
		return ai.ProviderConfig{}, nil, status.Errorf(codes.FailedPrecondition, "provider type %q is not supported for chat", provider.Type)
	}

	model := strings.TrimSpace(chatConfig.GetModel())
	if model == "" {
		return ai.ProviderConfig{}, nil, status.Error(codes.FailedPrecondition, "chat model is not configured")
	}
	if len(model) > maxChatModelLength {
		return ai.ProviderConfig{}, nil, status.Errorf(codes.InvalidArgument, "model is too long; maximum length is %d characters", maxChatModelLength)
	}
	chatConfig.Model = model
	return provider, chatConfig, nil
}

// resolveChatContextBudget resolves the administrator-controlled context
// budget, falling back to the server default when the setting is zero.
func (s *APIV1Service) resolveChatContextBudget(ctx context.Context) (int64, error) {
	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return 0, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}
	budget := aiSetting.GetChat().GetContextBudgetTokens()
	if budget == 0 {
		budget = DefaultChatContextBudgetTokens
	}
	if budget < 0 {
		return 0, status.Error(codes.InvalidArgument, "context_budget_tokens cannot be negative")
	}
	return budget, nil
}

// newChatClient builds an OpenAI-compatible chat client for a provider.
func newChatClient(provider ai.ProviderConfig) (*chatopenai.Client, error) {
	options := chat.ApplyOptions(nil)
	// OpenRouter uses these for optional app attribution; other providers
	// ignore them.
	if provider.Type == ai.ProviderOpenRouter {
		options = chat.ApplyOptions([]chat.ChatterOption{
			chat.WithExtraHeaders(map[string]string{
				"HTTP-Referer":       "https://github.com/usememos/memos",
				"X-OpenRouter-Title": "Memos",
			}),
		})
	}
	return chatopenai.New(provider, options)
}

// validateChatMessages checks the conversation the caller resent and converts it
// to provider messages. The system message is supplied by the server, so a
// client cannot replace the proposal protocol.
func validateChatMessages(messages []*v1pb.ChatMessage) ([]chat.Message, error) {
	if len(messages) == 0 {
		return nil, status.Error(codes.InvalidArgument, "at least one message is required")
	}
	if len(messages) > maxChatMessagesPerTurn {
		return nil, status.Errorf(codes.InvalidArgument, "too many messages; maximum is %d", maxChatMessagesPerTurn)
	}

	converted := make([]chat.Message, 0, len(messages))
	for index, message := range messages {
		if message == nil {
			return nil, status.Errorf(codes.InvalidArgument, "message %d is empty", index)
		}
		content := strings.TrimSpace(message.GetContent())
		if content == "" {
			return nil, status.Errorf(codes.InvalidArgument, "message %d content is required", index)
		}
		if len(content) > maxChatMessageLength {
			return nil, status.Errorf(codes.InvalidArgument, "message %d is too long; maximum length is %d characters", index, maxChatMessageLength)
		}

		role := chat.RoleUser
		switch message.GetRole() {
		case v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER:
			role = chat.RoleUser
		case v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_ASSISTANT:
			role = chat.RoleAssistant
		default:
			return nil, status.Errorf(codes.InvalidArgument, "message %d has an unsupported role", index)
		}
		converted = append(converted, chat.Message{Role: role, Content: content})
	}

	if converted[len(converted)-1].Role != chat.RoleUser {
		return nil, status.Error(codes.InvalidArgument, "the last message must be from the user")
	}
	return converted, nil
}

// buildChatRequestMessages prepends the server-built system message.
func buildChatRequestMessages(contextPrompt string, messages []chat.Message) []chat.Message {
	prepared := make([]chat.Message, 0, len(messages)+1)
	prepared = append(prepared, chat.Message{Role: chat.RoleSystem, Content: buildChatSystemPrompt(contextPrompt)})
	return append(prepared, messages...)
}

// mapChatProviderError turns provider failures into actionable gRPC codes so the
// Hub can distinguish a bad key from exhausted credit from a rate limit.
func mapChatProviderError(err error) error {
	var apiErr *chat.APIError
	if errors.As(err, &apiErr) {
		message := apiErr.Message
		if message == "" {
			message = "provider request failed"
		}
		switch apiErr.StatusCode {
		case 401:
			return status.Errorf(codes.Unauthenticated, "AI provider rejected the API key: %s", message)
		case 402:
			return status.Errorf(codes.PermissionDenied, "AI provider reports insufficient credit: %s", message)
		case 403:
			return status.Errorf(codes.PermissionDenied, "AI provider denied the request: %s", message)
		case 404:
			return status.Errorf(codes.NotFound, "AI provider could not find the requested model: %s", message)
		case 429:
			return status.Errorf(codes.ResourceExhausted, "AI provider rate limit reached: %s", message)
		default:
			if apiErr.StatusCode >= 500 {
				return status.Errorf(codes.Unavailable, "AI provider is unavailable: %s", message)
			}
			return status.Errorf(codes.InvalidArgument, "AI provider rejected the request: %s", message)
		}
	}
	if errors.Is(err, chat.ErrModelListUnsupported) {
		return status.Error(codes.Unimplemented, "this provider does not expose a model list")
	}
	return status.Errorf(codes.Internal, "AI provider request failed: %v", err)
}

package v1

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/llm"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// CreateConversation creates a new AI conversation.
func (s *APIV1Service) CreateConversation(ctx context.Context, req *v1pb.CreateConversationRequest) (*v1pb.Conversation, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	title := req.Title
	if title == "" {
		title = "New Chat"
	}

	model := req.Model
	provider := req.Provider

	// Use defaults if not specified
	if s.LLMManager != nil {
		defaultProvider, defaultModel := s.LLMManager.GetDefaults()
		if provider == "" {
			provider = defaultProvider
		}
		if model == "" {
			model = defaultModel
		}
	}

	conversation := &store.AIConversation{
		UID:      util.GenUUID(),
		UserID:   userID,
		Title:    title,
		Model:    model,
		Provider: provider,
	}

	created, err := s.Store.CreateAIConversation(ctx, conversation)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create conversation: %v", err)
	}

	return convertConversationToProto(created, user.Username), nil
}

// ListConversations lists all conversations for the current user.
func (s *APIV1Service) ListConversations(ctx context.Context, _ *v1pb.ListConversationsRequest) (*v1pb.ListConversationsResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	normalStatus := store.Normal
	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UserID:    &userID,
		RowStatus: &normalStatus,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list conversations: %v", err)
	}

	protoConversations := make([]*v1pb.Conversation, len(conversations))
	for i, c := range conversations {
		protoConversations[i] = convertConversationToProto(c, user.Username)
	}

	return &v1pb.ListConversationsResponse{
		Conversations: protoConversations,
	}, nil
}

// GetConversation gets a specific conversation with messages.
func (s *APIV1Service) GetConversation(ctx context.Context, req *v1pb.GetConversationRequest) (*v1pb.Conversation, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UID: &req.ConversationId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get conversation: %v", err)
	}
	if len(conversations) == 0 {
		return nil, status.Errorf(codes.NotFound, "conversation not found")
	}

	conversation := conversations[0]
	if conversation.UserID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Fetch messages
	messages, err := s.Store.ListAIMessages(ctx, &store.FindAIMessage{
		ConversationID: &conversation.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list messages: %v", err)
	}

	protoConversation := convertConversationToProto(conversation, user.Username)
	protoConversation.Messages = make([]*v1pb.Message, len(messages))
	for i, m := range messages {
		protoConversation.Messages[i] = convertMessageToProto(m)
	}

	return protoConversation, nil
}

// DeleteConversation deletes a conversation and all its messages.
func (s *APIV1Service) DeleteConversation(ctx context.Context, req *v1pb.DeleteConversationRequest) (*emptypb.Empty, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UID: &req.ConversationId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get conversation: %v", err)
	}
	if len(conversations) == 0 {
		return nil, status.Errorf(codes.NotFound, "conversation not found")
	}

	conversation := conversations[0]
	if conversation.UserID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.DeleteAIConversation(ctx, &store.DeleteAIConversation{ID: conversation.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete conversation: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// UpdateConversation updates conversation metadata.
func (s *APIV1Service) UpdateConversation(ctx context.Context, req *v1pb.UpdateConversationRequest) (*v1pb.Conversation, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UID: &req.ConversationId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get conversation: %v", err)
	}
	if len(conversations) == 0 {
		return nil, status.Errorf(codes.NotFound, "conversation not found")
	}

	conversation := conversations[0]
	if conversation.UserID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateAIConversation{ID: conversation.ID}
	if req.Title != "" {
		update.Title = &req.Title
	}
	if req.Model != "" {
		update.Model = &req.Model
	}
	if req.Provider != "" {
		update.Provider = &req.Provider
	}
	now := time.Now().Unix()
	update.UpdatedTs = &now

	if err := s.Store.UpdateAIConversation(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update conversation: %v", err)
	}

	// Fetch updated conversation
	return s.GetConversation(ctx, &v1pb.GetConversationRequest{ConversationId: req.ConversationId})
}

// SendMessage sends a message and gets AI response.
func (s *APIV1Service) SendMessage(ctx context.Context, req *v1pb.SendMessageRequest) (*v1pb.SendMessageResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	if s.LLMManager == nil || !s.LLMManager.IsEnabled() {
		return nil, status.Errorf(codes.FailedPrecondition, "AI is not enabled")
	}

	// Get conversation
	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UID: &req.ConversationId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get conversation: %v", err)
	}
	if len(conversations) == 0 {
		return nil, status.Errorf(codes.NotFound, "conversation not found")
	}

	conversation := conversations[0]
	if conversation.UserID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Save user message
	userMessage := &store.AIMessage{
		UID:            util.GenUUID(),
		ConversationID: conversation.ID,
		Role:           store.AIMessageRoleUser,
		Content:        req.Content,
	}
	userMessage, err = s.Store.CreateAIMessage(ctx, userMessage)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save user message: %v", err)
	}

	// Fetch conversation history
	messages, err := s.Store.ListAIMessages(ctx, &store.FindAIMessage{
		ConversationID: &conversation.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list messages: %v", err)
	}

	// Build LLM request
	llmMessages := make([]llm.Message, len(messages))
	for i, m := range messages {
		llmMessages[i] = llm.Message{
			Role:    string(m.Role),
			Content: m.Content,
		}
	}

	// Get provider
	provider, err := s.LLMManager.GetProvider(conversation.Provider)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get LLM provider: %v", err)
	}

	model := conversation.Model
	if model == "" {
		_, model = s.LLMManager.GetDefaults()
	}

	// Call LLM
	llmResp, err := provider.Complete(ctx, &llm.CompletionRequest{
		Model:    model,
		Messages: llmMessages,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI response: %v", err)
	}

	// Save assistant message
	assistantMessage := &store.AIMessage{
		UID:            util.GenUUID(),
		ConversationID: conversation.ID,
		Role:           store.AIMessageRoleAssistant,
		Content:        llmResp.Content,
		TokenCount:     int32(llmResp.TokenCount),
	}
	assistantMessage, err = s.Store.CreateAIMessage(ctx, assistantMessage)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save assistant message: %v", err)
	}

	// Update conversation title if it's the first message
	if len(messages) == 1 {
		// Generate title from first user message (truncate if too long)
		title := req.Content
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		now := time.Now().Unix()
		_ = s.Store.UpdateAIConversation(ctx, &store.UpdateAIConversation{
			ID:        conversation.ID,
			Title:     &title,
			UpdatedTs: &now,
		})
	}

	return &v1pb.SendMessageResponse{
		UserMessage:      convertMessageToProto(userMessage),
		AssistantMessage: convertMessageToProto(assistantMessage),
	}, nil
}

// ListMessages lists all messages in a conversation.
func (s *APIV1Service) ListMessages(ctx context.Context, req *v1pb.ListMessagesRequest) (*v1pb.ListMessagesResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UID: &req.ConversationId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get conversation: %v", err)
	}
	if len(conversations) == 0 {
		return nil, status.Errorf(codes.NotFound, "conversation not found")
	}

	conversation := conversations[0]
	if conversation.UserID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	messages, err := s.Store.ListAIMessages(ctx, &store.FindAIMessage{
		ConversationID: &conversation.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list messages: %v", err)
	}

	protoMessages := make([]*v1pb.Message, len(messages))
	for i, m := range messages {
		protoMessages[i] = convertMessageToProto(m)
	}

	return &v1pb.ListMessagesResponse{
		Messages: protoMessages,
	}, nil
}

// GetAIConfig returns available AI providers and models.
func (s *APIV1Service) GetAIConfig(ctx context.Context, _ *v1pb.GetAIConfigRequest) (*v1pb.GetAIConfigResponse, error) {
	if s.LLMManager == nil {
		return &v1pb.GetAIConfigResponse{
			Enabled: false,
		}, nil
	}

	defaultProvider, defaultModel := s.LLMManager.GetDefaults()
	providers := s.LLMManager.ListProviders()

	protoProviders := make([]*v1pb.AIProvider, len(providers))
	for i, p := range providers {
		protoProviders[i] = &v1pb.AIProvider{
			Name:        p.Name(),
			DisplayName: p.DisplayName(),
			Models:      p.Models(),
		}
	}

	return &v1pb.GetAIConfigResponse{
		Enabled:         s.LLMManager.IsEnabled(),
		Providers:       protoProviders,
		DefaultProvider: defaultProvider,
		DefaultModel:    defaultModel,
	}, nil
}

// Helper functions

func convertConversationToProto(c *store.AIConversation, username string) *v1pb.Conversation {
	return &v1pb.Conversation{
		Id:         c.UID,
		User:       fmt.Sprintf("users/%s", username),
		Title:      c.Title,
		Model:      c.Model,
		Provider:   c.Provider,
		CreateTime: timestamppb.New(time.Unix(c.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(c.UpdatedTs, 0)),
	}
}

func convertMessageToProto(m *store.AIMessage) *v1pb.Message {
	role := v1pb.MessageRole_MESSAGE_ROLE_UNSPECIFIED
	switch m.Role {
	case store.AIMessageRoleUser:
		role = v1pb.MessageRole_USER
	case store.AIMessageRoleAssistant:
		role = v1pb.MessageRole_ASSISTANT
	case store.AIMessageRoleSystem:
		role = v1pb.MessageRole_SYSTEM
	}

	return &v1pb.Message{
		Id:         m.UID,
		Role:       role,
		Content:    m.Content,
		CreateTime: timestamppb.New(time.Unix(m.CreatedTs, 0)),
		TokenCount: m.TokenCount,
	}
}

package store

import "context"

// AIConversation represents an AI chat conversation.
type AIConversation struct {
	ID        int32
	UID       string
	UserID    int32
	Title     string
	CreatedTs int64
	UpdatedTs int64
	RowStatus RowStatus
	Model     string
	Provider  string
}

// FindAIConversation specifies filter criteria for finding conversations.
type FindAIConversation struct {
	ID        *int32
	UID       *string
	UserID    *int32
	RowStatus *RowStatus
	Limit     *int
	Offset    *int
}

// UpdateAIConversation specifies fields to update.
type UpdateAIConversation struct {
	ID        int32
	Title     *string
	Model     *string
	Provider  *string
	RowStatus *RowStatus
	UpdatedTs *int64
}

// DeleteAIConversation specifies which conversation to delete.
type DeleteAIConversation struct {
	ID int32
}

// CreateAIConversation creates a new AI conversation.
func (s *Store) CreateAIConversation(ctx context.Context, create *AIConversation) (*AIConversation, error) {
	return s.driver.CreateAIConversation(ctx, create)
}

// ListAIConversations returns conversations matching the filter.
func (s *Store) ListAIConversations(ctx context.Context, find *FindAIConversation) ([]*AIConversation, error) {
	return s.driver.ListAIConversations(ctx, find)
}

// UpdateAIConversation updates a conversation.
func (s *Store) UpdateAIConversation(ctx context.Context, update *UpdateAIConversation) error {
	return s.driver.UpdateAIConversation(ctx, update)
}

// DeleteAIConversation deletes a conversation.
func (s *Store) DeleteAIConversation(ctx context.Context, delete *DeleteAIConversation) error {
	return s.driver.DeleteAIConversation(ctx, delete)
}

package store

import "context"

// AIMessageRole represents the role of a message sender.
type AIMessageRole string

const (
	AIMessageRoleUser      AIMessageRole = "user"
	AIMessageRoleAssistant AIMessageRole = "assistant"
	AIMessageRoleSystem    AIMessageRole = "system"
)

// AIMessage represents a message in an AI conversation.
type AIMessage struct {
	ID             int32
	UID            string
	ConversationID int32
	Role           AIMessageRole
	Content        string
	CreatedTs      int64
	TokenCount     int32
}

// FindAIMessage specifies filter criteria for finding messages.
type FindAIMessage struct {
	ID             *int32
	UID            *string
	ConversationID *int32
	Limit          *int
	Offset         *int
	OrderByCreated *string // "ASC" or "DESC"
}

// DeleteAIMessage specifies which message to delete.
type DeleteAIMessage struct {
	ID             *int32
	ConversationID *int32
}

// CreateAIMessage creates a new AI message.
func (s *Store) CreateAIMessage(ctx context.Context, create *AIMessage) (*AIMessage, error) {
	return s.driver.CreateAIMessage(ctx, create)
}

// ListAIMessages returns messages matching the filter.
func (s *Store) ListAIMessages(ctx context.Context, find *FindAIMessage) ([]*AIMessage, error) {
	return s.driver.ListAIMessages(ctx, find)
}

// DeleteAIMessage deletes messages matching the filter.
func (s *Store) DeleteAIMessage(ctx context.Context, delete *DeleteAIMessage) error {
	return s.driver.DeleteAIMessage(ctx, delete)
}

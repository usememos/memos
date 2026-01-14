# Feature Development Plan: Knowtree AI Chat Interface

This document outlines the step-by-step plan to develop a ChatGPT-like AI chat interface for the Knowledge-Tree (Memos) project. The feature will be implemented as a loosely-coupled microservice with support for multiple LLM providers.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Phase 1: Database Schema & Migrations](#phase-1-database-schema--migrations)
4. [Phase 2: Protocol Buffer Definitions](#phase-2-protocol-buffer-definitions)
5. [Phase 3: Backend Store Layer](#phase-3-backend-store-layer)
6. [Phase 4: LLM Provider Plugin](#phase-4-llm-provider-plugin)
7. [Phase 5: AI Service Implementation](#phase-5-ai-service-implementation)
8. [Phase 6: Frontend Implementation](#phase-6-frontend-implementation)
9. [Phase 7: Integration & Testing](#phase-7-integration--testing)
10. [Phase 8: Documentation & Cleanup](#phase-8-documentation--cleanup)

---

## Overview

### Feature Summary

- **Name:** Knowtree AI
- **Description:** A ChatGPT-like AI chat interface that allows users to interact with AI, ask questions, and receive responses in real-time
- **Key Capabilities:**
  - Create, view, and delete AI chat conversations
  - Real-time streaming responses from LLM
  - Support for multiple LLM providers (OpenAI, DeepSeek, etc.)
  - Persistent chat history per user
  - Separate database tables for AI data

### Design Principles

1. **Loose Coupling:** AI service should be independent and minimally coupled with existing services
2. **Multi-Provider Support:** Abstract LLM provider interface for easy extensibility
3. **Consistency:** Follow existing codebase patterns (AGENTS.md guidelines)
4. **Multi-Database Support:** SQLite, MySQL, and PostgreSQL compatibility

---

## Architecture Design

### Backend Architecture

```
plugin/
└── llm/                          # NEW: LLM provider plugin
    ├── provider.go               # Provider interface
    ├── openai/
    │   └── client.go             # OpenAI implementation
    ├── deepseek/
    │   └── client.go             # DeepSeek implementation
    └── config.go                 # LLM configuration

server/router/api/v1/
└── ai_service.go                 # NEW: AI chat service implementation

store/
├── ai_conversation.go            # NEW: Conversation model & store methods
├── ai_message.go                 # NEW: Message model & store methods
└── db/
    ├── sqlite/
    │   ├── ai_conversation.go    # NEW: SQLite implementation
    │   └── ai_message.go         # NEW: SQLite implementation
    ├── mysql/
    │   ├── ai_conversation.go    # NEW: MySQL implementation
    │   └── ai_message.go         # NEW: MySQL implementation
    └── postgres/
        ├── ai_conversation.go    # NEW: PostgreSQL implementation
        └── ai_message.go         # NEW: PostgreSQL implementation

proto/api/v1/
└── ai_service.proto              # NEW: AI service protobuf definitions
```

### Frontend Architecture

```
web/src/
├── pages/
│   └── KnowtreeAI.tsx            # NEW: Main AI chat page
├── components/
│   └── AI/                       # NEW: AI-specific components
│       ├── ChatSidebar.tsx       # Conversation list sidebar
│       ├── ChatWindow.tsx        # Main chat window
│       ├── MessageBubble.tsx     # Individual message component
│       ├── ChatInput.tsx         # Message input with send button
│       └── NewChatButton.tsx     # Create new conversation
├── hooks/
│   └── useAIQueries.ts           # NEW: React Query hooks for AI
├── contexts/
│   └── AIContext.tsx             # NEW: AI chat state context (optional)
└── router/
    └── routes.ts                 # UPDATE: Add AI route
```

### Data Model

```
┌─────────────────────┐       ┌─────────────────────┐
│   ai_conversation   │       │     ai_message      │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │◄──────│ conversation_id(FK) │
│ uid (unique)        │       │ id (PK)             │
│ user_id (FK→user)   │       │ uid (unique)        │
│ title               │       │ role (user/assistant│
│ created_ts          │       │ content             │
│ updated_ts          │       │ created_ts          │
│ row_status          │       │ token_count         │
│ model               │       └─────────────────────┘
│ provider            │
└─────────────────────┘
```

---

## Phase 1: Database Schema & Migrations

### Step 1.1: Create Migration Files

Create migration files for all three database drivers.

**File: `store/migration/sqlite/0.27/01__add_ai_tables.sql`**

```sql
-- ai_conversation: stores chat conversations
CREATE TABLE ai_conversation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  model TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_ai_conversation_user_id ON ai_conversation(user_id);
CREATE INDEX idx_ai_conversation_created_ts ON ai_conversation(created_ts);

-- ai_message: stores individual messages in conversations
CREATE TABLE ai_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  token_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_message_conversation_id ON ai_message(conversation_id);
CREATE INDEX idx_ai_message_created_ts ON ai_message(created_ts);
```

**File: `store/migration/mysql/0.27/01__add_ai_tables.sql`**

```sql
-- ai_conversation: stores chat conversations
CREATE TABLE ai_conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  title VARCHAR(512) NOT NULL DEFAULT 'New Chat',
  created_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  updated_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  row_status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  model VARCHAR(128) NOT NULL DEFAULT '',
  provider VARCHAR(64) NOT NULL DEFAULT '',
  INDEX idx_ai_conversation_user_id (user_id),
  INDEX idx_ai_conversation_created_ts (created_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ai_message: stores individual messages in conversations
CREATE TABLE ai_message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  conversation_id INT NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  token_count INT NOT NULL DEFAULT 0,
  INDEX idx_ai_message_conversation_id (conversation_id),
  INDEX idx_ai_message_created_ts (created_ts),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**File: `store/migration/postgres/0.27/01__add_ai_tables.sql`**

```sql
-- ai_conversation: stores chat conversations
CREATE TABLE ai_conversation (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  title VARCHAR(512) NOT NULL DEFAULT 'New Chat',
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  row_status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  model VARCHAR(128) NOT NULL DEFAULT '',
  provider VARCHAR(64) NOT NULL DEFAULT ''
);

CREATE INDEX idx_ai_conversation_user_id ON ai_conversation(user_id);
CREATE INDEX idx_ai_conversation_created_ts ON ai_conversation(created_ts);

-- ai_message: stores individual messages in conversations
CREATE TABLE ai_message (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  conversation_id INT NOT NULL REFERENCES ai_conversation(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  token_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_ai_message_conversation_id ON ai_message(conversation_id);
CREATE INDEX idx_ai_message_created_ts ON ai_message(created_ts);
```

### Step 1.2: Update LATEST.sql Files

Add the same table definitions to each driver's `LATEST.sql` file:

- `store/migration/sqlite/LATEST.sql`
- `store/migration/mysql/LATEST.sql`
- `store/migration/postgres/LATEST.sql`

---

## Phase 2: Protocol Buffer Definitions

### Step 2.1: Create AI Service Proto

**File: `proto/api/v1/ai_service.proto`**

```protobuf
syntax = "proto3";

package memos.api.v1;

import "google/api/annotations.proto";
import "google/api/client.proto";
import "google/api/field_behavior.proto";
import "google/api/resource.proto";
import "google/protobuf/empty.proto";
import "google/protobuf/timestamp.proto";

option go_package = "gen/api/v1";

// AIService provides AI chat functionality.
service AIService {
  // CreateConversation creates a new AI conversation.
  rpc CreateConversation(CreateConversationRequest) returns (Conversation) {
    option (google.api.http) = {
      post: "/api/v1/ai/conversations"
      body: "*"
    };
  }

  // ListConversations lists all conversations for the current user.
  rpc ListConversations(ListConversationsRequest) returns (ListConversationsResponse) {
    option (google.api.http) = {get: "/api/v1/ai/conversations"};
  }

  // GetConversation gets a specific conversation with messages.
  rpc GetConversation(GetConversationRequest) returns (Conversation) {
    option (google.api.http) = {get: "/api/v1/ai/conversations/{conversation_id}"};
  }

  // DeleteConversation deletes a conversation and all its messages.
  rpc DeleteConversation(DeleteConversationRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {delete: "/api/v1/ai/conversations/{conversation_id}"};
  }

  // UpdateConversation updates conversation metadata (e.g., title).
  rpc UpdateConversation(UpdateConversationRequest) returns (Conversation) {
    option (google.api.http) = {
      patch: "/api/v1/ai/conversations/{conversation_id}"
      body: "*"
    };
  }

  // SendMessage sends a message and gets AI response.
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse) {
    option (google.api.http) = {
      post: "/api/v1/ai/conversations/{conversation_id}/messages"
      body: "*"
    };
  }

  // StreamMessage sends a message and streams AI response.
  rpc StreamMessage(StreamMessageRequest) returns (stream StreamMessageResponse) {
    option (google.api.http) = {
      post: "/api/v1/ai/conversations/{conversation_id}/messages:stream"
      body: "*"
    };
  }

  // ListMessages lists all messages in a conversation.
  rpc ListMessages(ListMessagesRequest) returns (ListMessagesResponse) {
    option (google.api.http) = {get: "/api/v1/ai/conversations/{conversation_id}/messages"};
  }

  // GetAIConfig returns available AI providers and models.
  rpc GetAIConfig(GetAIConfigRequest) returns (GetAIConfigResponse) {
    option (google.api.http) = {get: "/api/v1/ai/config"};
  }
}

// Conversation represents an AI chat conversation.
message Conversation {
  // Unique identifier for the conversation.
  string id = 1 [(google.api.field_behavior) = OUTPUT_ONLY];

  // The user who owns this conversation.
  string user = 2 [
    (google.api.field_behavior) = OUTPUT_ONLY,
    (google.api.resource_reference) = {type: "memos.api.v1/User"}
  ];

  // Title of the conversation.
  string title = 3;

  // Creation timestamp.
  google.protobuf.Timestamp create_time = 4 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Last update timestamp.
  google.protobuf.Timestamp update_time = 5 [(google.api.field_behavior) = OUTPUT_ONLY];

  // The AI model used for this conversation.
  string model = 6;

  // The AI provider (openai, deepseek, etc.).
  string provider = 7;

  // Messages in this conversation (populated on GetConversation).
  repeated Message messages = 8 [(google.api.field_behavior) = OUTPUT_ONLY];
}

// Message represents a single message in a conversation.
message Message {
  // Unique identifier for the message.
  string id = 1 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Role of the message sender (user, assistant, system).
  MessageRole role = 2;

  // Content of the message.
  string content = 3;

  // Creation timestamp.
  google.protobuf.Timestamp create_time = 4 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Token count for this message.
  int32 token_count = 5 [(google.api.field_behavior) = OUTPUT_ONLY];
}

enum MessageRole {
  MESSAGE_ROLE_UNSPECIFIED = 0;
  USER = 1;
  ASSISTANT = 2;
  SYSTEM = 3;
}

// Request/Response messages

message CreateConversationRequest {
  // Optional title for the conversation.
  string title = 1 [(google.api.field_behavior) = OPTIONAL];

  // Optional model to use.
  string model = 2 [(google.api.field_behavior) = OPTIONAL];

  // Optional provider to use.
  string provider = 3 [(google.api.field_behavior) = OPTIONAL];
}

message ListConversationsRequest {
  // Maximum number of conversations to return.
  int32 page_size = 1 [(google.api.field_behavior) = OPTIONAL];

  // Page token for pagination.
  string page_token = 2 [(google.api.field_behavior) = OPTIONAL];
}

message ListConversationsResponse {
  repeated Conversation conversations = 1;
  string next_page_token = 2;
}

message GetConversationRequest {
  string conversation_id = 1 [(google.api.field_behavior) = REQUIRED];
}

message DeleteConversationRequest {
  string conversation_id = 1 [(google.api.field_behavior) = REQUIRED];
}

message UpdateConversationRequest {
  string conversation_id = 1 [(google.api.field_behavior) = REQUIRED];
  string title = 2 [(google.api.field_behavior) = OPTIONAL];
  string model = 3 [(google.api.field_behavior) = OPTIONAL];
  string provider = 4 [(google.api.field_behavior) = OPTIONAL];
}

message SendMessageRequest {
  string conversation_id = 1 [(google.api.field_behavior) = REQUIRED];
  string content = 2 [(google.api.field_behavior) = REQUIRED];
}

message SendMessageResponse {
  Message user_message = 1;
  Message assistant_message = 2;
}

message StreamMessageRequest {
  string conversation_id = 1 [(google.api.field_behavior) = REQUIRED];
  string content = 2 [(google.api.field_behavior) = REQUIRED];
}

message StreamMessageResponse {
  // The message being streamed.
  Message message = 1;

  // Streaming chunk content (delta).
  string chunk = 2;

  // Whether this is the final chunk.
  bool done = 3;
}

message ListMessagesRequest {
  string conversation_id = 1 [(google.api.field_behavior) = REQUIRED];
  int32 page_size = 2 [(google.api.field_behavior) = OPTIONAL];
  string page_token = 3 [(google.api.field_behavior) = OPTIONAL];
}

message ListMessagesResponse {
  repeated Message messages = 1;
  string next_page_token = 2;
}

message GetAIConfigRequest {}

message GetAIConfigResponse {
  // Whether AI is enabled on this instance.
  bool enabled = 1;

  // Available providers.
  repeated AIProvider providers = 2;

  // Default provider.
  string default_provider = 3;

  // Default model.
  string default_model = 4;
}

message AIProvider {
  string name = 1;
  string display_name = 2;
  repeated string models = 3;
}
```

### Step 2.2: Regenerate Protobuf Code

```bash
cd proto && buf generate
```

This generates:

- Go code: `proto/gen/api/v1/ai_service.pb.go`, `ai_service_grpc.pb.go`
- TypeScript code: `web/src/types/proto/api/v1/ai_service_pb.ts`

---

## Phase 3: Backend Store Layer

### Step 3.1: Create Store Models

**File: `store/ai_conversation.go`**

```go
package store

import (
	"context"
)

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
```

**File: `store/ai_message.go`**

```go
package store

import (
	"context"
)

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
```

### Step 3.2: Update Driver Interface

**File: `store/driver.go`** (add to existing interface)

```go
// Add these methods to the Driver interface:

// AIConversation model related methods.
CreateAIConversation(ctx context.Context, create *AIConversation) (*AIConversation, error)
ListAIConversations(ctx context.Context, find *FindAIConversation) ([]*AIConversation, error)
UpdateAIConversation(ctx context.Context, update *UpdateAIConversation) error
DeleteAIConversation(ctx context.Context, delete *DeleteAIConversation) error

// AIMessage model related methods.
CreateAIMessage(ctx context.Context, create *AIMessage) (*AIMessage, error)
ListAIMessages(ctx context.Context, find *FindAIMessage) ([]*AIMessage, error)
DeleteAIMessage(ctx context.Context, delete *DeleteAIMessage) error
```

### Step 3.3: Implement SQLite Driver

**File: `store/db/sqlite/ai_conversation.go`**

```go
package sqlite

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateAIConversation(ctx context.Context, create *store.AIConversation) (*store.AIConversation, error) {
	// Implementation following existing patterns in memo.go
	// Use parameterized queries to prevent SQL injection
}

func (d *DB) ListAIConversations(ctx context.Context, find *store.FindAIConversation) ([]*store.AIConversation, error) {
	// Implementation with WHERE clause building
}

func (d *DB) UpdateAIConversation(ctx context.Context, update *store.UpdateAIConversation) error {
	// Implementation with SET clause building
}

func (d *DB) DeleteAIConversation(ctx context.Context, delete *store.DeleteAIConversation) error {
	// Implementation - CASCADE will handle messages
}
```

**File: `store/db/sqlite/ai_message.go`**

```go
package sqlite

// Similar implementation for AIMessage CRUD operations
```

### Step 3.4: Implement MySQL and PostgreSQL Drivers

Create similar files:

- `store/db/mysql/ai_conversation.go`
- `store/db/mysql/ai_message.go`
- `store/db/postgres/ai_conversation.go`
- `store/db/postgres/ai_message.go`

### Step 3.5: Add Store Wrapper Methods

**File: `store/store.go`** (add methods)

```go
// Convenience methods that call the driver
func (s *Store) CreateAIConversation(ctx context.Context, create *AIConversation) (*AIConversation, error) {
	return s.driver.CreateAIConversation(ctx, create)
}

func (s *Store) ListAIConversations(ctx context.Context, find *FindAIConversation) ([]*AIConversation, error) {
	return s.driver.ListAIConversations(ctx, find)
}

// ... other methods
```

---

## Phase 4: LLM Provider Plugin

### Step 4.1: Create Provider Interface

**File: `plugin/llm/provider.go`**

```go
package llm

import (
	"context"
	"io"
)

// Message represents a chat message for LLM.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompletionRequest represents a chat completion request.
type CompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
}

// CompletionResponse represents a chat completion response.
type CompletionResponse struct {
	Content    string `json:"content"`
	TokenCount int    `json:"token_count"`
	FinishReason string `json:"finish_reason"`
}

// StreamChunk represents a streaming response chunk.
type StreamChunk struct {
	Content      string `json:"content"`
	Done         bool   `json:"done"`
	FinishReason string `json:"finish_reason,omitempty"`
}

// Provider defines the interface for LLM providers.
type Provider interface {
	// Name returns the provider name.
	Name() string

	// Models returns available models for this provider.
	Models() []string

	// Complete sends a completion request and returns the response.
	Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error)

	// Stream sends a completion request and streams the response.
	Stream(ctx context.Context, req *CompletionRequest) (<-chan StreamChunk, error)
}
```

### Step 4.2: Implement OpenAI Provider

**File: `plugin/llm/openai/client.go`**

```go
package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/usememos/memos/plugin/llm"
)

type Client struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		apiKey:  apiKey,
		baseURL: "https://api.openai.com/v1",
		client:  http.DefaultClient,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) Name() string {
	return "openai"
}

func (c *Client) Models() []string {
	return []string{"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"}
}

func (c *Client) Complete(ctx context.Context, req *llm.CompletionRequest) (*llm.CompletionResponse, error) {
	// Implement OpenAI API call
}

func (c *Client) Stream(ctx context.Context, req *llm.CompletionRequest) (<-chan llm.StreamChunk, error) {
	// Implement OpenAI streaming API
}
```

### Step 4.3: Implement DeepSeek Provider

**File: `plugin/llm/deepseek/client.go`**

```go
package deepseek

// Similar structure to OpenAI, but with DeepSeek API specifics
// DeepSeek API is largely compatible with OpenAI format

func (c *Client) Name() string {
	return "deepseek"
}

func (c *Client) Models() []string {
	return []string{"deepseek-chat", "deepseek-coder"}
}
```

### Step 4.4: Create Provider Manager

**File: `plugin/llm/manager.go`**

```go
package llm

import (
	"fmt"
	"sync"
)

// Manager manages LLM providers.
type Manager struct {
	providers map[string]Provider
	mu        sync.RWMutex

	defaultProvider string
	defaultModel    string
}

func NewManager() *Manager {
	return &Manager{
		providers: make(map[string]Provider),
	}
}

func (m *Manager) Register(provider Provider) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.providers[provider.Name()] = provider
}

func (m *Manager) GetProvider(name string) (Provider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if p, ok := m.providers[name]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("provider not found: %s", name)
}

func (m *Manager) ListProviders() []Provider {
	m.mu.RLock()
	defer m.mu.RUnlock()

	providers := make([]Provider, 0, len(m.providers))
	for _, p := range m.providers {
		providers = append(providers, p)
	}
	return providers
}
```

### Step 4.5: Configuration

**File: `plugin/llm/config.go`**

```go
package llm

// Config represents LLM configuration.
type Config struct {
	Enabled         bool              `json:"enabled"`
	DefaultProvider string            `json:"default_provider"`
	DefaultModel    string            `json:"default_model"`
	Providers       map[string]ProviderConfig `json:"providers"`
}

// ProviderConfig represents provider-specific configuration.
type ProviderConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url,omitempty"`
	Enabled bool   `json:"enabled"`
}
```

---

## Phase 5: AI Service Implementation

### Step 5.1: Create AI Service

**File: `server/router/api/v1/ai_service.go`**

```go
package v1

import (
	"context"

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

func (s *APIV1Service) CreateConversation(ctx context.Context, req *v1pb.CreateConversationRequest) (*v1pb.Conversation, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	// Create conversation in store
	conversation := &store.AIConversation{
		UID:      util.GenerateUID(),
		UserID:   user.ID,
		Title:    req.Title,
		Model:    req.Model,
		Provider: req.Provider,
	}

	created, err := s.Store.CreateAIConversation(ctx, conversation)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create conversation: %v", err)
	}

	return convertConversationToProto(created), nil
}

func (s *APIV1Service) ListConversations(ctx context.Context, req *v1pb.ListConversationsRequest) (*v1pb.ListConversationsResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "authentication required")
	}

	conversations, err := s.Store.ListAIConversations(ctx, &store.FindAIConversation{
		UserID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list conversations: %v", err)
	}

	// Convert to proto
	protoConversations := make([]*v1pb.Conversation, len(conversations))
	for i, c := range conversations {
		protoConversations[i] = convertConversationToProto(c)
	}

	return &v1pb.ListConversationsResponse{
		Conversations: protoConversations,
	}, nil
}

func (s *APIV1Service) GetConversation(ctx context.Context, req *v1pb.GetConversationRequest) (*v1pb.Conversation, error) {
	// Implementation: fetch conversation and messages
}

func (s *APIV1Service) DeleteConversation(ctx context.Context, req *v1pb.DeleteConversationRequest) (*emptypb.Empty, error) {
	// Implementation: verify ownership and delete
}

func (s *APIV1Service) SendMessage(ctx context.Context, req *v1pb.SendMessageRequest) (*v1pb.SendMessageResponse, error) {
	// Implementation:
	// 1. Verify ownership of conversation
	// 2. Save user message
	// 3. Fetch conversation history
	// 4. Call LLM provider
	// 5. Save assistant message
	// 6. Return both messages
}

func (s *APIV1Service) StreamMessage(req *v1pb.StreamMessageRequest, stream v1pb.AIService_StreamMessageServer) error {
	// Implementation:
	// 1. Verify ownership
	// 2. Save user message
	// 3. Stream response from LLM
	// 4. Send chunks via stream
	// 5. Save complete assistant message when done
}

// Helper functions
func convertConversationToProto(c *store.AIConversation) *v1pb.Conversation {
	return &v1pb.Conversation{
		Id:         c.UID,
		Title:      c.Title,
		Model:      c.Model,
		Provider:   c.Provider,
		CreateTime: timestamppb.New(time.Unix(c.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(c.UpdatedTs, 0)),
	}
}
```

### Step 5.2: Register AI Service

**File: `server/router/api/v1/v1.go`** (update)

Add to `APIV1Service` struct:

```go
v1pb.UnimplementedAIServiceServer
LLMManager *llm.Manager
```

Add to `RegisterGateway`:

```go
if err := v1pb.RegisterAIServiceHandlerServer(ctx, gwMux, s); err != nil {
	return err
}
```

### Step 5.3: Add Connect Handlers

**File: `server/router/api/v1/connect_services.go`** (update)

Register AI service Connect handlers following existing patterns.

### Step 5.4: Update ACL Config (if public endpoints needed)

**File: `server/router/api/v1/acl_config.go`** (update if needed)

AI endpoints should be authenticated, so no changes needed unless GetAIConfig is public.

---

## Phase 6: Frontend Implementation

### Step 6.1: Add Route

**File: `web/src/router/routes.ts`** (update)

```typescript
export const ROUTES = {
  ROOT: "/",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  SETTING: "/setting",
  EXPLORE: "/explore",
  AUTH: "/auth",
  AI: "/ai", // NEW
} as const;
```

**File: `web/src/router/index.tsx`** (update)

```typescript
const KnowtreeAI = lazy(() => import("@/pages/KnowtreeAI"));

// Add to routes inside RootLayout children:
{ path: Routes.AI, element: <LazyRoute component={KnowtreeAI} /> },
```

### Step 6.2: Update Navigation

**File: `web/src/components/Navigation.tsx`** (update)

```typescript
import { BotIcon } from "lucide-react"; // or use a suitable AI icon

// Add after exploreNavLink, before attachmentsNavLink:
const aiNavLink: NavLinkItem = {
  id: "header-ai",
  path: Routes.AI,
  title: "Knowtree AI",
  icon: <BotIcon className="w-6 h-auto shrink-0" />,
};

// Update navLinks array:
const navLinks: NavLinkItem[] = currentUser
  ? [homeNavLink, exploreNavLink, aiNavLink, attachmentsNavLink, inboxNavLink]
  : [exploreNavLink, signInNavLink];
```

### Step 6.3: Create React Query Hooks

**File: `web/src/hooks/useAIQueries.ts`**

```typescript
import { create } from "@bufbuild/protobuf";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiServiceClient } from "@/connect";
import type { Conversation, Message } from "@/types/proto/api/v1/ai_service_pb";

export const aiKeys = {
  all: ["ai"] as const,
  conversations: () => [...aiKeys.all, "conversations"] as const,
  conversation: (id: string) => [...aiKeys.all, "conversation", id] as const,
  messages: (conversationId: string) =>
    [...aiKeys.all, "messages", conversationId] as const,
  config: () => [...aiKeys.all, "config"] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: aiKeys.conversations(),
    queryFn: async () => {
      const response = await aiServiceClient.listConversations({});
      return response.conversations;
    },
  });
}

export function useConversation(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: aiKeys.conversation(id),
    queryFn: async () => {
      const response = await aiServiceClient.getConversation({
        conversationId: id,
      });
      return response;
    },
    enabled: options?.enabled ?? !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title?: string;
      model?: string;
      provider?: string;
    }) => {
      const response = await aiServiceClient.createConversation(params);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await aiServiceClient.deleteConversation({ conversationId });
      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      const response = await aiServiceClient.sendMessage({
        conversationId,
        content,
      });
      return response;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: aiKeys.conversation(conversationId),
      });
    },
  });
}

export function useAIConfig() {
  return useQuery({
    queryKey: aiKeys.config(),
    queryFn: async () => {
      const response = await aiServiceClient.getAIConfig({});
      return response;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### Step 6.4: Create AI Page Component

**File: `web/src/pages/KnowtreeAI.tsx`**

```typescript
import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatSidebar from "@/components/AI/ChatSidebar";
import ChatWindow from "@/components/AI/ChatWindow";
import { useConversations, useCreateConversation } from "@/hooks/useAIQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

const KnowtreeAI = () => {
  const currentUser = useCurrentUser();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const { data: conversations = [], isLoading } = useConversations();
  const createConversation = useCreateConversation();

  const handleNewChat = async () => {
    const conversation = await createConversation.mutateAsync({});
    setSelectedConversationId(conversation.id);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Please sign in to use Knowtree AI</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-4">
          <Button
            onClick={handleNewChat}
            className="w-full"
            disabled={createConversation.isPending}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ChatSidebar
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          isLoading={isLoading}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <ChatWindow conversationId={selectedConversationId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">
                Welcome to Knowtree AI
              </h2>
              <p>Start a new conversation or select an existing one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowtreeAI;
```

### Step 6.5: Create AI Components

**File: `web/src/components/AI/ChatSidebar.tsx`**

```typescript
import { Trash2Icon, MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeleteConversation } from "@/hooks/useAIQueries";
import type { Conversation } from "@/types/proto/api/v1/ai_service_pb";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading: boolean;
}

const ChatSidebar = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: Props) => {
  const deleteConversation = useDeleteConversation();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation.mutateAsync(id);
    if (selectedId === id) {
      onSelect(null);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            "flex items-center gap-2 p-3 cursor-pointer hover:bg-accent group",
            selectedId === conv.id && "bg-accent"
          )}
        >
          <MessageSquareIcon className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">
              {conv.title || "New Chat"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(
                new Date(conv.createTime?.seconds * 1000 || 0),
                { addSuffix: true }
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => handleDelete(e, conv.id)}
          >
            <Trash2Icon className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default ChatSidebar;
```

**File: `web/src/components/AI/ChatWindow.tsx`**

```typescript
import { useEffect, useRef, useState } from "react";
import { useConversation, useSendMessage } from "@/hooks/useAIQueries";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import Spinner from "@/components/Spinner";

interface Props {
  conversationId: string;
}

const ChatWindow = ({ conversationId }: Props) => {
  const { data: conversation, isLoading } = useConversation(conversationId);
  const sendMessage = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const handleSend = async (content: string) => {
    setPendingMessage(content);
    try {
      await sendMessage.mutateAsync({ conversationId, content });
    } finally {
      setPendingMessage(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const messages = conversation?.messages || [];

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {pendingMessage && (
          <>
            <MessageBubble
              message={{ role: "USER", content: pendingMessage }}
            />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner size="sm" />
              <span>AI is thinking...</span>
            </div>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={sendMessage.isPending} />
    </div>
  );
};

export default ChatWindow;
```

**File: `web/src/components/AI/MessageBubble.tsx`**

```typescript
import { UserIcon, BotIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, MessageRole } from "@/types/proto/api/v1/ai_service_pb";

interface Props {
  message: Partial<Message> & { role: string; content: string };
}

const MessageBubble = ({ message }: Props) => {
  const isUser = message.role === "USER" || message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4" />
        ) : (
          <BotIcon className="w-4 h-4" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

export default MessageBubble;
```

**File: `web/src/components/AI/ChatInput.tsx`**

```typescript
import { useState, KeyboardEvent } from "react";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled }: Props) => {
  const [content, setContent] = useState("");

  const handleSend = () => {
    if (content.trim() && !disabled) {
      onSend(content.trim());
      setContent("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="min-h-[60px] max-h-[200px] resize-none"
          disabled={disabled}
        />
        <Button onClick={handleSend} disabled={disabled || !content.trim()}>
          <SendIcon className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
```

### Step 6.6: Update Connect Client

**File: `web/src/connect.ts`** (update)

```typescript
import { AIService } from "@/types/proto/api/v1/ai_service_pb";

export const aiServiceClient = createPromiseClient(AIService, transport);
```

---

## Phase 7: Integration & Testing

### Step 7.1: Backend Tests

Create test files following existing patterns:

**File: `server/router/api/v1/test/ai_service_test.go`**

```go
package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestCreateConversation(t *testing.T) {
	ctx := context.Background()
	s := getTestingService(ctx, t)

	// Test creating a conversation
	resp, err := s.CreateConversation(ctx, &v1pb.CreateConversationRequest{
		Title: "Test Conversation",
	})
	require.NoError(t, err)
	require.NotEmpty(t, resp.Id)
	require.Equal(t, "Test Conversation", resp.Title)
}

func TestListConversations(t *testing.T) {
	// Test listing conversations
}

func TestSendMessage(t *testing.T) {
	// Test sending messages (may need mock LLM provider)
}
```

**File: `store/test/ai_test.go`**

```go
package test

// Test store layer for AI conversations and messages
```

### Step 7.2: Run Tests

```bash
# Run all tests
go test ./...

# Run specific tests
go test ./server/router/api/v1/test/... -run TestAI
go test ./store/test/... -run TestAI
```

### Step 7.3: Frontend Type Checking

```bash
cd web
pnpm lint
pnpm lint:fix
```

### Step 7.4: Integration Testing

1. Start backend: `go run ./cmd/memos --mode dev --port 8081`
2. Start frontend: `cd web && pnpm dev`
3. Test user flows:
   - Create new conversation
   - Send messages and receive AI responses
   - View chat history
   - Delete conversations
   - Switch between conversations

---

## Phase 8: Documentation & Cleanup

### Step 8.1: Update AGENTS.md

Add AI service to the architecture documentation:

```markdown
### AI Service

| File                                 | Purpose                        |
| ------------------------------------ | ------------------------------ |
| `server/router/api/v1/ai_service.go` | AI chat service implementation |
| `plugin/llm/provider.go`             | LLM provider interface         |
| `plugin/llm/openai/client.go`        | OpenAI provider                |
| `plugin/llm/deepseek/client.go`      | DeepSeek provider              |
| `store/ai_conversation.go`           | AI conversation model          |
| `store/ai_message.go`                | AI message model               |
```

### Step 8.2: Create Plugin README

**File: `plugin/llm/README.md`**

Document the LLM plugin architecture, how to add new providers, and configuration options.

### Step 8.3: Add Environment Variables

Update configuration documentation with new AI-related environment variables:

| Variable                 | Default       | Description          |
| ------------------------ | ------------- | -------------------- |
| `MEMOS_AI_ENABLED`       | `false`       | Enable AI features   |
| `MEMOS_AI_PROVIDER`      | `openai`      | Default LLM provider |
| `MEMOS_AI_MODEL`         | `gpt-4o-mini` | Default AI model     |
| `MEMOS_OPENAI_API_KEY`   | ``            | OpenAI API key       |
| `MEMOS_DEEPSEEK_API_KEY` | ``            | DeepSeek API key     |

### Step 8.4: Code Cleanup

1. Run `golangci-lint run` and fix any issues
2. Run `goimports -w .` to format Go code
3. Run `cd web && pnpm format` to format frontend code
4. Ensure all new files have proper copyright headers

---

## Summary Checklist

- [ ] **Phase 1:** Database migrations for all three drivers
- [ ] **Phase 2:** Protocol buffer definitions and code generation
- [ ] **Phase 3:** Store layer implementation (models, driver interface, implementations)
- [ ] **Phase 4:** LLM provider plugin with OpenAI and DeepSeek support
- [ ] **Phase 5:** AI service implementation with gRPC and Connect handlers
- [ ] **Phase 6:** Frontend page, components, and React Query hooks
- [ ] **Phase 7:** Backend and frontend tests
- [ ] **Phase 8:** Documentation updates

---

## Future Enhancements

1. **Streaming responses:** Implement real-time streaming using Server-Sent Events or WebSocket
2. **Context from memos:** Allow AI to reference user's memos for context-aware responses
3. **Conversation search:** Full-text search across AI conversations
4. **Export conversations:** Export chat history to Markdown or PDF
5. **Model selection UI:** Allow users to choose models per conversation
6. **Rate limiting:** Implement rate limiting for AI requests
7. **Token tracking:** Track and display token usage per user
8. **System prompts:** Allow customizable system prompts per conversation

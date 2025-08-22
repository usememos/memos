package ai

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/option"
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Common AI errors.
var (
	ErrConfigIncomplete = errors.New("AI configuration incomplete - missing BaseURL, APIKey, or Model")
	ErrEmptyRequest     = errors.New("chat request cannot be empty")
	ErrInvalidMessage   = errors.New("message role must be 'system', 'user', or 'assistant'")
	ErrEmptyContent     = errors.New("message content cannot be empty")
	ErrAPICallFailed    = errors.New("AI API call failed")
	ErrEmptyResponse    = errors.New("received empty response from AI")
	ErrNoChoices        = errors.New("AI returned no response choices")
)

// Config holds AI configuration
type Config struct {
	Enabled        bool
	BaseURL        string
	APIKey         string
	Model          string
	TimeoutSeconds int
}

// LoadConfigFromEnv loads AI configuration from environment variables
func LoadConfigFromEnv() *Config {
	timeoutSeconds := 10 // default timeout
	if timeoutStr := os.Getenv("AI_TIMEOUT_SECONDS"); timeoutStr != "" {
		if timeout, err := strconv.Atoi(timeoutStr); err == nil && timeout > 0 {
			timeoutSeconds = timeout
		}
	}

	config := &Config{
		BaseURL:        os.Getenv("AI_BASE_URL"),
		APIKey:         os.Getenv("AI_API_KEY"),
		Model:          os.Getenv("AI_MODEL"),
		TimeoutSeconds: timeoutSeconds,
	}

	// Enable AI if all required fields are provided (API Key is optional for local services like Ollama)
	config.Enabled = config.BaseURL != "" && config.Model != ""

	return config
}

// LoadConfigFromDatabase loads AI configuration from database settings
func LoadConfigFromDatabase(aiSetting *storepb.WorkspaceAISetting) *Config {
	if aiSetting == nil {
		return &Config{Enabled: false}
	}

	timeoutSeconds := int(aiSetting.TimeoutSeconds)
	if timeoutSeconds <= 0 {
		timeoutSeconds = 10 // default timeout
	}

	return &Config{
		Enabled:        aiSetting.EnableAi,
		BaseURL:        aiSetting.BaseUrl,
		APIKey:         aiSetting.ApiKey,
		Model:          aiSetting.Model,
		TimeoutSeconds: timeoutSeconds,
	}
}

// MergeWithEnv merges database config with environment variables
// Environment variables take precedence if they are set
func (c *Config) MergeWithEnv() *Config {
	envConfig := LoadConfigFromEnv()

	// Start with current config
	merged := &Config{
		Enabled:        c.Enabled,
		BaseURL:        c.BaseURL,
		APIKey:         c.APIKey,
		Model:          c.Model,
		TimeoutSeconds: c.TimeoutSeconds,
	}

	// Override with env vars if they are set
	if envConfig.BaseURL != "" {
		merged.BaseURL = envConfig.BaseURL
	}
	if envConfig.APIKey != "" {
		merged.APIKey = envConfig.APIKey
	}
	if envConfig.Model != "" {
		merged.Model = envConfig.Model
	}
	if os.Getenv("AI_TIMEOUT_SECONDS") != "" {
		merged.TimeoutSeconds = envConfig.TimeoutSeconds
	}

	// Enable if all required fields are present (API Key is optional for local services like Ollama)
	merged.Enabled = merged.BaseURL != "" && merged.Model != ""

	return merged
}

// IsConfigured returns true if AI is properly configured
func (c *Config) IsConfigured() bool {
	return c.Enabled && c.BaseURL != "" && c.Model != ""
}

// Client wraps OpenAI client with convenience methods
type Client struct {
	client openai.Client
	config *Config
}

// NewClient creates a new AI client
func NewClient(config *Config) (*Client, error) {
	if config == nil {
		return nil, errors.New("config cannot be nil")
	}

	if !config.IsConfigured() {
		return nil, ErrConfigIncomplete
	}

	var client openai.Client
	if config.BaseURL != "" && config.BaseURL != "https://api.openai.com/v1" {
		client = openai.NewClient(
			option.WithAPIKey(config.APIKey),
			option.WithBaseURL(config.BaseURL),
		)
	} else {
		client = openai.NewClient(
			option.WithAPIKey(config.APIKey),
		)
	}

	return &Client{
		client: client,
		config: config,
	}, nil
}

// ChatRequest represents a chat completion request
type ChatRequest struct {
	Messages    []Message
	MaxTokens   int
	Temperature float64
	Timeout     time.Duration
}

// Message represents a chat message
type Message struct {
	Role    string // "system", "user", "assistant"
	Content string
}

// ChatResponse represents a chat completion response
type ChatResponse struct {
	Content string
}

// Chat performs a chat completion
func (c *Client) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if req == nil {
		return nil, ErrEmptyRequest
	}

	if len(req.Messages) == 0 {
		return nil, ErrEmptyRequest
	}

	// Validate messages
	for i, msg := range req.Messages {
		if msg.Role != "system" && msg.Role != "user" && msg.Role != "assistant" {
			return nil, errors.Wrapf(ErrInvalidMessage, "message %d", i)
		}
		if strings.TrimSpace(msg.Content) == "" {
			return nil, errors.Wrapf(ErrEmptyContent, "message %d", i)
		}
	}

	// Set defaults
	if req.MaxTokens == 0 {
		req.MaxTokens = 8192
	}
	if req.Temperature == 0 {
		req.Temperature = 0.3
	}
	if req.Timeout == 0 {
		// Use timeout from config if available
		if c.config.TimeoutSeconds > 0 {
			req.Timeout = time.Duration(c.config.TimeoutSeconds) * time.Second
		} else {
			req.Timeout = 10 * time.Second
		}
	}

	model := c.config.Model
	if model == "" {
		model = "gpt-4o" // Default model
	}

	// Convert messages
	messages := make([]openai.ChatCompletionMessageParamUnion, 0, len(req.Messages))
	for _, msg := range req.Messages {
		switch msg.Role {
		case "system":
			messages = append(messages, openai.SystemMessage(msg.Content))
		case "user":
			messages = append(messages, openai.UserMessage(msg.Content))
		case "assistant":
			messages = append(messages, openai.AssistantMessage(msg.Content))
		}
	}

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, req.Timeout)
	defer cancel()

	// Make API call
	completion, err := c.client.Chat.Completions.New(timeoutCtx, openai.ChatCompletionNewParams{
		Messages:    messages,
		Model:       model,
		MaxTokens:   openai.Int(int64(req.MaxTokens)),
		Temperature: openai.Float(req.Temperature),
	})
	if err != nil {
		return nil, errors.Wrapf(ErrAPICallFailed, "%v", err)
	}

	if len(completion.Choices) == 0 {
		return nil, ErrNoChoices
	}

	response := strings.TrimSpace(completion.Choices[0].Message.Content)
	if response == "" {
		return nil, ErrEmptyResponse
	}

	return &ChatResponse{
		Content: response,
	}, nil
}

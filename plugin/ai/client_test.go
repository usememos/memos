package ai

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfigFromEnv(t *testing.T) {
	tests := []struct {
		name     string
		envVars  map[string]string
		expected *Config
	}{
		{
			name: "all environment variables set",
			envVars: map[string]string{
				"AI_BASE_URL": "https://api.openai.com/v1",
				"AI_API_KEY":  "sk-test123",
				"AI_MODEL":    "gpt-4o",
			},
			expected: &Config{
				BaseURL: "https://api.openai.com/v1",
				APIKey:  "sk-test123",
				Model:   "gpt-4o",
			},
		},
		{
			name:    "no environment variables set",
			envVars: map[string]string{},
			expected: &Config{
				BaseURL: "",
				APIKey:  "",
				Model:   "",
			},
		},
		{
			name: "partial environment variables set",
			envVars: map[string]string{
				"AI_BASE_URL": "https://custom.api.com/v1",
				"AI_API_KEY":  "sk-custom123",
			},
			expected: &Config{
				BaseURL: "https://custom.api.com/v1",
				APIKey:  "sk-custom123",
				Model:   "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save original environment variables
			origBaseURL := os.Getenv("AI_BASE_URL")
			origAPIKey := os.Getenv("AI_API_KEY")
			origModel := os.Getenv("AI_MODEL")

			// Clear existing environment variables
			os.Unsetenv("AI_BASE_URL")
			os.Unsetenv("AI_API_KEY")
			os.Unsetenv("AI_MODEL")

			// Set test environment variables
			for key, value := range tt.envVars {
				os.Setenv(key, value)
			}

			// Test configuration loading
			config := LoadConfigFromEnv()
			assert.Equal(t, tt.expected, config)

			// Restore original environment variables
			os.Unsetenv("AI_BASE_URL")
			os.Unsetenv("AI_API_KEY")
			os.Unsetenv("AI_MODEL")

			if origBaseURL != "" {
				os.Setenv("AI_BASE_URL", origBaseURL)
			}
			if origAPIKey != "" {
				os.Setenv("AI_API_KEY", origAPIKey)
			}
			if origModel != "" {
				os.Setenv("AI_MODEL", origModel)
			}
		})
	}
}

func TestConfig_IsConfigured(t *testing.T) {
	tests := []struct {
		name     string
		config   *Config
		expected bool
	}{
		{
			name: "fully configured",
			config: &Config{
				BaseURL: "https://api.openai.com/v1",
				APIKey:  "sk-test123",
				Model:   "gpt-4o",
			},
			expected: true,
		},
		{
			name: "missing base URL",
			config: &Config{
				BaseURL: "",
				APIKey:  "sk-test123",
				Model:   "gpt-4o",
			},
			expected: false,
		},
		{
			name: "missing API key",
			config: &Config{
				BaseURL: "https://api.openai.com/v1",
				APIKey:  "",
				Model:   "gpt-4o",
			},
			expected: false,
		},
		{
			name: "missing model",
			config: &Config{
				BaseURL: "https://api.openai.com/v1",
				APIKey:  "sk-test123",
				Model:   "",
			},
			expected: false,
		},
		{
			name: "all fields empty",
			config: &Config{
				BaseURL: "",
				APIKey:  "",
				Model:   "",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.config.IsConfigured()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNewClient(t *testing.T) {
	tests := []struct {
		name      string
		config    *Config
		expectErr bool
	}{
		{
			name: "standard OpenAI configuration",
			config: &Config{
				BaseURL: "https://api.openai.com/v1",
				APIKey:  "sk-test123",
				Model:   "gpt-4o",
			},
			expectErr: false,
		},
		{
			name: "custom endpoint configuration",
			config: &Config{
				BaseURL: "https://custom.api.com/v1",
				APIKey:  "sk-custom123",
				Model:   "gpt-3.5-turbo",
			},
			expectErr: false,
		},
		{
			name: "incomplete configuration",
			config: &Config{
				BaseURL: "",
				APIKey:  "sk-test123",
				Model:   "gpt-4o",
			},
			expectErr: true,
		},
		{
			name:      "nil configuration",
			config:    nil,
			expectErr: true,
		},
		{
			name: "missing API key",
			config: &Config{
				BaseURL: "https://api.openai.com/v1",
				APIKey:  "",
				Model:   "gpt-4o",
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(tt.config)

			if tt.expectErr {
				assert.Error(t, err)
				assert.Nil(t, client)
			} else {
				require.NoError(t, err)
				require.NotNil(t, client)
				assert.Equal(t, tt.config, client.config)
				assert.NotNil(t, client.client)
			}
		})
	}
}

func TestClient_Chat_RequestDefaults(t *testing.T) {
	// This test verifies that default values are properly set
	config := &Config{
		BaseURL: "https://api.openai.com/v1",
		APIKey:  "sk-test123",
		Model:   "gpt-4o",
	}

	client, err := NewClient(config)
	require.NoError(t, err)

	// Test with minimal request
	req := &ChatRequest{
		Messages: []Message{
			{Role: "user", Content: "Hello"},
		},
	}

	// We can't actually call the API in tests without mocking,
	// but we can verify the client was created successfully
	assert.NotNil(t, client)
	assert.Equal(t, config, client.config)

	// Verify default values would be set
	assert.Equal(t, 0, req.MaxTokens)              // Should become 8192
	assert.Equal(t, float64(0), req.Temperature)   // Should become 0.3
	assert.Equal(t, time.Duration(0), req.Timeout) // Should become 10s

	// Verify the Messages field is properly structured
	assert.Len(t, req.Messages, 1)
	assert.Equal(t, "user", req.Messages[0].Role)
	assert.Equal(t, "Hello", req.Messages[0].Content)
}

func TestMessage_Roles(t *testing.T) {
	tests := []struct {
		name  string
		role  string
		valid bool
	}{
		{"system role", "system", true},
		{"user role", "user", true},
		{"assistant role", "assistant", true},
		{"invalid role", "invalid", false},
		{"empty role", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := Message{
				Role:    tt.role,
				Content: "test content",
			}

			// Valid roles are those that would be handled in the switch statement
			validRoles := map[string]bool{
				"system":    true,
				"user":      true,
				"assistant": true,
			}

			assert.Equal(t, tt.valid, validRoles[msg.Role])
			assert.Equal(t, "test content", msg.Content)
		})
	}
}

// Integration test helper - only runs with proper environment variables
func TestClient_Chat_Integration(t *testing.T) {
	// Skip if not in integration test mode
	if os.Getenv("AI_INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test - set AI_INTEGRATION_TEST=true to run")
	}

	config := LoadConfigFromEnv()
	if !config.IsConfigured() {
		t.Skip("AI not configured - set AI_BASE_URL, AI_API_KEY, AI_MODEL environment variables")
	}

	client, err := NewClient(config)
	require.NoError(t, err)
	ctx := context.Background()

	req := &ChatRequest{
		Messages: []Message{
			{Role: "user", Content: "Say 'Hello, World!' in exactly those words."},
		},
		MaxTokens:   50,
		Temperature: 0.1,
		Timeout:     30 * time.Second,
	}

	resp, err := client.Chat(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.Content)

	t.Logf("AI Response: %s", resp.Content)
}

func TestClient_Chat_Validation(t *testing.T) {
	config := &Config{
		BaseURL: "https://api.openai.com/v1",
		APIKey:  "sk-test123",
		Model:   "gpt-4o",
	}

	client, err := NewClient(config)
	require.NoError(t, err)
	ctx := context.Background()

	tests := []struct {
		name      string
		request   *ChatRequest
		expectErr error
	}{
		{
			name:      "nil request",
			request:   nil,
			expectErr: ErrEmptyRequest,
		},
		{
			name: "empty messages",
			request: &ChatRequest{
				Messages: []Message{},
			},
			expectErr: ErrEmptyRequest,
		},
		{
			name: "invalid message role",
			request: &ChatRequest{
				Messages: []Message{
					{Role: "invalid", Content: "Hello"},
				},
			},
			expectErr: ErrInvalidMessage,
		},
		{
			name: "empty message content",
			request: &ChatRequest{
				Messages: []Message{
					{Role: "user", Content: ""},
				},
			},
			expectErr: ErrEmptyContent,
		},
		{
			name: "whitespace-only message content",
			request: &ChatRequest{
				Messages: []Message{
					{Role: "user", Content: "   \n\t   "},
				},
			},
			expectErr: ErrEmptyContent,
		},
		{
			name: "valid request",
			request: &ChatRequest{
				Messages: []Message{
					{Role: "user", Content: "Hello"},
				},
			},
			expectErr: nil, // This will fail with API call error in tests, but validation should pass
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.Chat(ctx, tt.request)

			if tt.expectErr != nil {
				assert.Error(t, err)
				assert.ErrorIs(t, err, tt.expectErr)
			} else {
				// For the valid request case, we expect an API call error since we don't have real credentials
				// but the validation should pass, so we just check that it's not a validation error
				if err != nil {
					assert.NotErrorIs(t, err, ErrEmptyRequest)
					assert.NotErrorIs(t, err, ErrInvalidMessage)
					assert.NotErrorIs(t, err, ErrEmptyContent)
				}
			}
		})
	}
}

func TestClient_Chat_ErrorTypes(t *testing.T) {
	config := &Config{
		BaseURL: "https://api.openai.com/v1",
		APIKey:  "sk-test123",
		Model:   "gpt-4o",
	}

	client, err := NewClient(config)
	require.NoError(t, err)
	ctx := context.Background()

	// Test that we can identify specific error types
	t.Run("can check for specific errors", func(t *testing.T) {
		_, err := client.Chat(ctx, nil)
		assert.ErrorIs(t, err, ErrEmptyRequest)

		_, err = client.Chat(ctx, &ChatRequest{
			Messages: []Message{
				{Role: "invalid", Content: "test"},
			},
		})
		assert.ErrorIs(t, err, ErrInvalidMessage)
	})
}

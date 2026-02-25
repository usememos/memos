package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/pkg/errors"
)

const (
	defaultAPIBaseURL = "https://api.openai.com/v1"
	defaultModel      = "gpt-4o"
)

// Config holds the configuration for the AI client.
type Config struct {
	APIKey     string
	APIBaseURL string
	Model      string
}

// Client is an OpenAI-compatible HTTP client.
type Client struct {
	config     Config
	httpClient *http.Client
}

// NewClient creates a new AI client with the given configuration.
// It applies default values for APIBaseURL and Model if not set.
func NewClient(config Config) *Client {
	if config.APIBaseURL == "" {
		config.APIBaseURL = defaultAPIBaseURL
	}
	if config.Model == "" {
		config.Model = defaultModel
	}
	return &Client{
		config:     config,
		httpClient: http.DefaultClient,
	}
}

// ChatMessage represents a single message in a chat conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
}

// GenerateCompletion sends a chat completion request and returns the assistant's message content.
func (c *Client) GenerateCompletion(ctx context.Context, messages []ChatMessage) (string, error) {
	reqBody := chatCompletionRequest{
		Model:       c.config.Model,
		Messages:    messages,
		Temperature: 0.8,
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", errors.Wrap(err, "failed to marshal chat completion request")
	}

	url := c.config.APIBaseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", errors.Wrap(err, "failed to construct chat completion request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", errors.Wrap(err, "failed to send chat completion request")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", errors.Wrap(err, "failed to read chat completion response")
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return "", errors.Errorf("chat completion request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result chatCompletionResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", errors.Wrap(err, "failed to unmarshal chat completion response")
	}

	if len(result.Choices) == 0 {
		return "", errors.New("chat completion response contains no choices")
	}

	return result.Choices[0].Message.Content, nil
}

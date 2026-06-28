package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
)

const (
	defaultBaseURL = "http://127.0.0.1:11434"
	defaultModel   = "llama3"
)

// Config configures an Ollama provider.
type Config struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
	Timeout    time.Duration
}

// OllamaProvider implements Provider using Ollama's /api/chat endpoint.
type OllamaProvider struct {
	baseURL string
	model   string
	client  *http.Client
}

// NewOllamaProvider constructs an Ollama provider.
func NewOllamaProvider(cfg Config) (*OllamaProvider, error) {
	baseURL, err := normalizeBaseURL(cfg.BaseURL)
	if err != nil {
		return nil, err
	}

	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = defaultModel
	}

	client := cfg.HTTPClient
	if client == nil {
		timeout := cfg.Timeout
		if timeout <= 0 {
			timeout = 30 * time.Second
		}
		client = &http.Client{Timeout: timeout}
	} else if client.Timeout <= 0 && cfg.Timeout > 0 {
		client.Timeout = cfg.Timeout
	}

	return &OllamaProvider{baseURL: baseURL, model: model, client: client}, nil
}

// GenerateSummary asks Ollama to produce a JSON summary payload.
func (p *OllamaProvider) GenerateSummary(ctx context.Context, content string) (string, error) {
	var response struct {
		Summary string `json:"summary"`
	}
	if err := p.generateJSON(ctx, summarySystemPrompt, "请为下面笔记生成摘要：\n"+content, &response); err != nil {
		return "", err
	}
	return strings.TrimSpace(response.Summary), nil
}

// ExtractTags asks Ollama to produce a JSON list of candidate tags.
func (p *OllamaProvider) ExtractTags(ctx context.Context, content string) ([]string, error) {
	var response struct {
		Tags []string `json:"tags"`
	}
	if err := p.generateJSON(ctx, tagsSystemPrompt, "请从下面笔记中提取最合适的标签：\n"+content, &response); err != nil {
		return nil, err
	}

	tags := make([]string, 0, len(response.Tags))
	for _, tag := range response.Tags {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			tags = append(tags, tag)
		}
	}
	return tags, nil
}

// DeriveRelations asks Ollama to score candidate memo relations.
func (p *OllamaProvider) DeriveRelations(ctx context.Context, currentMemo string, candidateMemos []string) ([]RelationSuggestion, error) {
	type relationItem struct {
		CandidateIndex int     `json:"candidate_index"`
		Score          float64 `json:"score"`
		Reason         string  `json:"reason"`
	}
	var response struct {
		Relations []relationItem `json:"relations"`
	}

	var prompt strings.Builder
	prompt.WriteString("当前笔记：\n")
	prompt.WriteString(currentMemo)
	prompt.WriteString("\n\n候选笔记：\n")
	for i, memo := range candidateMemos {
		prompt.WriteString("[")
		prompt.WriteString(strconv.Itoa(i))
		prompt.WriteString("] ")
		prompt.WriteString(strings.TrimSpace(memo))
		prompt.WriteString("\n")
	}

	if err := p.generateJSON(ctx, relationSystemPrompt, prompt.String(), &response); err != nil {
		return nil, err
	}

	relations := make([]RelationSuggestion, 0, len(response.Relations))
	for _, item := range response.Relations {
		relations = append(relations, RelationSuggestion{
			CandidateIndex: item.CandidateIndex,
			Score:          item.Score,
			Reason:         strings.TrimSpace(item.Reason),
		})
	}
	return relations, nil
}

func (p *OllamaProvider) generateJSON(ctx context.Context, systemPrompt, userPrompt string, out any) error {
	response, err := p.chat(ctx, systemPrompt, userPrompt)
	if err != nil {
		return err
	}

	raw := strings.TrimSpace(response.Message.Content)
	if raw == "" {
		return errors.New("empty ollama response")
	}
	if err := json.Unmarshal([]byte(raw), out); err != nil {
		return errors.Wrapf(err, "invalid structured output from ollama: %s", truncate(raw, 300))
	}
	return nil
}

func (p *OllamaProvider) chat(ctx context.Context, systemPrompt, userPrompt string) (*chatResponse, error) {
	payload := chatRequest{
		Model:  p.model,
		Stream: false,
		Format: "json",
		Options: map[string]any{
			"temperature": 0,
		},
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal ollama request")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, errors.Wrap(err, "failed to create ollama request")
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, classifyOllamaError(err, p.baseURL)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		message, readErr := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		if readErr != nil {
			return nil, errors.Wrapf(readErr, "ollama request failed with status %s", resp.Status)
		}
		trimmed := strings.TrimSpace(string(message))
		if trimmed == "" {
			trimmed = "empty response body"
		}
		return nil, errors.Errorf("ollama request failed with status %s: %s", resp.Status, trimmed)
	}

	var result chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, errors.Wrap(err, "failed to decode ollama response")
	}
	if strings.TrimSpace(result.Error) != "" {
		return nil, errors.Errorf("ollama returned error: %s", result.Error)
	}
	return &result, nil
}

func normalizeBaseURL(baseURL string) (string, error) {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	parsed, err := url.ParseRequestURI(baseURL)
	if err != nil {
		return "", errors.Wrap(err, "invalid ollama base url")
	}
	if strings.EqualFold(parsed.Hostname(), "localhost") {
		parsed.Host = strings.Replace(parsed.Host, "localhost", "127.0.0.1", 1)
		baseURL = parsed.String()
	}
	return strings.TrimRight(baseURL, "/"), nil
}

func classifyOllamaError(err error, baseURL string) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return errors.Wrap(err, "ollama request timed out or was canceled")
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return errors.Wrapf(err, "ollama service is unreachable at %s", baseURL)
	}

	return errors.Wrap(err, "failed to send ollama request")
}

func truncate(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max] + "..."
}

type chatRequest struct {
	Model    string        `json:"model"`
	Stream   bool          `json:"stream"`
	Format   string        `json:"format,omitempty"`
	Options  map[string]any `json:"options,omitempty"`
	Messages []chatMessage  `json:"messages"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Message struct {
		Content string `json:"content"`
	} `json:"message"`
	Error string `json:"error"`
}

const (
	summarySystemPrompt  = "你是严谨的笔记摘要器。只输出 JSON，格式必须是 {\"summary\":\"...\"}，不要输出多余解释。"
	tagsSystemPrompt     = "你是严谨的标签提取器。只输出 JSON，格式必须是 {\"tags\":[\"tag1\",\"tag2\"]}，不要输出多余解释。"
	relationSystemPrompt = "你是严谨的知识关系推导器。只输出 JSON，格式必须是 {\"relations\":[{\"candidate_index\":0,\"score\":0.9,\"reason\":\"...\"}] }，不要输出多余解释。score 取 0 到 1。"
)

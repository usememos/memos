package ai

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strings"
	"text/template"
	"time"
)

// defaultSystemPrompt contains the core instructions for tag recommendation.
const defaultSystemPrompt = `You are an AI assistant that helps users organize their notes by suggesting relevant tags.

Your task is to analyze the note content and suggest 3-5 tags that would help categorize and find this note later.

Guidelines:
- Use the same language as the note content for tag names
- Suggest specific, descriptive tags rather than generic ones
- Focus on the main topics, concepts, and keywords in the content
- If the note mentions specific people, places, projects, or tools, consider including them as tags
- Keep tags concise and practical for search and organization

Output format: Provide your suggestions as a list in this format:
[tag1](reason for this tag) [tag2](reason for this tag) [tag3](reason for this tag)

Example:
Note: "Meeting notes from the Q3 planning session. Discussed new mobile app features including dark mode and social login."
Output: [meeting-notes](this is a record of a meeting) [Q3-planning](relates to Q3 quarter planning) [mobile-app](discusses mobile application features) [product-features](about new product functionality)`

// userMessageTemplate contains only the user data to be analyzed.
const userMessageTemplate = `{{if .ExistingTags}}Existing Tags: {{.ExistingTags}}

{{end}}Note Content:
{{.NoteContent}}`

// TagSuggestionRequest represents a tag suggestion request
type TagSuggestionRequest struct {
	Content       string   // The memo content to analyze
	UserTags      []string // User's frequently used tags (optional)
	ExistingTags  []string // Tags already in the memo (optional)
	SystemPrompt  string   // Custom system prompt (optional, uses default if empty)
}

// TagSuggestion represents a single tag suggestion with reason
type TagSuggestion struct {
	Tag    string
	Reason string
}

// TagSuggestionResponse represents the response from tag suggestion
type TagSuggestionResponse struct {
	Tags []TagSuggestion
}

// GetDefaultSystemPrompt returns the default system prompt for tag recommendation
func GetDefaultSystemPrompt() string {
	return defaultSystemPrompt
}

// SuggestTags suggests tags for memo content using AI
func (c *Client) SuggestTags(ctx context.Context, req *TagSuggestionRequest) (*TagSuggestionResponse, error) {
	// Validate request
	if req == nil {
		return nil, fmt.Errorf("request cannot be nil")
	}

	if strings.TrimSpace(req.Content) == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}

	// Prepare user tags context
	userTagsContext := ""
	if len(req.UserTags) > 0 {
		topTags := req.UserTags
		if len(topTags) > 20 {
			topTags = topTags[:20]
		}
		userTagsContext = strings.Join(topTags, ", ")
	}

	// Create user message with user data only
	userTmpl, err := template.New("userMessage").Parse(userMessageTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse user message template: %w", err)
	}

	var userMsgBuf bytes.Buffer
	err = userTmpl.Execute(&userMsgBuf, map[string]string{
		"ExistingTags": userTagsContext,
		"NoteContent":  req.Content,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to execute user message template: %w", err)
	}

	// Use custom system prompt if provided, otherwise use default
	promptToUse := defaultSystemPrompt
	if req.SystemPrompt != "" {
		promptToUse = req.SystemPrompt
	}

	// Make AI request with separated system and user messages
	chatReq := &ChatRequest{
		Messages: []Message{
			{Role: "system", Content: promptToUse},
			{Role: "user", Content: userMsgBuf.String()},
		},
		MaxTokens:   8192,
		Temperature: 0.8,
		Timeout:     15 * time.Second,
	}

	response, err := c.Chat(ctx, chatReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get AI response for tag suggestion: %w", err)
	}

	tags := c.parseTagResponse(response.Content)

	// Validate that we got some meaningful response
	if len(tags) == 0 {
		return nil, fmt.Errorf("AI returned no valid tag suggestions")
	}

	return &TagSuggestionResponse{
		Tags: tags,
	}, nil
}

// parseTagResponse parses AI response for [tag](reason) patterns
func (c *Client) parseTagResponse(responseText string) []TagSuggestion {
	tags := make([]TagSuggestion, 0)

	// Match [tag](reason) format using regex across response
	pattern := `\[([^\]]+)\]\(([^)]+)\)`
	re := regexp.MustCompile(pattern)
	matches := re.FindAllStringSubmatch(responseText, -1)

	for _, match := range matches {
		if len(match) >= 3 {
			tag := strings.TrimSpace(match[1])
			reason := strings.TrimSpace(match[2])

			// Remove # prefix if AI included it
			tag = strings.TrimPrefix(tag, "#")

			// Clean and validate tag
			if tag != "" && len(tag) <= 100 {
				// Limit reason length
				if len(reason) > 100 {
					reason = reason[:100] + "..."
				}
				tags = append(tags, TagSuggestion{
					Tag:    tag,
					Reason: reason,
				})
			}
		}
	}

	return tags
}

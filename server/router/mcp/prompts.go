package mcp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

func (s *MCPService) registerPrompts(mcpSrv *mcpserver.MCPServer) {
	// capture — turns free-form user input into a structured create_memo call.
	mcpSrv.AddPrompt(
		mcp.NewPrompt("capture",
			mcp.WithPromptDescription("Capture a thought, idea, or note as a new memo. "+
				"Use this prompt when the user wants to quickly save something. "+
				"The assistant will call create_memo with the provided content."),
			mcp.WithArgument("content",
				mcp.ArgumentDescription("The text to save as a memo"),
				mcp.RequiredArgument(),
			),
			mcp.WithArgument("tags",
				mcp.ArgumentDescription("Comma-separated tags to apply, e.g. \"work,project\""),
			),
			mcp.WithArgument("visibility",
				mcp.ArgumentDescription("Memo visibility: PRIVATE (default), PROTECTED, or PUBLIC"),
			),
		),
		s.handleCapturePrompt,
	)

	// review — surfaces existing memos on a topic for summarisation.
	mcpSrv.AddPrompt(
		mcp.NewPrompt("review",
			mcp.WithPromptDescription("Search and review memos on a given topic. "+
				"The assistant will call search_memos and summarise the results, "+
				"including memo resource URIs for easy reference."),
			mcp.WithArgument("topic",
				mcp.ArgumentDescription("Topic or keyword to search for"),
				mcp.RequiredArgument(),
			),
		),
		s.handleReviewPrompt,
	)

	// daily_digest — summarise recent activity.
	mcpSrv.AddPrompt(
		mcp.NewPrompt("daily_digest",
			mcp.WithPromptDescription("Get a summary of recent memo activity. "+
				"The assistant will list recent memos, group them by tags, and highlight "+
				"any incomplete tasks or pinned items."),
			mcp.WithArgument("days",
				mcp.ArgumentDescription("Number of days to look back (default: 1)"),
			),
		),
		s.handleDailyDigestPrompt,
	)

	// organize — suggest tags and relations for untagged memos.
	mcpSrv.AddPrompt(
		mcp.NewPrompt("organize",
			mcp.WithPromptDescription("Analyze untagged or loosely organized memos and suggest "+
				"tags, relations, and groupings to improve discoverability."),
			mcp.WithArgument("scope",
				mcp.ArgumentDescription("Scope of analysis: \"untagged\" (default) for memos without tags, \"all\" for all recent memos"),
			),
		),
		s.handleOrganizePrompt,
	)
}

func (*MCPService) handleCapturePrompt(_ context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	content := req.Params.Arguments["content"]
	if content == "" {
		return nil, errors.New("content argument is required")
	}

	tags := req.Params.Arguments["tags"]
	visibility := req.Params.Arguments["visibility"]
	if visibility == "" {
		visibility = "PRIVATE"
	}

	var sb strings.Builder
	sb.WriteString("Save the following as a new memo using the create_memo tool.\n\n")
	sb.WriteString(fmt.Sprintf("Visibility: %s\n\n", visibility))
	sb.WriteString("Content:\n")
	sb.WriteString(content)
	if tags != "" {
		sb.WriteString(fmt.Sprintf("\n\nAppend these tags inline using #tag syntax: %s", tags))
	}
	sb.WriteString("\n\nAfter creating the memo, confirm by showing the memo resource name (e.g. memo://memos/<uid>) so it can be referenced later.")

	return &mcp.GetPromptResult{
		Description: "Capture a memo",
		Messages: []mcp.PromptMessage{
			mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(sb.String())),
		},
	}, nil
}

func (*MCPService) handleReviewPrompt(_ context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	topic := req.Params.Arguments["topic"]
	if topic == "" {
		return nil, errors.New("topic argument is required")
	}

	instruction := fmt.Sprintf(
		`Use the search_memos tool to find memos about %q, then:

1. Group results by theme or tag
2. For each memo, include its resource reference (memo://memos/<uid>) so the user can access it directly
3. Provide a concise summary of what has been written on this topic
4. Highlight any memos with incomplete tasks (has_incomplete_tasks)
5. Note the most recent update times to show currency of the information`,
		topic,
	)

	return &mcp.GetPromptResult{
		Description: fmt.Sprintf("Review memos about %q", topic),
		Messages: []mcp.PromptMessage{
			mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(instruction)),
		},
	}, nil
}

func (*MCPService) handleDailyDigestPrompt(_ context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	days := req.Params.Arguments["days"]
	if days == "" {
		days = "1"
	}

	instruction := fmt.Sprintf(
		`Generate a daily digest of memo activity from the last %s day(s):

1. Use list_memos to fetch recent memos (order by update time, check multiple pages if needed)
2. Use list_tags to get the current tag landscape
3. Group memos by tags and summarize each group
4. Highlight:
   - Pinned memos (important items)
   - Memos with incomplete tasks (action items)
   - New memos created vs. memos updated
5. Include memo resource references (memo://memos/<uid>) for each item
6. End with a brief "action items" section listing incomplete tasks across all memos`, days,
	)

	return &mcp.GetPromptResult{
		Description: "Daily memo digest",
		Messages: []mcp.PromptMessage{
			mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(instruction)),
		},
	}, nil
}

func (*MCPService) handleOrganizePrompt(_ context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	scope := req.Params.Arguments["scope"]
	if scope == "" {
		scope = "untagged"
	}

	var filter string
	if scope == "untagged" {
		filter = `Focus on memos that have no tags. Use list_memos and identify those with empty tag arrays.`
	} else {
		filter = `Analyze all recent memos regardless of tagging status.`
	}

	instruction := fmt.Sprintf(
		`Analyze memos and suggest organizational improvements:

1. %s
2. Use list_tags to understand the existing tag taxonomy
3. For each unorganized memo, suggest:
   - Appropriate tags from the existing taxonomy, or new tags if needed
   - Potential relations (references) to other memos on similar topics
4. Present suggestions as a structured list:
   - Memo: memo://memos/<uid> (first line of content as preview)
   - Suggested tags: #tag1, #tag2
   - Related to: memo://memos/<other-uid> (brief reason)
5. After presenting suggestions, ask the user which changes to apply
6. Apply approved changes using update_memo (for tags in content) and create_memo_relation (for references)`, filter,
	)

	return &mcp.GetPromptResult{
		Description: fmt.Sprintf("Organize memos (scope: %s)", scope),
		Messages: []mcp.PromptMessage{
			mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(instruction)),
		},
	}, nil
}

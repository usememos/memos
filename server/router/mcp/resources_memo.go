package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/pkg/errors"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// Memo resource URI scheme: memo://memos/{uid}
// Clients can read any memo they have access to by URI without calling a tool.

func (s *MCPService) registerMemoResources(mcpSrv *mcpserver.MCPServer) {
	mcpSrv.AddResourceTemplate(
		mcp.NewResourceTemplate(
			"memo://memos/{uid}",
			"Memo",
			mcp.WithTemplateDescription("A single Memos note identified by its UID. Returns the memo content as Markdown with a YAML frontmatter header containing metadata."),
			mcp.WithTemplateMIMEType("text/markdown"),
		),
		s.handleReadMemoResource,
	)
}

func (s *MCPService) handleReadMemoResource(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
	userID := auth.GetUserID(ctx)

	// URI format: memo://memos/{uid}
	uid := strings.TrimPrefix(req.Params.URI, "memo://memos/")
	if uid == req.Params.URI || uid == "" {
		return nil, errors.Errorf("invalid memo URI %q: expected memo://memos/<uid>", req.Params.URI)
	}

	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo")
	}
	if memo == nil {
		return nil, errors.Errorf("memo not found: %s", uid)
	}
	if err := checkMemoAccess(memo, userID); err != nil {
		return nil, err
	}

	j := storeMemoToJSON(memo)
	text := formatMemoMarkdown(j)

	return []mcp.ResourceContents{
		mcp.TextResourceContents{
			URI:      req.Params.URI,
			MIMEType: "text/markdown",
			Text:     text,
		},
	}, nil
}

// formatMemoMarkdown renders a memo as Markdown with a YAML frontmatter header.
func formatMemoMarkdown(j memoJSON) string {
	var sb strings.Builder

	sb.WriteString("---\n")
	fmt.Fprintf(&sb, "name: %s\n", j.Name)
	fmt.Fprintf(&sb, "creator: %s\n", j.Creator)
	fmt.Fprintf(&sb, "visibility: %s\n", j.Visibility)
	fmt.Fprintf(&sb, "state: %s\n", j.State)
	fmt.Fprintf(&sb, "pinned: %v\n", j.Pinned)
	if len(j.Tags) > 0 {
		fmt.Fprintf(&sb, "tags: [%s]\n", strings.Join(j.Tags, ", "))
	}
	fmt.Fprintf(&sb, "create_time: %d\n", j.CreateTime)
	fmt.Fprintf(&sb, "update_time: %d\n", j.UpdateTime)
	if j.Parent != "" {
		fmt.Fprintf(&sb, "parent: %s\n", j.Parent)
	}
	sb.WriteString("---\n\n")
	sb.WriteString(j.Content)

	return sb.String()
}

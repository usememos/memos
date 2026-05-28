package mcp

import "github.com/mark3labs/mcp-go/mcp"

var mcpToolsByToolset = map[string]map[string]struct{}{
	"memos": stringSet(
		"list_memos",
		"get_memo",
		"create_memo",
		"update_memo",
		"delete_memo",
		"search_memos",
		"list_memo_comments",
		"create_memo_comment",
	),
	"tags": stringSet(
		"list_tags",
	),
	"attachments": stringSet(
		"list_attachments",
		"get_attachment",
		"delete_attachment",
		"link_attachment_to_memo",
	),
	"relations": stringSet(
		"list_memo_relations",
		"create_memo_relation",
		"delete_memo_relation",
	),
	"reactions": stringSet(
		"list_reactions",
		"upsert_reaction",
		"delete_reaction",
	),
}

var allMCPToolNames = func() map[string]struct{} {
	names := map[string]struct{}{}
	for _, tools := range mcpToolsByToolset {
		for name := range tools {
			names[name] = struct{}{}
		}
	}
	return names
}()

var mcpMutationTools = stringSet(
	"create_memo",
	"update_memo",
	"delete_memo",
	"create_memo_comment",
	"delete_attachment",
	"link_attachment_to_memo",
	"create_memo_relation",
	"delete_memo_relation",
	"upsert_reaction",
	"delete_reaction",
)

type deletedJSON struct {
	Deleted bool `json:"deleted"`
}

func stringSet(values ...string) map[string]struct{} {
	result := make(map[string]struct{}, len(values))
	for _, value := range values {
		result[value] = struct{}{}
	}
	return result
}

func readOnlyToolOptions(title string, description string, opts ...mcp.ToolOption) []mcp.ToolOption {
	return annotatedToolOptions(title, description, true, false, true, false, opts...)
}

func createToolOptions(title string, description string, idempotent bool, opts ...mcp.ToolOption) []mcp.ToolOption {
	return annotatedToolOptions(title, description, false, false, idempotent, false, opts...)
}

func updateToolOptions(title string, description string, opts ...mcp.ToolOption) []mcp.ToolOption {
	return annotatedToolOptions(title, description, false, true, false, false, opts...)
}

func annotatedToolOptions(title string, description string, readOnly bool, destructive bool, idempotent bool, openWorld bool, opts ...mcp.ToolOption) []mcp.ToolOption {
	base := []mcp.ToolOption{
		mcp.WithTitleAnnotation(title),
		mcp.WithDescription(description),
		mcp.WithReadOnlyHintAnnotation(readOnly),
		mcp.WithDestructiveHintAnnotation(destructive),
		mcp.WithIdempotentHintAnnotation(idempotent),
		mcp.WithOpenWorldHintAnnotation(openWorld),
	}
	return append(base, opts...)
}

func newToolResultJSON(v any) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultJSON(v)
}

func newDeletedToolResult() (*mcp.CallToolResult, error) {
	return newToolResultJSON(deletedJSON{Deleted: true})
}

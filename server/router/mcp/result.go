package mcp

import (
	"bytes"
	"encoding/json"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

func normalizeStructuredContent(value any) map[string]any {
	switch typed := value.(type) {
	case nil:
		return map[string]any{"ok": true}
	case map[string]any:
		return typed
	case []any:
		return map[string]any{"result": typed}
	default:
		return map[string]any{"result": typed}
	}
}

func newStructuredToolResult(value any) (*sdkmcp.CallToolResult, error) {
	structured := normalizeStructuredContent(value)
	text, err := json.Marshal(structured)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal MCP structured result")
	}
	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: string(text)},
		},
		StructuredContent: structured,
	}, nil
}

// newToolErrorResult reports a tool execution error through IsError and text
// content only. Error results must not carry structuredContent: every tool
// declares an outputSchema describing its success payload, and spec-strict
// clients validate structuredContent against that schema — an {"error": ...}
// object fails validation and masks the real error message.
func newToolErrorResult(message string) *sdkmcp.CallToolResult {
	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: message},
		},
		IsError: true,
	}
}

func decodeJSONValue(data []byte) (any, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, nil
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, errors.Wrap(err, "failed to decode API JSON response")
	}
	return value, nil
}

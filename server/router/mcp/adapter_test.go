package mcp

import (
	"encoding/json"
	"errors"
	"testing"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
)

func TestNormalizeStructuredContentKeepsObjects(t *testing.T) {
	result := normalizeStructuredContent(map[string]any{"memos": []any{map[string]any{"name": "memos/a"}}})
	require.Equal(t, map[string]any{"memos": []any{map[string]any{"name": "memos/a"}}}, result)
}

func TestNormalizeStructuredContentWrapsArrays(t *testing.T) {
	result := normalizeStructuredContent([]any{map[string]any{"tag": "work"}})
	require.Equal(t, map[string]any{"result": []any{map[string]any{"tag": "work"}}}, result)
}

func TestNormalizeStructuredContentUsesOKForNil(t *testing.T) {
	result := normalizeStructuredContent(nil)
	require.Equal(t, map[string]any{"ok": true}, result)
}

func TestNormalizeStructuredContentWrapsScalars(t *testing.T) {
	result := normalizeStructuredContent("created")
	require.Equal(t, map[string]any{"result": "created"}, result)
}

func TestNewStructuredToolResultUsesObjectStructuredContent(t *testing.T) {
	result, err := newStructuredToolResult([]any{"one"})
	require.NoError(t, err)
	require.IsType(t, map[string]any{}, result.StructuredContent)
	require.Equal(t, map[string]any{"result": []any{"one"}}, result.StructuredContent)
	require.NotEmpty(t, result.Content)
	text, ok := result.Content[0].(*sdkmcp.TextContent)
	require.True(t, ok)
	require.JSONEq(t, `{"result":["one"]}`, text.Text)
}

func TestNewToolErrorResult(t *testing.T) {
	result := newToolErrorResult("resource not found")
	require.True(t, result.IsError)
	require.NotEmpty(t, result.Content)
	text, ok := result.Content[0].(*sdkmcp.TextContent)
	require.True(t, ok)
	require.Equal(t, "resource not found", text.Text)
}

func TestDecodeJSONValue(t *testing.T) {
	value, err := decodeJSONValue([]byte(`{"ok":true}`))
	require.NoError(t, err)
	require.Equal(t, map[string]any{"ok": true}, value)

	value, err = decodeJSONValue([]byte{})
	require.NoError(t, err)
	require.Nil(t, value)

	value, err = decodeJSONValue([]byte(" \n\t "))
	require.NoError(t, err)
	require.Nil(t, value)

	value, err = decodeJSONValue([]byte(`[1,"two"]`))
	require.NoError(t, err)
	require.Equal(t, []any{float64(1), "two"}, value)

	_, err = decodeJSONValue([]byte(`{`))
	require.Error(t, err)
	require.True(t, errorsIsJSONSyntax(err), "wrapped syntax errors should remain inspectable")
}

func errorsIsJSONSyntax(err error) bool {
	var syntaxError *json.SyntaxError
	return err != nil && errors.As(err, &syntaxError)
}

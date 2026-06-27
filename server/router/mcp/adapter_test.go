package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/labstack/echo/v5"
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
	require.Equal(t, map[string]any{
		"error": map[string]any{
			"message": "resource not found",
		},
	}, result.StructuredContent)
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

func TestBuildAPIRequestMapsPathQueryAndBody(t *testing.T) {
	operation := &openAPIOperation{
		Method: "PATCH",
		Path:   "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{
			{Name: "memo", In: "path", Required: true, Schema: jsonSchema{"type": "string"}},
			{Name: "updateMask", In: "query", Schema: jsonSchema{"type": "string"}},
		},
		RequestBody: &openAPIRequestBody{Required: true},
	}
	arguments := map[string]any{
		"memo":       "abc123",
		"updateMask": "content",
		"body": map[string]any{
			"memo": map[string]any{
				"name":    "memos/abc123",
				"content": "updated",
			},
		},
	}

	req, err := buildAPIRequest(context.Background(), operation, arguments, "Bearer pat")
	require.NoError(t, err)
	require.Equal(t, "PATCH", req.Method)
	require.Equal(t, "/api/v1/memos/abc123", req.URL.Path)
	require.Equal(t, "content", req.URL.Query().Get("updateMask"))
	require.Equal(t, "Bearer pat", req.Header.Get("Authorization"))

	body, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.JSONEq(t, `{"memo":{"name":"memos/abc123","content":"updated"}}`, string(body))
}

func TestBuildAPIRequestRequiresPathParameters(t *testing.T) {
	operation := &openAPIOperation{
		Method:     "GET",
		Path:       "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{{Name: "memo", In: "path", Required: true}},
	}

	_, err := buildAPIRequest(context.Background(), operation, map[string]any{}, "")
	require.ErrorContains(t, err, `missing required path parameter "memo"`)
}

func TestBuildAPIRequestRequiresRequestBody(t *testing.T) {
	operation := &openAPIOperation{
		Method:      "POST",
		Path:        "/api/v1/memos",
		RequestBody: &openAPIRequestBody{Required: true},
	}

	_, err := buildAPIRequest(context.Background(), operation, map[string]any{}, "")
	require.ErrorContains(t, err, `missing required request body "body"`)
}

func TestBuildAPIRequestEscapesPathAndStringifiesPrimitiveQueryParameters(t *testing.T) {
	operation := &openAPIOperation{
		Method: "DELETE",
		Path:   "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{
			{Name: "memo", In: "path", Required: true, Schema: jsonSchema{"type": "string"}},
			{Name: "force", In: "query", Schema: jsonSchema{"type": "boolean"}},
			{Name: "limit", In: "query", Schema: jsonSchema{"type": "integer"}},
		},
	}

	req, err := buildAPIRequest(context.Background(), operation, map[string]any{
		"memo":  "abc 123",
		"force": true,
		"limit": 10,
	}, "")
	require.NoError(t, err)
	require.Equal(t, "/api/v1/memos/abc%20123", req.URL.EscapedPath())
	require.Equal(t, "true", req.URL.Query().Get("force"))
	require.Equal(t, "10", req.URL.Query().Get("limit"))
}

func TestExecuteOperationReturnsObjectStructuredContent(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		require.Equal(t, "Bearer token", c.Request().Header.Get("Authorization"))
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/abc123"}},
		})
	})

	operation := &openAPIOperation{
		Method: "GET",
		Path:   "/api/v1/memos",
	}
	adapter := newAPIAdapter(echoServer)

	result, err := adapter.execute(context.Background(), operation, map[string]any{}, "Bearer token")
	require.NoError(t, err)
	require.False(t, result.IsError)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/abc123"}},
	}, result.StructuredContent)
}

func TestExecuteOperationConvertsAPIErrorsToToolErrors(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos/:memo", func(c *echo.Context) error {
		return c.JSON(http.StatusNotFound, map[string]any{"message": "missing memo"})
	})

	operation := &openAPIOperation{
		Method:     "GET",
		Path:       "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{{Name: "memo", In: "path", Required: true}},
	}
	adapter := newAPIAdapter(echoServer)

	result, err := adapter.execute(context.Background(), operation, map[string]any{"memo": "missing"}, "")
	require.NoError(t, err)
	require.True(t, result.IsError)
	require.Equal(t, map[string]any{
		"error": map[string]any{
			"message": "404 Not Found: missing memo",
		},
	}, result.StructuredContent)
	text, ok := result.Content[0].(*sdkmcp.TextContent)
	require.True(t, ok)
	require.Contains(t, text.Text, "404")
	require.Contains(t, text.Text, "missing memo")
}

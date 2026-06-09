package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	memosproto "github.com/usememos/memos/proto"
)

func TestIsAllowedMCPOrigin(t *testing.T) {
	profile := &profile.Profile{InstanceURL: "https://memos.example.com/app"}

	tests := []struct {
		name   string
		host   string
		origin string
		want   bool
	}{
		{name: "empty origin", host: "localhost:5230", origin: "", want: true},
		{name: "same http host", host: "localhost:5230", origin: "http://localhost:5230", want: true},
		{name: "same https host", host: "memos.example.com", origin: "https://memos.example.com", want: true},
		{name: "configured instance URL origin", host: "127.0.0.1:5230", origin: "https://memos.example.com", want: true},
		{name: "configured instance URL ignores path", host: "127.0.0.1:5230", origin: "https://memos.example.com", want: true},
		{name: "different host", host: "localhost:5230", origin: "https://evil.example.com", want: false},
		{name: "invalid origin", host: "localhost:5230", origin: "not a url", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, isAllowedMCPOrigin(test.host, test.origin, profile))
		})
	}
}

func TestNewMCPServiceRegistersCuratedTools(t *testing.T) {
	echoServer := echo.New()

	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer)
	require.NoError(t, err)
	require.NotNil(t, service.handler)
	require.Len(t, service.operationsByTool, len(curatedOperationIDs))

	operation := service.operationsByTool["memo_list_memos"]
	require.NotNil(t, operation)
	require.Equal(t, "MemoService_ListMemos", operation.OperationID)
	require.Equal(t, "GET", operation.Method)
	require.Equal(t, "/api/v1/memos", operation.Path)
}

func TestNewMCPServiceUsesEmbeddedOpenAPISpec(t *testing.T) {
	t.Chdir(t.TempDir())

	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echo.New())
	require.NoError(t, err)
	require.NotNil(t, service.handler)
	require.Len(t, service.operationsByTool, len(curatedOperationIDs))
}

func TestEmbeddedOpenAPISpecMatchesGeneratedFile(t *testing.T) {
	generated, err := os.ReadFile("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	require.Equal(t, generated, memosproto.OpenAPIYAML())
}

func TestMCPToolHandlerForwardsArgumentsAndAuthorization(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		require.Equal(t, "Bearer token", c.Request().Header.Get("Authorization"))
		require.Equal(t, "7", c.QueryParam("pageSize"))
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/test"}},
		})
	})

	operation := &registeredOperation{
		Operation: &openAPIOperation{
			Method:     "GET",
			Path:       "/api/v1/memos",
			Parameters: []openAPIParameter{{Name: "pageSize", In: "query", Schema: jsonSchema{"type": "integer"}}},
		},
	}
	handler := newMCPToolHandler(newAPIAdapter(echoServer), operation)
	arguments, err := json.Marshal(map[string]any{"pageSize": 7})
	require.NoError(t, err)

	result, err := handler(context.Background(), &sdkmcp.CallToolRequest{
		Params: &sdkmcp.CallToolParamsRaw{
			Name:      "memo_list_memos",
			Arguments: arguments,
		},
		Extra: &sdkmcp.RequestExtra{
			Header: http.Header{"Authorization": []string{"Bearer token"}},
		},
	})
	require.NoError(t, err)
	require.False(t, result.IsError)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/test"}},
	}, result.StructuredContent)
}

func TestMCPProtocolListsCuratedToolsOnly(t *testing.T) {
	echoServer := echo.New()

	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer)
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)
	response := postMCP(t, echoServer, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
	})

	result, ok := response["result"].(map[string]any)
	require.True(t, ok)
	tools, ok := result["tools"].([]any)
	require.True(t, ok)
	require.Len(t, tools, len(curatedOperationIDs))

	names := map[string]struct{}{}
	for _, rawTool := range tools {
		tool, ok := rawTool.(map[string]any)
		require.True(t, ok)
		name, ok := tool["name"].(string)
		require.True(t, ok)
		names[name] = struct{}{}
		require.Contains(t, tool, "inputSchema")
		require.Contains(t, tool, "outputSchema")
	}
	require.Contains(t, names, "memo_list_memos")
	require.Contains(t, names, "memo_create_memo")
	require.NotContains(t, names, "auth_sign_in")
	require.NotContains(t, names, "user_create_user")
}

func TestMCPToolCallReturnsObjectStructuredContent(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/abc123"}},
		})
	})

	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer)
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)
	response := postMCP(t, echoServer, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "memo_list_memos",
			"arguments": map[string]any{
				"pageSize": 1,
			},
		},
	})

	result, ok := response["result"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/abc123"}},
	}, result["structuredContent"])
}

func TestMCPToolCallRejectsInvalidArguments(t *testing.T) {
	echoServer := echo.New()
	routeHits := 0
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		routeHits++
		return c.JSON(http.StatusOK, map[string]any{"memos": []any{}})
	})
	echoServer.GET("/api/v1/memos/:memo", func(c *echo.Context) error {
		routeHits++
		return c.JSON(http.StatusOK, map[string]any{"name": c.Param("memo")})
	})

	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer)
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)

	tests := []struct {
		name      string
		toolName  string
		arguments map[string]any
		wantError string
	}{
		{
			name:      "unknown argument",
			toolName:  "memo_list_memos",
			arguments: map[string]any{"unexpected": true},
			wantError: `unknown argument "unexpected"`,
		},
		{
			name:      "missing required argument",
			toolName:  "memo_get_memo",
			arguments: map[string]any{},
			wantError: `missing required argument "memo"`,
		},
		{
			name:      "wrong primitive type",
			toolName:  "memo_list_memos",
			arguments: map[string]any{"pageSize": "ten"},
			wantError: `argument "pageSize" must be integer`,
		},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := postMCP(t, echoServer, map[string]any{
				"jsonrpc": "2.0",
				"id":      index + 2,
				"method":  "tools/call",
				"params": map[string]any{
					"name":      test.toolName,
					"arguments": test.arguments,
				},
			})

			result, ok := response["result"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, true, result["isError"])
			structured, ok := result["structuredContent"].(map[string]any)
			require.True(t, ok)
			errorObject, ok := structured["error"].(map[string]any)
			require.True(t, ok)
			require.Contains(t, errorObject["message"], test.wantError)
		})
	}
	require.Zero(t, routeHits)
}

func initializeMCP(t *testing.T, echoServer *echo.Echo) {
	t.Helper()
	response := postMCP(t, echoServer, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities":    map[string]any{},
			"clientInfo": map[string]any{
				"name":    "memos-test",
				"version": "1.0.0",
			},
		},
	})
	require.NotNil(t, response["result"])
}

func postMCP(t *testing.T, echoServer *echo.Echo, payload map[string]any) map[string]any {
	t.Helper()
	data, err := json.Marshal(payload)
	require.NoError(t, err)

	request := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")

	recorder := httptest.NewRecorder()
	echoServer.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var response map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

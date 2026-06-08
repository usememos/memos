package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
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

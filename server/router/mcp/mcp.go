package mcp

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/server/auth"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

const (
	headerMCPReadonly     = "X-MCP-Readonly"
	headerMCPToolsets     = "X-MCP-Toolsets"
	headerMCPTools        = "X-MCP-Tools"
	headerMCPExcludeTools = "X-MCP-Exclude-Tools"
)

type mcpRequestConfigContextKey struct{}

type MCPService struct {
	profile       *profile.Profile
	store         *store.Store
	apiV1Service  *apiv1.APIV1Service
	authenticator *auth.Authenticator
}

func NewMCPService(profile *profile.Profile, store *store.Store, secret string, apiV1Service *apiv1.APIV1Service) *MCPService {
	return &MCPService{
		profile:       profile,
		store:         store,
		apiV1Service:  apiV1Service,
		authenticator: auth.NewAuthenticator(store, secret),
	}
}

func (s *MCPService) RegisterRoutes(echoServer *echo.Echo) {
	mcpSrv := mcpserver.NewMCPServer("Memos", "1.0.0",
		mcpserver.WithToolCapabilities(true),
		mcpserver.WithResourceCapabilities(true, true),
		mcpserver.WithPromptCapabilities(true),
		mcpserver.WithLogging(),
		mcpserver.WithToolFilter(s.filterTools),
		mcpserver.WithToolHandlerMiddleware(s.enforceToolAccess),
		mcpserver.WithRecovery(),
		mcpserver.WithResourceRecovery(),
	)
	s.registerMemoTools(mcpSrv)
	s.registerTagTools(mcpSrv)
	s.registerAttachmentTools(mcpSrv)
	s.registerRelationTools(mcpSrv)
	s.registerReactionTools(mcpSrv)
	s.registerMemoResources(mcpSrv)
	s.registerPrompts(mcpSrv)

	httpHandler := mcpserver.NewStreamableHTTPServer(mcpSrv,
		mcpserver.WithHTTPContextFunc(s.withRequestConfig),
	)

	mcpGroup := echoServer.Group("")
	mcpGroup.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if !s.isAllowedOrigin(c.Request()) {
				return c.JSON(http.StatusForbidden, map[string]string{"message": "invalid origin"})
			}
			if origin := c.Request().Header.Get("Origin"); origin != "" {
				headers := c.Response().Header()
				headers.Set("Vary", "Origin")
				headers.Set("Access-Control-Allow-Origin", origin)
				headers.Set("Access-Control-Allow-Headers", strings.Join([]string{
					"Authorization",
					"Content-Type",
					"Accept",
					"Mcp-Session-Id",
					"MCP-Protocol-Version",
					"Last-Event-ID",
					headerMCPReadonly,
					headerMCPToolsets,
					headerMCPTools,
					headerMCPExcludeTools,
				}, ", "))
				headers.Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
				if c.Request().Method == http.MethodOptions {
					return c.NoContent(http.StatusNoContent)
				}
			}

			authHeader := c.Request().Header.Get("Authorization")
			if authHeader != "" {
				result := s.authenticator.Authenticate(c.Request().Context(), authHeader)
				if result == nil {
					return c.JSON(http.StatusUnauthorized, map[string]string{"message": "invalid or expired token"})
				}
				ctx := auth.ApplyToContext(c.Request().Context(), result)
				c.SetRequest(c.Request().WithContext(ctx))
			}
			return next(c)
		}
	})
	mcpGroup.Any("/mcp", echo.WrapHandler(httpHandler))
	mcpGroup.Any("/mcp/readonly", echo.WrapHandler(httpHandler))
	mcpGroup.Any("/mcp/x/:toolsets", echo.WrapHandler(httpHandler))
	mcpGroup.Any("/mcp/x/:toolsets/readonly", echo.WrapHandler(httpHandler))
}

func (*MCPService) withRequestConfig(ctx context.Context, r *http.Request) context.Context {
	return context.WithValue(ctx, mcpRequestConfigContextKey{}, parseMCPRequestConfig(r))
}

func (*MCPService) filterTools(ctx context.Context, tools []mcp.Tool) []mcp.Tool {
	cfg := mcpRequestConfigFromContext(ctx)
	filtered := make([]mcp.Tool, 0, len(tools))
	for _, tool := range tools {
		if cfg.allowsTool(tool.Name) {
			filtered = append(filtered, tool)
		}
	}
	return filtered
}

func (*MCPService) enforceToolAccess(next mcpserver.ToolHandlerFunc) mcpserver.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		cfg := mcpRequestConfigFromContext(ctx)
		if !cfg.allowsTool(req.Params.Name) {
			return mcp.NewToolResultError(fmt.Sprintf("tool %q is not enabled by MCP configuration", req.Params.Name)), nil
		}
		return next(ctx, req)
	}
}

type mcpRequestConfig struct {
	readOnly     bool
	toolsets     map[string]struct{}
	includeTools map[string]struct{}
	excludeTools map[string]struct{}
}

func mcpRequestConfigFromContext(ctx context.Context) mcpRequestConfig {
	if cfg, ok := ctx.Value(mcpRequestConfigContextKey{}).(mcpRequestConfig); ok {
		return cfg
	}
	return mcpRequestConfig{}
}

func parseMCPRequestConfig(r *http.Request) mcpRequestConfig {
	cfg := mcpRequestConfig{}

	pathToolsets, pathReadonly := parseMCPPathConfig(r.URL.Path)
	cfg.readOnly = pathReadonly || parseBoolHeader(r.Header.Get(headerMCPReadonly))
	cfg.toolsets = mergeStringSets(cfg.toolsets, pathToolsets)
	cfg.toolsets = mergeStringSets(cfg.toolsets, parseCommaSet(r.Header.Get(headerMCPToolsets), strings.ToLower))
	cfg.includeTools = parseCommaSet(r.Header.Get(headerMCPTools), keepString)
	cfg.excludeTools = parseCommaSet(r.Header.Get(headerMCPExcludeTools), keepString)
	return cfg
}

func parseMCPPathConfig(path string) (map[string]struct{}, bool) {
	trimmed := strings.Trim(path, "/")
	if trimmed == "mcp/readonly" {
		return nil, true
	}
	const prefix = "mcp/x/"
	if !strings.HasPrefix(trimmed, prefix) {
		return nil, false
	}

	rest := strings.TrimPrefix(trimmed, prefix)
	readOnly := false
	if strings.HasSuffix(rest, "/readonly") {
		readOnly = true
		rest = strings.TrimSuffix(rest, "/readonly")
	}
	return parseCommaSet(rest, strings.ToLower), readOnly
}

func (cfg mcpRequestConfig) allowsTool(name string) bool {
	if _, known := allMCPToolNames[name]; !known {
		return false
	}
	if cfg.readOnly {
		if _, mutates := mcpMutationTools[name]; mutates {
			return false
		}
	}
	if _, excluded := cfg.excludeTools[name]; excluded {
		return false
	}
	if _, included := cfg.includeTools[name]; included {
		return true
	}
	if len(cfg.toolsets) == 0 {
		return true
	}
	for toolset := range cfg.toolsets {
		if _, ok := mcpToolsByToolset[toolset][name]; ok {
			return true
		}
	}
	return false
}

func parseBoolHeader(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "t", "true", "y", "yes", "on":
		return true
	default:
		return false
	}
}

func parseCommaSet(value string, normalize func(string) string) map[string]struct{} {
	if value == "" {
		return nil
	}
	result := map[string]struct{}{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		result[normalize(item)] = struct{}{}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func mergeStringSets(dst map[string]struct{}, src map[string]struct{}) map[string]struct{} {
	if len(src) == 0 {
		return dst
	}
	if dst == nil {
		dst = map[string]struct{}{}
	}
	for item := range src {
		dst[item] = struct{}{}
	}
	return dst
}

func keepString(s string) string {
	return s
}

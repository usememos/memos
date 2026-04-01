package mcp

import (
	"net/http"

	"github.com/labstack/echo/v5"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

type MCPService struct {
	profile       *profile.Profile
	store         *store.Store
	authenticator *auth.Authenticator
}

func NewMCPService(profile *profile.Profile, store *store.Store, secret string) *MCPService {
	return &MCPService{
		profile:       profile,
		store:         store,
		authenticator: auth.NewAuthenticator(store, secret),
	}
}

func (s *MCPService) RegisterRoutes(echoServer *echo.Echo) {
	mcpSrv := mcpserver.NewMCPServer("Memos", "1.0.0",
		mcpserver.WithToolCapabilities(true),
		mcpserver.WithResourceCapabilities(true, true),
		mcpserver.WithPromptCapabilities(true),
		mcpserver.WithLogging(),
	)
	s.registerMemoTools(mcpSrv)
	s.registerTagTools(mcpSrv)
	s.registerAttachmentTools(mcpSrv)
	s.registerRelationTools(mcpSrv)
	s.registerReactionTools(mcpSrv)
	s.registerMemoResources(mcpSrv)
	s.registerPrompts(mcpSrv)

	httpHandler := mcpserver.NewStreamableHTTPServer(mcpSrv)

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
				headers.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID")
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
}

package mcp

import (
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/usememos/memos/store"
)

type MCPService struct {
	store  *store.Store
	secret string
}

func NewMCPService(store *store.Store, secret string) *MCPService {
	return &MCPService{store: store, secret: secret}
}

func (s *MCPService) RegisterRoutes(echoServer *echo.Echo) {
	mcpSrv := mcpserver.NewMCPServer("Memos", "1.0.0", mcpserver.WithToolCapabilities(false))
	s.registerMemoTools(mcpSrv)

	httpHandler := mcpserver.NewStreamableHTTPServer(mcpSrv)

	mcpGroup := echoServer.Group("")
	mcpGroup.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
	}))
	mcpGroup.Use(newAuthMiddleware(s.store, s.secret))
	mcpGroup.Any("/mcp", echo.WrapHandler(httpHandler))
}

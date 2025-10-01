package v1

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/cache"
)

// GetCacheStatus returns the current cache status for monitoring and debugging.
func (s *APIV1Service) GetCacheStatus(ctx context.Context) (*CacheStatusResponse, error) {
	// Check if user is admin
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "only admins can access cache status")
	}

	response := &CacheStatusResponse{
		UserCache:             getCacheInfo(s.Store.GetUserCache()),
		UserSettingCache:      getCacheInfo(s.Store.GetUserSettingCache()),
		WorkspaceSettingCache: getCacheInfo(s.Store.GetWorkspaceSettingCache()),
	}

	return response, nil
}

// getCacheInfo extracts cache information from a cache instance.
func getCacheInfo(c cache.Interface) *CacheInfo {
	info := &CacheInfo{
		Size: c.Size(),
		Type: "local",
	}

	// Check if it's a hybrid cache to get additional info
	if hybrid, ok := c.(*cache.HybridCache); ok {
		info.Type = "hybrid"
		stats := hybrid.GetStats()
		info.RedisAvailable = stats.RedisAvailable
		info.PodId = stats.PodID
		info.LocalSize = stats.LocalSize
		info.RedisSize = stats.RedisSize
		info.EventQueueSize = stats.EventQueueSize
	}

	return info
}

// CacheStatusResponse contains cache status information.
type CacheStatusResponse struct {
	UserCache             *CacheInfo `json:"user_cache"`
	UserSettingCache      *CacheInfo `json:"user_setting_cache"`
	WorkspaceSettingCache *CacheInfo `json:"workspace_setting_cache"`
}

// CacheInfo contains information about a specific cache.
type CacheInfo struct {
	Type             string `json:"type"`              // "local" or "hybrid"
	Size             int64  `json:"size"`              // Total items in cache
	LocalSize        int64  `json:"local_size"`        // Items in local cache (for hybrid)
	RedisSize        int64  `json:"redis_size"`        // Items in Redis (for hybrid)
	RedisAvailable   bool   `json:"redis_available"`   // Whether Redis is available
	PodId            string `json:"pod_id"`            // Unique pod identifier
	EventQueueSize   int64  `json:"event_queue_size"`  // Pending cache events
}

// registerCacheRoutes registers cache-related REST endpoints.
func (s *APIV1Service) registerCacheRoutes(g *echo.Group) {
	g.GET("/cache/status", func(c echo.Context) error {
		ctx := c.Request().Context()
		response, err := s.GetCacheStatus(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, response)
	})
}

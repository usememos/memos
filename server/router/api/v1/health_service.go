package v1

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
)

func (s *APIV1Service) Check(ctx context.Context,
	_ *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	// Check if database is initialized by verifying instance basic setting exists
	instanceBasicSetting, err := s.Store.GetInstanceBasicSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unavailable, "database not initialized: %v", err)
	}

	// Verify schema version is set (empty means database not properly initialized)
	if instanceBasicSetting.SchemaVersion == "" {
		return nil, status.Errorf(codes.Unavailable, "schema version not set")
	}

	return &grpc_health_v1.HealthCheckResponse{Status: grpc_health_v1.HealthCheckResponse_SERVING}, nil
}

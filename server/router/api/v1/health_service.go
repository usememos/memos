package v1

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/store"
)

func (s *APIV1Service) Check(ctx context.Context,
	_ *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	history, err := s.Store.GetDriver().FindMigrationHistoryList(ctx, &store.FindMigrationHistory{})
	if err != nil || len(history) == 0 {
		return nil, status.Errorf(codes.Unavailable, "not available")
	}

	return &grpc_health_v1.HealthCheckResponse{Status: grpc_health_v1.HealthCheckResponse_SERVING}, nil
}

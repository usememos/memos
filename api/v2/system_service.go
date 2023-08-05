package v2

import (
	"context"
	"os"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type SystemService struct {
	apiv2pb.UnimplementedSystemServiceServer

	Profile *profile.Profile
	Store   *store.Store
}

// NewSystemService creates a new SystemService.
func NewSystemService(profile *profile.Profile, store *store.Store) *SystemService {
	return &SystemService{
		Profile: profile,
		Store:   store,
	}
}

func (s *SystemService) GetSystemInfo(ctx context.Context, _ *apiv2pb.GetSystemInfoRequest) (*apiv2pb.GetSystemInfoResponse, error) {
	defaultSystemInfo := &apiv2pb.SystemInfo{}

	// Get the database size if the user is a host.
	userIDPtr := ctx.Value(UserIDContextKey)
	if userIDPtr != nil {
		userID := userIDPtr.(int32)
		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
		}
		if user != nil && user.Role == store.RoleHost {
			fi, err := os.Stat(s.Profile.DSN)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get file info: %v", err)
			}
			defaultSystemInfo.DbSize = fi.Size()
		}
	}

	response := &apiv2pb.GetSystemInfoResponse{
		SystemInfo: defaultSystemInfo,
	}
	return response, nil
}

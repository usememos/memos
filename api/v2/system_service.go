package v2

import (
	"context"
	"os"
	"strconv"

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

func (s *SystemService) UpdateSystemInfo(ctx context.Context, request *apiv2pb.UpdateSystemInfoRequest) (*apiv2pb.UpdateSystemInfoResponse, error) {
	userID := ctx.Value(UserIDContextKey).(int32)
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.UpdateMask == nil || len(request.UpdateMask) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	// Update system settings.
	for _, path := range request.UpdateMask {
		if path == "allow_registration" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "allow-signup",
				Value: strconv.FormatBool(request.SystemInfo.AllowRegistration),
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update allow_registration system setting: %v", err)
			}
		} else if path == "disable_password_login" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "disable-password-login",
				Value: strconv.FormatBool(request.SystemInfo.DisablePasswordLogin),
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update disable_password_login system setting: %v", err)
			}
		} else if path == "additional_script" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "additional-script",
				Value: request.SystemInfo.AdditionalScript,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update additional_script system setting: %v", err)
			}
		} else if path == "additional_style" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "additional-style",
				Value: request.SystemInfo.AdditionalStyle,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update additional_style system setting: %v", err)
			}
		}
	}

	systemInfo, err := s.GetSystemInfo(ctx, &apiv2pb.GetSystemInfoRequest{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get system info: %v", err)
	}
	return &apiv2pb.UpdateSystemInfoResponse{
		SystemInfo: systemInfo.SystemInfo,
	}, nil
}

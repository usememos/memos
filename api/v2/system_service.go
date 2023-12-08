package v2

import (
	"context"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) GetSystemInfo(ctx context.Context, _ *apiv2pb.GetSystemInfoRequest) (*apiv2pb.GetSystemInfoResponse, error) {
	defaultSystemInfo := &apiv2pb.SystemInfo{}

	// Get the database size if the user is a host.
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser != nil && currentUser.Role == store.RoleHost {
		size, err := s.Store.GetCurrentDBSize(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get db size: %v", err)
		}
		defaultSystemInfo.DbSize = size
	}

	response := &apiv2pb.GetSystemInfoResponse{
		SystemInfo: defaultSystemInfo,
	}
	return response, nil
}

func (s *APIV2Service) UpdateSystemInfo(ctx context.Context, request *apiv2pb.UpdateSystemInfoRequest) (*apiv2pb.UpdateSystemInfoResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	// Update system settings.
	for _, field := range request.UpdateMask.Paths {
		if field == "allow_registration" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "allow-signup",
				Value: strconv.FormatBool(request.SystemInfo.AllowRegistration),
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update allow_registration system setting: %v", err)
			}
		} else if field == "disable_password_login" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "disable-password-login",
				Value: strconv.FormatBool(request.SystemInfo.DisablePasswordLogin),
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update disable_password_login system setting: %v", err)
			}
		} else if field == "additional_script" {
			_, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
				Name:  "additional-script",
				Value: request.SystemInfo.AdditionalScript,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update additional_script system setting: %v", err)
			}
		} else if field == "additional_style" {
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

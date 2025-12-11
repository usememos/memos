package v1

import (
	"context"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// This file contains all Connect service handler method implementations.
// Each method delegates to the underlying gRPC service implementation,
// converting between Connect and gRPC request/response types.

// InstanceService

func (s *ConnectServiceHandler) GetInstanceProfile(ctx context.Context, req *connect.Request[v1pb.GetInstanceProfileRequest]) (*connect.Response[v1pb.InstanceProfile], error) {
	resp, err := s.APIV1Service.GetInstanceProfile(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetInstanceSetting(ctx context.Context, req *connect.Request[v1pb.GetInstanceSettingRequest]) (*connect.Response[v1pb.InstanceSetting], error) {
	resp, err := s.APIV1Service.GetInstanceSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateInstanceSetting(ctx context.Context, req *connect.Request[v1pb.UpdateInstanceSettingRequest]) (*connect.Response[v1pb.InstanceSetting], error) {
	resp, err := s.APIV1Service.UpdateInstanceSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AuthService
//
// Auth service methods need special handling for response headers (cookies).
// We use withHeaderCarrier helper to inject a header carrier into the context,
// which allows the service to set headers in a protocol-agnostic way.

func (s *ConnectServiceHandler) GetCurrentSession(ctx context.Context, req *connect.Request[v1pb.GetCurrentSessionRequest]) (*connect.Response[v1pb.GetCurrentSessionResponse], error) {
	return withHeaderCarrier(ctx, func(ctx context.Context) (*v1pb.GetCurrentSessionResponse, error) {
		return s.APIV1Service.GetCurrentSession(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) CreateSession(ctx context.Context, req *connect.Request[v1pb.CreateSessionRequest]) (*connect.Response[v1pb.CreateSessionResponse], error) {
	return withHeaderCarrier(ctx, func(ctx context.Context) (*v1pb.CreateSessionResponse, error) {
		return s.APIV1Service.CreateSession(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) DeleteSession(ctx context.Context, req *connect.Request[v1pb.DeleteSessionRequest]) (*connect.Response[emptypb.Empty], error) {
	return withHeaderCarrier(ctx, func(ctx context.Context) (*emptypb.Empty, error) {
		return s.APIV1Service.DeleteSession(ctx, req.Msg)
	})
}

// UserService

func (s *ConnectServiceHandler) ListUsers(ctx context.Context, req *connect.Request[v1pb.ListUsersRequest]) (*connect.Response[v1pb.ListUsersResponse], error) {
	resp, err := s.APIV1Service.ListUsers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUser(ctx context.Context, req *connect.Request[v1pb.GetUserRequest]) (*connect.Response[v1pb.User], error) {
	resp, err := s.APIV1Service.GetUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateUser(ctx context.Context, req *connect.Request[v1pb.CreateUserRequest]) (*connect.Response[v1pb.User], error) {
	resp, err := s.APIV1Service.CreateUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUser(ctx context.Context, req *connect.Request[v1pb.UpdateUserRequest]) (*connect.Response[v1pb.User], error) {
	resp, err := s.APIV1Service.UpdateUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUser(ctx context.Context, req *connect.Request[v1pb.DeleteUserRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListAllUserStats(ctx context.Context, req *connect.Request[v1pb.ListAllUserStatsRequest]) (*connect.Response[v1pb.ListAllUserStatsResponse], error) {
	resp, err := s.APIV1Service.ListAllUserStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserStats(ctx context.Context, req *connect.Request[v1pb.GetUserStatsRequest]) (*connect.Response[v1pb.UserStats], error) {
	resp, err := s.APIV1Service.GetUserStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserSetting(ctx context.Context, req *connect.Request[v1pb.GetUserSettingRequest]) (*connect.Response[v1pb.UserSetting], error) {
	resp, err := s.APIV1Service.GetUserSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserSetting(ctx context.Context, req *connect.Request[v1pb.UpdateUserSettingRequest]) (*connect.Response[v1pb.UserSetting], error) {
	resp, err := s.APIV1Service.UpdateUserSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserSettings(ctx context.Context, req *connect.Request[v1pb.ListUserSettingsRequest]) (*connect.Response[v1pb.ListUserSettingsResponse], error) {
	resp, err := s.APIV1Service.ListUserSettings(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserAccessTokens(ctx context.Context, req *connect.Request[v1pb.ListUserAccessTokensRequest]) (*connect.Response[v1pb.ListUserAccessTokensResponse], error) {
	resp, err := s.APIV1Service.ListUserAccessTokens(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateUserAccessToken(ctx context.Context, req *connect.Request[v1pb.CreateUserAccessTokenRequest]) (*connect.Response[v1pb.UserAccessToken], error) {
	resp, err := s.APIV1Service.CreateUserAccessToken(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUserAccessToken(ctx context.Context, req *connect.Request[v1pb.DeleteUserAccessTokenRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteUserAccessToken(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserSessions(ctx context.Context, req *connect.Request[v1pb.ListUserSessionsRequest]) (*connect.Response[v1pb.ListUserSessionsResponse], error) {
	resp, err := s.APIV1Service.ListUserSessions(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) RevokeUserSession(ctx context.Context, req *connect.Request[v1pb.RevokeUserSessionRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.RevokeUserSession(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserWebhooks(ctx context.Context, req *connect.Request[v1pb.ListUserWebhooksRequest]) (*connect.Response[v1pb.ListUserWebhooksResponse], error) {
	resp, err := s.APIV1Service.ListUserWebhooks(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateUserWebhook(ctx context.Context, req *connect.Request[v1pb.CreateUserWebhookRequest]) (*connect.Response[v1pb.UserWebhook], error) {
	resp, err := s.APIV1Service.CreateUserWebhook(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserWebhook(ctx context.Context, req *connect.Request[v1pb.UpdateUserWebhookRequest]) (*connect.Response[v1pb.UserWebhook], error) {
	resp, err := s.APIV1Service.UpdateUserWebhook(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUserWebhook(ctx context.Context, req *connect.Request[v1pb.DeleteUserWebhookRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteUserWebhook(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserNotifications(ctx context.Context, req *connect.Request[v1pb.ListUserNotificationsRequest]) (*connect.Response[v1pb.ListUserNotificationsResponse], error) {
	resp, err := s.APIV1Service.ListUserNotifications(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserNotification(ctx context.Context, req *connect.Request[v1pb.UpdateUserNotificationRequest]) (*connect.Response[v1pb.UserNotification], error) {
	resp, err := s.APIV1Service.UpdateUserNotification(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUserNotification(ctx context.Context, req *connect.Request[v1pb.DeleteUserNotificationRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteUserNotification(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// MemoService

func (s *ConnectServiceHandler) CreateMemo(ctx context.Context, req *connect.Request[v1pb.CreateMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.CreateMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemos(ctx context.Context, req *connect.Request[v1pb.ListMemosRequest]) (*connect.Response[v1pb.ListMemosResponse], error) {
	resp, err := s.APIV1Service.ListMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetMemo(ctx context.Context, req *connect.Request[v1pb.GetMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.GetMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateMemo(ctx context.Context, req *connect.Request[v1pb.UpdateMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.UpdateMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemo(ctx context.Context, req *connect.Request[v1pb.DeleteMemoRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) SetMemoAttachments(ctx context.Context, req *connect.Request[v1pb.SetMemoAttachmentsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.SetMemoAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoAttachments(ctx context.Context, req *connect.Request[v1pb.ListMemoAttachmentsRequest]) (*connect.Response[v1pb.ListMemoAttachmentsResponse], error) {
	resp, err := s.APIV1Service.ListMemoAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) SetMemoRelations(ctx context.Context, req *connect.Request[v1pb.SetMemoRelationsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.SetMemoRelations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoRelations(ctx context.Context, req *connect.Request[v1pb.ListMemoRelationsRequest]) (*connect.Response[v1pb.ListMemoRelationsResponse], error) {
	resp, err := s.APIV1Service.ListMemoRelations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateMemoComment(ctx context.Context, req *connect.Request[v1pb.CreateMemoCommentRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.CreateMemoComment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoComments(ctx context.Context, req *connect.Request[v1pb.ListMemoCommentsRequest]) (*connect.Response[v1pb.ListMemoCommentsResponse], error) {
	resp, err := s.APIV1Service.ListMemoComments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoReactions(ctx context.Context, req *connect.Request[v1pb.ListMemoReactionsRequest]) (*connect.Response[v1pb.ListMemoReactionsResponse], error) {
	resp, err := s.APIV1Service.ListMemoReactions(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpsertMemoReaction(ctx context.Context, req *connect.Request[v1pb.UpsertMemoReactionRequest]) (*connect.Response[v1pb.Reaction], error) {
	resp, err := s.APIV1Service.UpsertMemoReaction(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemoReaction(ctx context.Context, req *connect.Request[v1pb.DeleteMemoReactionRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteMemoReaction(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AttachmentService

func (s *ConnectServiceHandler) CreateAttachment(ctx context.Context, req *connect.Request[v1pb.CreateAttachmentRequest]) (*connect.Response[v1pb.Attachment], error) {
	resp, err := s.APIV1Service.CreateAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListAttachments(ctx context.Context, req *connect.Request[v1pb.ListAttachmentsRequest]) (*connect.Response[v1pb.ListAttachmentsResponse], error) {
	resp, err := s.APIV1Service.ListAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetAttachment(ctx context.Context, req *connect.Request[v1pb.GetAttachmentRequest]) (*connect.Response[v1pb.Attachment], error) {
	resp, err := s.APIV1Service.GetAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateAttachment(ctx context.Context, req *connect.Request[v1pb.UpdateAttachmentRequest]) (*connect.Response[v1pb.Attachment], error) {
	resp, err := s.APIV1Service.UpdateAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteAttachment(ctx context.Context, req *connect.Request[v1pb.DeleteAttachmentRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// ShortcutService

func (s *ConnectServiceHandler) ListShortcuts(ctx context.Context, req *connect.Request[v1pb.ListShortcutsRequest]) (*connect.Response[v1pb.ListShortcutsResponse], error) {
	resp, err := s.APIV1Service.ListShortcuts(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetShortcut(ctx context.Context, req *connect.Request[v1pb.GetShortcutRequest]) (*connect.Response[v1pb.Shortcut], error) {
	resp, err := s.APIV1Service.GetShortcut(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateShortcut(ctx context.Context, req *connect.Request[v1pb.CreateShortcutRequest]) (*connect.Response[v1pb.Shortcut], error) {
	resp, err := s.APIV1Service.CreateShortcut(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateShortcut(ctx context.Context, req *connect.Request[v1pb.UpdateShortcutRequest]) (*connect.Response[v1pb.Shortcut], error) {
	resp, err := s.APIV1Service.UpdateShortcut(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteShortcut(ctx context.Context, req *connect.Request[v1pb.DeleteShortcutRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteShortcut(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// ActivityService

func (s *ConnectServiceHandler) ListActivities(ctx context.Context, req *connect.Request[v1pb.ListActivitiesRequest]) (*connect.Response[v1pb.ListActivitiesResponse], error) {
	resp, err := s.APIV1Service.ListActivities(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetActivity(ctx context.Context, req *connect.Request[v1pb.GetActivityRequest]) (*connect.Response[v1pb.Activity], error) {
	resp, err := s.APIV1Service.GetActivity(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// IdentityProviderService

func (s *ConnectServiceHandler) ListIdentityProviders(ctx context.Context, req *connect.Request[v1pb.ListIdentityProvidersRequest]) (*connect.Response[v1pb.ListIdentityProvidersResponse], error) {
	resp, err := s.APIV1Service.ListIdentityProviders(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetIdentityProvider(ctx context.Context, req *connect.Request[v1pb.GetIdentityProviderRequest]) (*connect.Response[v1pb.IdentityProvider], error) {
	resp, err := s.APIV1Service.GetIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateIdentityProvider(ctx context.Context, req *connect.Request[v1pb.CreateIdentityProviderRequest]) (*connect.Response[v1pb.IdentityProvider], error) {
	resp, err := s.APIV1Service.CreateIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateIdentityProvider(ctx context.Context, req *connect.Request[v1pb.UpdateIdentityProviderRequest]) (*connect.Response[v1pb.IdentityProvider], error) {
	resp, err := s.APIV1Service.UpdateIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteIdentityProvider(ctx context.Context, req *connect.Request[v1pb.DeleteIdentityProviderRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

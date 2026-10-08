package api

import (
	"context"

	"connectrpc.com/connect"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/protobuf/types/known/emptypb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

// This file contains all Connect service handler method implementations.
// Each method delegates to the underlying gRPC service implementation,
// converting between Connect and gRPC request/response types.

// InstanceService

func (s *ConnectServiceHandler) GetInstanceProfile(ctx context.Context, req *connect.Request[apipb.GetInstanceProfileRequest]) (*connect.Response[apipb.InstanceProfile], error) {
	resp, err := s.APIService.GetInstanceProfile(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetInstanceSetting(ctx context.Context, req *connect.Request[apipb.GetInstanceSettingRequest]) (*connect.Response[apipb.InstanceSetting], error) {
	resp, err := s.APIService.GetInstanceSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchGetInstanceSettings(ctx context.Context, req *connect.Request[apipb.BatchGetInstanceSettingsRequest]) (*connect.Response[apipb.BatchGetInstanceSettingsResponse], error) {
	resp, err := s.APIService.BatchGetInstanceSettings(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateInstanceSetting(ctx context.Context, req *connect.Request[apipb.UpdateInstanceSettingRequest]) (*connect.Response[apipb.InstanceSetting], error) {
	resp, err := s.APIService.UpdateInstanceSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) TestInstanceEmailSetting(ctx context.Context, req *connect.Request[apipb.TestInstanceEmailSettingRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.TestInstanceEmailSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetInstanceStats(ctx context.Context, req *connect.Request[apipb.GetInstanceStatsRequest]) (*connect.Response[apipb.InstanceStats], error) {
	resp, err := s.APIService.GetInstanceStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AuthService
//
// Auth service methods need special handling for response headers (cookies).
// We use connectWithHeaderCarrier helper to inject a header carrier into the context,
// which allows the service to set headers in a protocol-agnostic way.

func (s *ConnectServiceHandler) GetCurrentUser(ctx context.Context, req *connect.Request[apipb.GetCurrentUserRequest]) (*connect.Response[apipb.GetCurrentUserResponse], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*apipb.GetCurrentUserResponse, error) {
		return s.APIService.GetCurrentUser(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) SignIn(ctx context.Context, req *connect.Request[apipb.SignInRequest]) (*connect.Response[apipb.SignInResponse], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*apipb.SignInResponse, error) {
		return s.APIService.SignIn(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) SignOut(ctx context.Context, req *connect.Request[apipb.SignOutRequest]) (*connect.Response[emptypb.Empty], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*emptypb.Empty, error) {
		return s.APIService.SignOut(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) RefreshToken(ctx context.Context, req *connect.Request[apipb.RefreshTokenRequest]) (*connect.Response[apipb.RefreshTokenResponse], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*apipb.RefreshTokenResponse, error) {
		return s.APIService.RefreshToken(ctx, req.Msg)
	})
}

// UserService

func (s *ConnectServiceHandler) ListUsers(ctx context.Context, req *connect.Request[apipb.ListUsersRequest]) (*connect.Response[apipb.ListUsersResponse], error) {
	resp, err := s.APIService.ListUsers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchGetUsers(ctx context.Context, req *connect.Request[apipb.BatchGetUsersRequest]) (*connect.Response[apipb.BatchGetUsersResponse], error) {
	resp, err := s.APIService.BatchGetUsers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUser(ctx context.Context, req *connect.Request[apipb.GetUserRequest]) (*connect.Response[apipb.User], error) {
	resp, err := s.APIService.GetUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateUser(ctx context.Context, req *connect.Request[apipb.CreateUserRequest]) (*connect.Response[apipb.User], error) {
	resp, err := s.APIService.CreateUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUser(ctx context.Context, req *connect.Request[apipb.UpdateUserRequest]) (*connect.Response[apipb.User], error) {
	resp, err := s.APIService.UpdateUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUser(ctx context.Context, req *connect.Request[apipb.DeleteUserRequest]) (*connect.Response[emptypb.Empty], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*emptypb.Empty, error) {
		return s.APIService.DeleteUser(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) ListUserStats(ctx context.Context, req *connect.Request[apipb.ListUserStatsRequest]) (*connect.Response[apipb.ListUserStatsResponse], error) {
	resp, err := s.APIService.ListUserStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserStats(ctx context.Context, req *connect.Request[apipb.GetUserStatsRequest]) (*connect.Response[apipb.UserStats], error) {
	resp, err := s.APIService.GetUserStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ExportMemos(ctx context.Context, req *connect.Request[apipb.ExportMemosRequest]) (*connect.Response[httpbody.HttpBody], error) {
	resp, err := s.APIService.ExportMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ImportMemos(ctx context.Context, req *connect.Request[apipb.ImportMemosRequest]) (*connect.Response[apipb.ImportMemosResponse], error) {
	resp, err := s.APIService.ImportMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserSetting(ctx context.Context, req *connect.Request[apipb.GetUserSettingRequest]) (*connect.Response[apipb.UserSetting], error) {
	resp, err := s.APIService.GetUserSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserSetting(ctx context.Context, req *connect.Request[apipb.UpdateUserSettingRequest]) (*connect.Response[apipb.UserSetting], error) {
	resp, err := s.APIService.UpdateUserSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserSettings(ctx context.Context, req *connect.Request[apipb.ListUserSettingsRequest]) (*connect.Response[apipb.ListUserSettingsResponse], error) {
	resp, err := s.APIService.ListUserSettings(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListLinkedIdentities(ctx context.Context, req *connect.Request[apipb.ListLinkedIdentitiesRequest]) (*connect.Response[apipb.ListLinkedIdentitiesResponse], error) {
	resp, err := s.APIService.ListLinkedIdentities(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateLinkedIdentity(ctx context.Context, req *connect.Request[apipb.CreateLinkedIdentityRequest]) (*connect.Response[apipb.LinkedIdentity], error) {
	resp, err := s.APIService.CreateLinkedIdentity(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetLinkedIdentity(ctx context.Context, req *connect.Request[apipb.GetLinkedIdentityRequest]) (*connect.Response[apipb.LinkedIdentity], error) {
	resp, err := s.APIService.GetLinkedIdentity(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteLinkedIdentity(ctx context.Context, req *connect.Request[apipb.DeleteLinkedIdentityRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteLinkedIdentity(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListPersonalAccessTokens(ctx context.Context, req *connect.Request[apipb.ListPersonalAccessTokensRequest]) (*connect.Response[apipb.ListPersonalAccessTokensResponse], error) {
	resp, err := s.APIService.ListPersonalAccessTokens(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreatePersonalAccessToken(ctx context.Context, req *connect.Request[apipb.CreatePersonalAccessTokenRequest]) (*connect.Response[apipb.CreatePersonalAccessTokenResponse], error) {
	resp, err := s.APIService.CreatePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeletePersonalAccessToken(ctx context.Context, req *connect.Request[apipb.DeletePersonalAccessTokenRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeletePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserWebhooks(ctx context.Context, req *connect.Request[apipb.ListUserWebhooksRequest]) (*connect.Response[apipb.ListUserWebhooksResponse], error) {
	resp, err := s.APIService.ListUserWebhooks(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateUserWebhook(ctx context.Context, req *connect.Request[apipb.CreateUserWebhookRequest]) (*connect.Response[apipb.UserWebhook], error) {
	resp, err := s.APIService.CreateUserWebhook(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserWebhook(ctx context.Context, req *connect.Request[apipb.UpdateUserWebhookRequest]) (*connect.Response[apipb.UserWebhook], error) {
	resp, err := s.APIService.UpdateUserWebhook(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUserWebhook(ctx context.Context, req *connect.Request[apipb.DeleteUserWebhookRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteUserWebhook(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserWebhookSigningSecret(ctx context.Context, req *connect.Request[apipb.GetUserWebhookSigningSecretRequest]) (*connect.Response[apipb.GetUserWebhookSigningSecretResponse], error) {
	resp, err := s.APIService.GetUserWebhookSigningSecret(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserNotifications(ctx context.Context, req *connect.Request[apipb.ListUserNotificationsRequest]) (*connect.Response[apipb.ListUserNotificationsResponse], error) {
	resp, err := s.APIService.ListUserNotifications(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserNotification(ctx context.Context, req *connect.Request[apipb.UpdateUserNotificationRequest]) (*connect.Response[apipb.UserNotification], error) {
	resp, err := s.APIService.UpdateUserNotification(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUserNotification(ctx context.Context, req *connect.Request[apipb.DeleteUserNotificationRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteUserNotification(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// ListMemoViews lists the saved memo views owned by a user.
func (s *ConnectServiceHandler) ListMemoViews(ctx context.Context, req *connect.Request[apipb.ListMemoViewsRequest]) (*connect.Response[apipb.ListMemoViewsResponse], error) {
	resp, err := s.APIService.ListMemoViews(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// GetMemoView returns a saved memo view by resource name.
func (s *ConnectServiceHandler) GetMemoView(ctx context.Context, req *connect.Request[apipb.GetMemoViewRequest]) (*connect.Response[apipb.MemoView], error) {
	resp, err := s.APIService.GetMemoView(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// CreateMemoView creates a saved memo view for a user.
func (s *ConnectServiceHandler) CreateMemoView(ctx context.Context, req *connect.Request[apipb.CreateMemoViewRequest]) (*connect.Response[apipb.MemoView], error) {
	resp, err := s.APIService.CreateMemoView(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// UpdateMemoView updates the selected fields of a saved memo view.
func (s *ConnectServiceHandler) UpdateMemoView(ctx context.Context, req *connect.Request[apipb.UpdateMemoViewRequest]) (*connect.Response[apipb.MemoView], error) {
	resp, err := s.APIService.UpdateMemoView(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// DeleteMemoView deletes a saved memo view by resource name.
func (s *ConnectServiceHandler) DeleteMemoView(ctx context.Context, req *connect.Request[apipb.DeleteMemoViewRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteMemoView(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// MemoService

func (s *ConnectServiceHandler) CreateMemo(ctx context.Context, req *connect.Request[apipb.CreateMemoRequest]) (*connect.Response[apipb.Memo], error) {
	resp, err := s.APIService.CreateMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemos(ctx context.Context, req *connect.Request[apipb.ListMemosRequest]) (*connect.Response[apipb.ListMemosResponse], error) {
	resp, err := s.APIService.ListMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetMemo(ctx context.Context, req *connect.Request[apipb.GetMemoRequest]) (*connect.Response[apipb.Memo], error) {
	resp, err := s.APIService.GetMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateMemo(ctx context.Context, req *connect.Request[apipb.UpdateMemoRequest]) (*connect.Response[apipb.Memo], error) {
	resp, err := s.APIService.UpdateMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemo(ctx context.Context, req *connect.Request[apipb.DeleteMemoRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) SetMemoAttachments(ctx context.Context, req *connect.Request[apipb.SetMemoAttachmentsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.SetMemoAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoAttachments(ctx context.Context, req *connect.Request[apipb.ListMemoAttachmentsRequest]) (*connect.Response[apipb.ListMemoAttachmentsResponse], error) {
	resp, err := s.APIService.ListMemoAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) SetMemoRelations(ctx context.Context, req *connect.Request[apipb.SetMemoRelationsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.SetMemoRelations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoRelations(ctx context.Context, req *connect.Request[apipb.ListMemoRelationsRequest]) (*connect.Response[apipb.ListMemoRelationsResponse], error) {
	resp, err := s.APIService.ListMemoRelations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateMemoComment(ctx context.Context, req *connect.Request[apipb.CreateMemoCommentRequest]) (*connect.Response[apipb.Memo], error) {
	resp, err := s.APIService.CreateMemoComment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoComments(ctx context.Context, req *connect.Request[apipb.ListMemoCommentsRequest]) (*connect.Response[apipb.ListMemoCommentsResponse], error) {
	resp, err := s.APIService.ListMemoComments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoReactions(ctx context.Context, req *connect.Request[apipb.ListMemoReactionsRequest]) (*connect.Response[apipb.ListMemoReactionsResponse], error) {
	resp, err := s.APIService.ListMemoReactions(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpsertMemoReaction(ctx context.Context, req *connect.Request[apipb.UpsertMemoReactionRequest]) (*connect.Response[apipb.Reaction], error) {
	resp, err := s.APIService.UpsertMemoReaction(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemoReaction(ctx context.Context, req *connect.Request[apipb.DeleteMemoReactionRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteMemoReaction(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateMemoShare(ctx context.Context, req *connect.Request[apipb.CreateMemoShareRequest]) (*connect.Response[apipb.MemoShare], error) {
	resp, err := s.APIService.CreateMemoShare(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoShares(ctx context.Context, req *connect.Request[apipb.ListMemoSharesRequest]) (*connect.Response[apipb.ListMemoSharesResponse], error) {
	resp, err := s.APIService.ListMemoShares(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemoShare(ctx context.Context, req *connect.Request[apipb.DeleteMemoShareRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteMemoShare(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSharedMemo(ctx context.Context, req *connect.Request[apipb.GetSharedMemoRequest]) (*connect.Response[apipb.Memo], error) {
	resp, err := s.APIService.GetSharedMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetLinkMetadata(ctx context.Context, req *connect.Request[apipb.GetLinkMetadataRequest]) (*connect.Response[apipb.LinkMetadata], error) {
	resp, err := s.APIService.GetLinkMetadata(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchGetLinkMetadata(ctx context.Context, req *connect.Request[apipb.BatchGetLinkMetadataRequest]) (*connect.Response[apipb.BatchGetLinkMetadataResponse], error) {
	resp, err := s.APIService.BatchGetLinkMetadata(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// SpaceService

func (s *ConnectServiceHandler) CreateSpace(ctx context.Context, req *connect.Request[apipb.CreateSpaceRequest]) (*connect.Response[apipb.Space], error) {
	resp, err := s.APIService.CreateSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListSpaces(ctx context.Context, req *connect.Request[apipb.ListSpacesRequest]) (*connect.Response[apipb.ListSpacesResponse], error) {
	resp, err := s.APIService.ListSpaces(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSpace(ctx context.Context, req *connect.Request[apipb.GetSpaceRequest]) (*connect.Response[apipb.Space], error) {
	resp, err := s.APIService.GetSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateSpace(ctx context.Context, req *connect.Request[apipb.UpdateSpaceRequest]) (*connect.Response[apipb.Space], error) {
	resp, err := s.APIService.UpdateSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteSpace(ctx context.Context, req *connect.Request[apipb.DeleteSpaceRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateSpaceInvitation(ctx context.Context, req *connect.Request[apipb.CreateSpaceInvitationRequest]) (*connect.Response[apipb.SpaceInvitation], error) {
	resp, err := s.APIService.CreateSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListSpaceInvitations(ctx context.Context, req *connect.Request[apipb.ListSpaceInvitationsRequest]) (*connect.Response[apipb.ListSpaceInvitationsResponse], error) {
	resp, err := s.APIService.ListSpaceInvitations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserSpaceInvitations(ctx context.Context, req *connect.Request[apipb.ListUserSpaceInvitationsRequest]) (*connect.Response[apipb.ListUserSpaceInvitationsResponse], error) {
	resp, err := s.APIService.ListUserSpaceInvitations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSpaceInvitation(ctx context.Context, req *connect.Request[apipb.GetSpaceInvitationRequest]) (*connect.Response[apipb.SpaceInvitation], error) {
	resp, err := s.APIService.GetSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteSpaceInvitation(ctx context.Context, req *connect.Request[apipb.DeleteSpaceInvitationRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) AcceptSpaceInvitation(ctx context.Context, req *connect.Request[apipb.AcceptSpaceInvitationRequest]) (*connect.Response[apipb.SpaceMember], error) {
	resp, err := s.APIService.AcceptSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeclineSpaceInvitation(ctx context.Context, req *connect.Request[apipb.DeclineSpaceInvitationRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeclineSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListSpaceMembers(ctx context.Context, req *connect.Request[apipb.ListSpaceMembersRequest]) (*connect.Response[apipb.ListSpaceMembersResponse], error) {
	resp, err := s.APIService.ListSpaceMembers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSpaceMember(ctx context.Context, req *connect.Request[apipb.GetSpaceMemberRequest]) (*connect.Response[apipb.SpaceMember], error) {
	resp, err := s.APIService.GetSpaceMember(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateSpaceMember(ctx context.Context, req *connect.Request[apipb.UpdateSpaceMemberRequest]) (*connect.Response[apipb.SpaceMember], error) {
	resp, err := s.APIService.UpdateSpaceMember(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteSpaceMember(ctx context.Context, req *connect.Request[apipb.DeleteSpaceMemberRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteSpaceMember(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AttachmentService

func (s *ConnectServiceHandler) UploadAttachment(ctx context.Context, req *connect.Request[apipb.UploadAttachmentRequest]) (*connect.Response[apipb.UploadAttachmentResponse], error) {
	resp, err := s.APIService.UploadAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateAttachment(ctx context.Context, req *connect.Request[apipb.CreateAttachmentRequest]) (*connect.Response[apipb.Attachment], error) {
	resp, err := s.APIService.CreateAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListAttachments(ctx context.Context, req *connect.Request[apipb.ListAttachmentsRequest]) (*connect.Response[apipb.ListAttachmentsResponse], error) {
	resp, err := s.APIService.ListAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetAttachment(ctx context.Context, req *connect.Request[apipb.GetAttachmentRequest]) (*connect.Response[apipb.Attachment], error) {
	resp, err := s.APIService.GetAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateAttachment(ctx context.Context, req *connect.Request[apipb.UpdateAttachmentRequest]) (*connect.Response[apipb.Attachment], error) {
	resp, err := s.APIService.UpdateAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteAttachment(ctx context.Context, req *connect.Request[apipb.DeleteAttachmentRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchDeleteAttachments(ctx context.Context, req *connect.Request[apipb.BatchDeleteAttachmentsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.BatchDeleteAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AIService

func (s *ConnectServiceHandler) Transcribe(ctx context.Context, req *connect.Request[apipb.TranscribeRequest]) (*connect.Response[apipb.TranscribeResponse], error) {
	resp, err := s.APIService.Transcribe(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// IdentityProviderService

func (s *ConnectServiceHandler) ListIdentityProviders(ctx context.Context, req *connect.Request[apipb.ListIdentityProvidersRequest]) (*connect.Response[apipb.ListIdentityProvidersResponse], error) {
	resp, err := s.APIService.ListIdentityProviders(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetIdentityProvider(ctx context.Context, req *connect.Request[apipb.GetIdentityProviderRequest]) (*connect.Response[apipb.IdentityProvider], error) {
	resp, err := s.APIService.GetIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateIdentityProvider(ctx context.Context, req *connect.Request[apipb.CreateIdentityProviderRequest]) (*connect.Response[apipb.IdentityProvider], error) {
	resp, err := s.APIService.CreateIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateIdentityProvider(ctx context.Context, req *connect.Request[apipb.UpdateIdentityProviderRequest]) (*connect.Response[apipb.IdentityProvider], error) {
	resp, err := s.APIService.UpdateIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteIdentityProvider(ctx context.Context, req *connect.Request[apipb.DeleteIdentityProviderRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteIdentityProvider(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

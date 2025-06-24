package v1

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func (s *APIV1Service) CreateWebhook(ctx context.Context, request *v1pb.CreateWebhookRequest) (*v1pb.Webhook, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Extract user ID from parent (format: users/{user})
	parentUserID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}

	// Users can only create webhooks for themselves
	if parentUserID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Only host users can create webhooks
	if !isSuperUser(currentUser) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Validate required fields
	if request.Webhook == nil {
		return nil, status.Errorf(codes.InvalidArgument, "webhook is required")
	}
	if strings.TrimSpace(request.Webhook.Url) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "webhook URL is required")
	}

	// Handle validate_only field
	if request.ValidateOnly {
		// Perform validation checks without actually creating the webhook
		return &v1pb.Webhook{
			Name:        fmt.Sprintf("users/%d/webhooks/validate", currentUser.ID),
			DisplayName: request.Webhook.DisplayName,
			Url:         request.Webhook.Url,
		}, nil
	}

	err = s.Store.AddUserWebhook(ctx, currentUser.ID, &storepb.WebhooksUserSetting_Webhook{
		Id:    generateWebhookID(),
		Title: request.Webhook.DisplayName,
		Url:   strings.TrimSpace(request.Webhook.Url),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create webhook, error: %+v", err)
	}

	// Return the newly created webhook
	webhooks, err := s.Store.GetUserWebhooks(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks, error: %+v", err)
	}

	// Find the webhook we just created
	for _, webhook := range webhooks {
		if webhook.Title == request.Webhook.DisplayName && webhook.Url == strings.TrimSpace(request.Webhook.Url) {
			return convertWebhookFromUserSetting(webhook, currentUser.ID), nil
		}
	}

	return nil, status.Errorf(codes.Internal, "failed to find created webhook")
}

func (s *APIV1Service) ListWebhooks(ctx context.Context, request *v1pb.ListWebhooksRequest) (*v1pb.ListWebhooksResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Extract user ID from parent (format: users/{user})
	parentUserID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}

	// Users can only list their own webhooks
	if parentUserID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	webhooks, err := s.Store.GetUserWebhooks(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list webhooks, error: %+v", err)
	}

	response := &v1pb.ListWebhooksResponse{
		Webhooks: []*v1pb.Webhook{},
	}
	for _, webhook := range webhooks {
		response.Webhooks = append(response.Webhooks, convertWebhookFromUserSetting(webhook, currentUser.ID))
	}
	return response, nil
}

func (s *APIV1Service) GetWebhook(ctx context.Context, request *v1pb.GetWebhookRequest) (*v1pb.Webhook, error) {
	// Extract user ID and webhook ID from name (format: users/{user}/webhooks/{webhook})
	tokens, err := GetNameParentTokens(request.Name, UserNamePrefix, WebhookNamePrefix)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}
	if len(tokens) != 2 {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name format")
	}

	userIDStr := tokens[0]
	webhookID := tokens[1]

	requestedUserID, err := util.ConvertStringToInt32(userIDStr)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user ID in webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Users can only access their own webhooks
	if requestedUserID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	webhooks, err := s.Store.GetUserWebhooks(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhooks, error: %+v", err)
	}

	// Find webhook by ID
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			return convertWebhookFromUserSetting(webhook, currentUser.ID), nil
		}
	}
	return nil, status.Errorf(codes.NotFound, "webhook not found")
}

func (s *APIV1Service) UpdateWebhook(ctx context.Context, request *v1pb.UpdateWebhookRequest) (*v1pb.Webhook, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	// Extract user ID and webhook ID from name (format: users/{user}/webhooks/{webhook})
	tokens, err := GetNameParentTokens(request.Webhook.Name, UserNamePrefix, WebhookNamePrefix)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}
	if len(tokens) != 2 {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name format")
	}

	userIDStr := tokens[0]
	webhookID := tokens[1]

	requestedUserID, err := util.ConvertStringToInt32(userIDStr)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user ID in webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Users can only update their own webhooks
	if requestedUserID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Get existing webhooks from user settings
	webhooks, err := s.Store.GetUserWebhooks(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhooks: %v", err)
	}

	// Find the webhook to update
	var existingWebhook *storepb.WebhooksUserSetting_Webhook
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			existingWebhook = webhook
			break
		}
	}

	if existingWebhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	// Create updated webhook
	updatedWebhook := &storepb.WebhooksUserSetting_Webhook{
		Id:    existingWebhook.Id,
		Title: existingWebhook.Title,
		Url:   existingWebhook.Url,
	}

	// Apply updates based on update mask
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "display_name":
			updatedWebhook.Title = request.Webhook.DisplayName
		case "url":
			updatedWebhook.Url = request.Webhook.Url
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	// Update the webhook in user settings
	err = s.Store.UpdateUserWebhook(ctx, currentUser.ID, updatedWebhook)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update webhook: %v", err)
	}

	return convertWebhookFromUserSetting(updatedWebhook, currentUser.ID), nil
}

func (s *APIV1Service) DeleteWebhook(ctx context.Context, request *v1pb.DeleteWebhookRequest) (*emptypb.Empty, error) {
	// Extract user ID and webhook ID from name (format: users/{user}/webhooks/{webhook})
	tokens, err := GetNameParentTokens(request.Name, UserNamePrefix, WebhookNamePrefix)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}
	if len(tokens) != 2 {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name format")
	}

	userIDStr := tokens[0]
	webhookID := tokens[1]

	requestedUserID, err := util.ConvertStringToInt32(userIDStr)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user ID in webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Users can only delete their own webhooks
	if requestedUserID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Get existing webhooks from user settings to verify it exists
	webhooks, err := s.Store.GetUserWebhooks(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhooks: %v", err)
	}

	// Check if webhook exists
	webhookExists := false
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			webhookExists = true
			break
		}
	}

	if !webhookExists {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	err = s.Store.RemoveUserWebhook(ctx, currentUser.ID, webhookID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete webhook: %v", err)
	}
	return &emptypb.Empty{}, nil
}

func convertWebhookFromUserSetting(webhook *storepb.WebhooksUserSetting_Webhook, userID int32) *v1pb.Webhook {
	return &v1pb.Webhook{
		Name:        fmt.Sprintf("users/%d/webhooks/%s", userID, webhook.Id),
		DisplayName: webhook.Title,
		Url:         webhook.Url,
	}
}

func generateWebhookID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

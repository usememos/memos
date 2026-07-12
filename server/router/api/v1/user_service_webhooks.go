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

	"github.com/usememos/memos/internal/webhook"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListUserWebhooks(ctx context.Context, request *v1pb.ListUserWebhooksRequest) (*v1pb.ListUserWebhooksResponse, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	userWebhooks := make([]*v1pb.UserWebhook, 0, len(webhooks))
	for _, webhook := range webhooks {
		userWebhooks = append(userWebhooks, convertUserWebhookFromUserSetting(webhook, user))
	}

	return &v1pb.ListUserWebhooksResponse{
		Webhooks: userWebhooks,
	}, nil
}

func (s *APIV1Service) CreateUserWebhook(ctx context.Context, request *v1pb.CreateUserWebhookRequest) (*v1pb.UserWebhook, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.Webhook.Url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "webhook URL is required")
	}
	if err := webhook.ValidateURL(strings.TrimSpace(request.Webhook.Url)); err != nil {
		return nil, err
	}
	// The signing secret is generated server-side so it always meets the Standard
	// Webhooks length requirement. A client-supplied secret is still accepted (and
	// validated) for backward compatibility.
	signingSecret := strings.TrimSpace(request.Webhook.SigningSecret)
	if signingSecret == "" {
		signingSecret, err = webhook.GenerateSigningSecret()
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate signing secret: %v", err)
		}
	} else if err := webhook.ValidateSigningSecret(signingSecret); err != nil {
		return nil, err
	}

	webhookID := generateUserWebhookID()
	webhook := &storepb.WebhooksUserSetting_Webhook{
		Id:            webhookID,
		Title:         request.Webhook.DisplayName,
		Url:           strings.TrimSpace(request.Webhook.Url),
		SigningSecret: signingSecret,
	}

	err = s.Store.AddUserWebhook(ctx, userID, webhook)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create webhook: %v", err)
	}

	return convertUserWebhookFromUserSetting(webhook, user), nil
}

func (s *APIV1Service) UpdateUserWebhook(ctx context.Context, request *v1pb.UpdateUserWebhookRequest) (*v1pb.UserWebhook, error) {
	if request.Webhook == nil {
		return nil, status.Errorf(codes.InvalidArgument, "webhook is required")
	}

	user, webhookID, err := s.resolveUserAndWebhookIDFromName(ctx, request.Webhook.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Get existing webhooks
	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	// Find the webhook to update
	var targetWebhook *storepb.WebhooksUserSetting_Webhook
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			targetWebhook = webhook
			break
		}
	}

	if targetWebhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	// Update the webhook
	updatedWebhook := &storepb.WebhooksUserSetting_Webhook{
		Id:            webhookID,
		Title:         targetWebhook.Title,
		Url:           targetWebhook.Url,
		SigningSecret: targetWebhook.SigningSecret,
	}

	if request.UpdateMask != nil {
		for _, path := range request.UpdateMask.Paths {
			switch path {
			case "url":
				if request.Webhook.Url != "" {
					trimmed := strings.TrimSpace(request.Webhook.Url)
					if err := webhook.ValidateURL(trimmed); err != nil {
						return nil, err
					}
					updatedWebhook.Url = trimmed
				}
			case "display_name":
				updatedWebhook.Title = request.Webhook.DisplayName
			case "signing_secret":
				secret := strings.TrimSpace(request.Webhook.SigningSecret)
				if err := webhook.ValidateSigningSecret(secret); err != nil {
					return nil, err
				}
				updatedWebhook.SigningSecret = secret
			default:
				// Ignore unsupported fields
			}
		}
	} else {
		// If no update mask is provided, update all fields
		if request.Webhook.Url != "" {
			trimmed := strings.TrimSpace(request.Webhook.Url)
			if err := webhook.ValidateURL(trimmed); err != nil {
				return nil, err
			}
			updatedWebhook.Url = trimmed
		}
		updatedWebhook.Title = request.Webhook.DisplayName
		if request.Webhook.SigningSecret != "" {
			secret := strings.TrimSpace(request.Webhook.SigningSecret)
			if err := webhook.ValidateSigningSecret(secret); err != nil {
				return nil, err
			}
			updatedWebhook.SigningSecret = secret
		}
	}

	err = s.Store.UpdateUserWebhook(ctx, userID, updatedWebhook)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update webhook: %v", err)
	}

	return convertUserWebhookFromUserSetting(updatedWebhook, user), nil
}

func (s *APIV1Service) DeleteUserWebhook(ctx context.Context, request *v1pb.DeleteUserWebhookRequest) (*emptypb.Empty, error) {
	user, webhookID, err := s.resolveUserAndWebhookIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Get existing webhooks to verify the webhook exists
	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	// Check if webhook exists
	found := false
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			found = true
			break
		}
	}

	if !found {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	err = s.Store.RemoveUserWebhook(ctx, userID, webhookID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete webhook: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// GetUserWebhookSigningSecret reveals the signing secret for a single webhook.
// This is the only endpoint that returns the secret value; it is gated to the
// webhook owner (or an admin) and the secret is never included in list/create/update responses.
func (s *APIV1Service) GetUserWebhookSigningSecret(ctx context.Context, request *v1pb.GetUserWebhookSigningSecretRequest) (*v1pb.GetUserWebhookSigningSecretResponse, error) {
	user, webhookID, err := s.resolveUserAndWebhookIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}
	userID := user.ID

	if _, err := s.authorizeUserResourceAccess(ctx, userID, true); err != nil {
		return nil, err
	}

	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			return &v1pb.GetUserWebhookSigningSecretResponse{SigningSecret: webhook.SigningSecret}, nil
		}
	}

	return nil, status.Errorf(codes.NotFound, "webhook not found")
}

// Helper functions for webhook operations

// generateUserWebhookID generates a unique ID for user webhooks.
func generateUserWebhookID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// convertUserWebhookFromUserSetting converts a storepb webhook to a v1pb UserWebhook.
func convertUserWebhookFromUserSetting(webhook *storepb.WebhooksUserSetting_Webhook, user *store.User) *v1pb.UserWebhook {
	return &v1pb.UserWebhook{
		Name:             fmt.Sprintf("%s/webhooks/%s", BuildUserName(user.Username), webhook.Id),
		Url:              webhook.Url,
		DisplayName:      webhook.Title,
		SigningSecretSet: webhook.SigningSecret != "",
		// Note: create_time and update_time are not available in the user setting webhook structure
		// This is a limitation of storing webhooks in user settings vs the dedicated webhook table
	}
}

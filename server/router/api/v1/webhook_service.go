package v1

import (
	"context"
	"crypto/md5"
	"fmt"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateWebhook(ctx context.Context, request *v1pb.CreateWebhookRequest) (*v1pb.Webhook, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
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

	// TODO: Handle webhook_id, validate_only, and request_id fields
	if request.ValidateOnly {
		// Perform validation checks without actually creating the webhook
		return &v1pb.Webhook{
			DisplayName: request.Webhook.DisplayName,
			Url:         request.Webhook.Url,
			Creator:     fmt.Sprintf("users/%d", currentUser.ID),
			State:       request.Webhook.State,
		}, nil
	}

	webhook, err := s.Store.CreateWebhook(ctx, &store.Webhook{
		CreatorID: currentUser.ID,
		Name:      request.Webhook.DisplayName,
		URL:       strings.TrimSpace(request.Webhook.Url),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create webhook, error: %+v", err)
	}
	return convertWebhookFromStore(webhook), nil
}

func (s *APIV1Service) ListWebhooks(ctx context.Context, _ *v1pb.ListWebhooksRequest) (*v1pb.ListWebhooksResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// TODO: Implement proper filtering, ordering, and pagination
	// For now, list webhooks for the current user
	webhooks, err := s.Store.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &currentUser.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list webhooks, error: %+v", err)
	}

	response := &v1pb.ListWebhooksResponse{
		Webhooks:  []*v1pb.Webhook{},
		TotalSize: int32(len(webhooks)),
	}
	for _, webhook := range webhooks {
		response.Webhooks = append(response.Webhooks, convertWebhookFromStore(webhook))
	}
	return response, nil
}

func (s *APIV1Service) GetWebhook(ctx context.Context, request *v1pb.GetWebhookRequest) (*v1pb.Webhook, error) {
	webhookID, err := ExtractWebhookIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	webhook, err := s.Store.GetWebhook(ctx, &store.FindWebhook{
		ID:        &webhookID,
		CreatorID: &currentUser.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhook, error: %+v", err)
	}
	if webhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	webhookPb := convertWebhookFromStore(webhook)

	// TODO: Implement read_mask field filtering

	return webhookPb, nil
}

func (s *APIV1Service) UpdateWebhook(ctx context.Context, request *v1pb.UpdateWebhookRequest) (*v1pb.Webhook, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	webhookID, err := ExtractWebhookIDFromName(request.Webhook.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Check if webhook exists and user has permission
	existingWebhook, err := s.Store.GetWebhook(ctx, &store.FindWebhook{
		ID:        &webhookID,
		CreatorID: &currentUser.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhook: %v", err)
	}
	if existingWebhook == nil {
		if request.AllowMissing {
			// Could create webhook if missing, but for now return not found
			return nil, status.Errorf(codes.NotFound, "webhook not found")
		}
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	update := &store.UpdateWebhook{
		ID: webhookID,
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "display_name":
			update.Name = &request.Webhook.DisplayName
		case "url":
			update.URL = &request.Webhook.Url
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	webhook, err := s.Store.UpdateWebhook(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update webhook, error: %+v", err)
	}
	return convertWebhookFromStore(webhook), nil
}

func (s *APIV1Service) DeleteWebhook(ctx context.Context, request *v1pb.DeleteWebhookRequest) (*emptypb.Empty, error) {
	webhookID, err := ExtractWebhookIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Check if webhook exists and user has permission
	webhook, err := s.Store.GetWebhook(ctx, &store.FindWebhook{
		ID:        &webhookID,
		CreatorID: &currentUser.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhook: %v", err)
	}
	if webhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	// TODO: Handle force field properly

	err = s.Store.DeleteWebhook(ctx, &store.DeleteWebhook{
		ID: webhookID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete webhook, error: %+v", err)
	}
	return &emptypb.Empty{}, nil
}

func convertWebhookFromStore(webhook *store.Webhook) *v1pb.Webhook {
	// Generate etag using MD5 hash of webhook data
	etag := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%d-%d-%s-%s",
		webhook.ID, webhook.UpdatedTs, webhook.Name, webhook.URL))))

	return &v1pb.Webhook{
		Name:        fmt.Sprintf("webhooks/%d", webhook.ID),
		Uid:         fmt.Sprintf("%d", webhook.ID),
		DisplayName: webhook.Name,
		Url:         webhook.URL,
		Creator:     fmt.Sprintf("users/%d", webhook.CreatorID),
		State:       v1pb.State_NORMAL, // Default to NORMAL state for webhooks
		CreateTime:  timestamppb.New(time.Unix(webhook.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(webhook.UpdatedTs, 0)),
		Etag:        etag,
	}
}

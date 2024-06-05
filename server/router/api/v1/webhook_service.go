package v1

import (
	"context"
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

	webhook, err := s.Store.CreateWebhook(ctx, &store.Webhook{
		CreatorID: currentUser.ID,
		Name:      request.Name,
		URL:       request.Url,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create webhook, error: %+v", err)
	}
	return convertWebhookFromStore(webhook), nil
}

func (s *APIV1Service) ListWebhooks(ctx context.Context, request *v1pb.ListWebhooksRequest) (*v1pb.ListWebhooksResponse, error) {
	webhooks, err := s.Store.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &request.CreatorId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list webhooks, error: %+v", err)
	}

	response := &v1pb.ListWebhooksResponse{
		Webhooks: []*v1pb.Webhook{},
	}
	for _, webhook := range webhooks {
		response.Webhooks = append(response.Webhooks, convertWebhookFromStore(webhook))
	}
	return response, nil
}

func (s *APIV1Service) GetWebhook(ctx context.Context, request *v1pb.GetWebhookRequest) (*v1pb.Webhook, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	webhook, err := s.Store.GetWebhook(ctx, &store.FindWebhook{
		ID:        &request.Id,
		CreatorID: &currentUser.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhook, error: %+v", err)
	}
	if webhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}
	return convertWebhookFromStore(webhook), nil
}

func (s *APIV1Service) UpdateWebhook(ctx context.Context, request *v1pb.UpdateWebhookRequest) (*v1pb.Webhook, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	update := &store.UpdateWebhook{}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "row_status":
			rowStatus := store.RowStatus(request.Webhook.RowStatus.String())
			update.RowStatus = &rowStatus
		case "name":
			update.Name = &request.Webhook.Name
		case "url":
			update.URL = &request.Webhook.Url
		}
	}

	webhook, err := s.Store.UpdateWebhook(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update webhook, error: %+v", err)
	}
	return convertWebhookFromStore(webhook), nil
}

func (s *APIV1Service) DeleteWebhook(ctx context.Context, request *v1pb.DeleteWebhookRequest) (*emptypb.Empty, error) {
	err := s.Store.DeleteWebhook(ctx, &store.DeleteWebhook{
		ID: request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete webhook, error: %+v", err)
	}
	return &emptypb.Empty{}, nil
}

func convertWebhookFromStore(webhook *store.Webhook) *v1pb.Webhook {
	return &v1pb.Webhook{
		Id:         webhook.ID,
		CreateTime: timestamppb.New(time.Unix(webhook.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(webhook.UpdatedTs, 0)),
		RowStatus:  convertRowStatusFromStore(webhook.RowStatus),
		CreatorId:  webhook.CreatorID,
		Name:       webhook.Name,
		Url:        webhook.URL,
	}
}

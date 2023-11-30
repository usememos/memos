package v2

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateWebhook(ctx context.Context, request *apiv2pb.CreateWebhookRequest) (*apiv2pb.CreateWebhookResponse, error) {
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	webhook, err := s.Store.CreateWebhook(ctx, &storepb.Webhook{
		CreatorId: currentUser.ID,
		Name:      request.Name,
		Url:       request.Url,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create webhook, error: %+v", err)
	}
	return &apiv2pb.CreateWebhookResponse{
		Webhook: convertWebhookFromStore(webhook),
	}, nil
}

func (s *APIV2Service) ListWebhooks(ctx context.Context, request *apiv2pb.ListWebhooksRequest) (*apiv2pb.ListWebhooksResponse, error) {
	webhooks, err := s.Store.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &request.CreatorId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list webhooks, error: %+v", err)
	}

	response := &apiv2pb.ListWebhooksResponse{
		Webhooks: []*apiv2pb.Webhook{},
	}
	for _, webhook := range webhooks {
		response.Webhooks = append(response.Webhooks, convertWebhookFromStore(webhook))
	}
	return response, nil
}

func (s *APIV2Service) GetWebhook(ctx context.Context, request *apiv2pb.GetWebhookRequest) (*apiv2pb.GetWebhookResponse, error) {
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	webhook, err := s.Store.GetWebhooks(ctx, &store.FindWebhook{
		ID:        &request.Id,
		CreatorID: &currentUser.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get webhook, error: %+v", err)
	}
	if webhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}
	return &apiv2pb.GetWebhookResponse{
		Webhook: convertWebhookFromStore(webhook),
	}, nil
}

func (s *APIV2Service) UpdateWebhook(ctx context.Context, request *apiv2pb.UpdateWebhookRequest) (*apiv2pb.UpdateWebhookResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	update := &store.UpdateWebhook{}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "row_status":
			rowStatus := storepb.RowStatus(storepb.RowStatus_value[request.Webhook.RowStatus.String()])
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
	return &apiv2pb.UpdateWebhookResponse{
		Webhook: convertWebhookFromStore(webhook),
	}, nil
}

func (s *APIV2Service) DeleteWebhook(ctx context.Context, request *apiv2pb.DeleteWebhookRequest) (*apiv2pb.DeleteWebhookResponse, error) {
	err := s.Store.DeleteWebhook(ctx, &store.DeleteWebhook{
		ID: request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete webhook, error: %+v", err)
	}
	return &apiv2pb.DeleteWebhookResponse{}, nil
}

func convertWebhookFromStore(webhook *storepb.Webhook) *apiv2pb.Webhook {
	return &apiv2pb.Webhook{
		Id:          webhook.Id,
		CreatedTime: timestamppb.New(time.Unix(webhook.CreatedTs, 0)),
		UpdatedTime: timestamppb.New(time.Unix(webhook.UpdatedTs, 0)),
		RowStatus:   apiv2pb.RowStatus(webhook.RowStatus),
		CreatorId:   webhook.CreatorId,
		Name:        webhook.Name,
		Url:         webhook.Url,
	}
}

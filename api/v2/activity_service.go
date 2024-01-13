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

func (s *APIV2Service) GetActivity(ctx context.Context, request *apiv2pb.GetActivityRequest) (*apiv2pb.GetActivityResponse, error) {
	activity, err := s.Store.GetActivity(ctx, &store.FindActivity{
		ID: &request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get activity: %v", err)
	}

	activityMessage, err := s.convertActivityFromStore(ctx, activity)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert activity from store: %v", err)
	}
	return &apiv2pb.GetActivityResponse{
		Activity: activityMessage,
	}, nil
}

func (*APIV2Service) convertActivityFromStore(_ context.Context, activity *store.Activity) (*apiv2pb.Activity, error) {
	return &apiv2pb.Activity{
		Id:         activity.ID,
		CreatorId:  activity.CreatorID,
		Type:       activity.Type.String(),
		Level:      activity.Level.String(),
		CreateTime: timestamppb.New(time.Unix(activity.CreatedTs, 0)),
		Payload:    convertActivityPayloadFromStore(activity.Payload),
	}, nil
}

func convertActivityPayloadFromStore(payload *storepb.ActivityPayload) *apiv2pb.ActivityPayload {
	v2Payload := &apiv2pb.ActivityPayload{}
	if payload.MemoComment != nil {
		v2Payload.MemoComment = &apiv2pb.ActivityMemoCommentPayload{
			MemoId:        payload.MemoComment.MemoId,
			RelatedMemoId: payload.MemoComment.RelatedMemoId,
		}
	}
	if payload.VersionUpdate != nil {
		v2Payload.VersionUpdate = &apiv2pb.ActivityVersionUpdatePayload{
			Version: payload.VersionUpdate.Version,
		}
	}
	return v2Payload
}

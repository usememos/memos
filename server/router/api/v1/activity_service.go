package v1

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) GetActivity(ctx context.Context, request *v1pb.GetActivityRequest) (*v1pb.Activity, error) {
	activityID, err := ExtractActivityIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid activity name: %v", err)
	}
	activity, err := s.Store.GetActivity(ctx, &store.FindActivity{
		ID: &activityID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get activity: %v", err)
	}

	activityMessage, err := s.convertActivityFromStore(ctx, activity)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert activity from store: %v", err)
	}
	return activityMessage, nil
}

func (*APIV1Service) convertActivityFromStore(_ context.Context, activity *store.Activity) (*v1pb.Activity, error) {
	return &v1pb.Activity{
		Name:       fmt.Sprintf("%s%d", ActivityNamePrefix, activity.ID),
		CreatorId:  activity.CreatorID,
		Type:       activity.Type.String(),
		Level:      activity.Level.String(),
		CreateTime: timestamppb.New(time.Unix(activity.CreatedTs, 0)),
		Payload:    convertActivityPayloadFromStore(activity.Payload),
	}, nil
}

func convertActivityPayloadFromStore(payload *storepb.ActivityPayload) *v1pb.ActivityPayload {
	v2Payload := &v1pb.ActivityPayload{}
	if payload.MemoComment != nil {
		v2Payload.MemoComment = &v1pb.ActivityMemoCommentPayload{
			MemoId:        payload.MemoComment.MemoId,
			RelatedMemoId: payload.MemoComment.RelatedMemoId,
		}
	}
	if payload.VersionUpdate != nil {
		v2Payload.VersionUpdate = &v1pb.ActivityVersionUpdatePayload{
			Version: payload.VersionUpdate.Version,
		}
	}
	return v2Payload
}

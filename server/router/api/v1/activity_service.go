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

func (s *APIV1Service) ListActivities(ctx context.Context, request *v1pb.ListActivitiesRequest) (*v1pb.ListActivitiesResponse, error) {
	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	} else {
		limit = int(request.PageSize)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	limitPlusOne := limit + 1
	activities, err := s.Store.ListActivities(ctx, &store.FindActivity{
		Limit:  &limitPlusOne,
		Offset: &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list activities: %v", err)
	}

	var activityMessages []*v1pb.Activity
	nextPageToken := ""
	if len(activities) == limitPlusOne {
		activities = activities[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	for _, activity := range activities {
		activityMessage, err := s.convertActivityFromStore(ctx, activity)
		if err != nil {
			// Skip activities that reference deleted memos instead of failing the entire list
			continue
		}
		if activityMessage != nil {
			activityMessages = append(activityMessages, activityMessage)
		}
	}

	return &v1pb.ListActivitiesResponse{
		Activities:    activityMessages,
		NextPageToken: nextPageToken,
	}, nil
}

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
	if activityMessage == nil {
		return nil, status.Errorf(codes.NotFound, "activity references deleted content")
	}
	return activityMessage, nil
}

// convertActivityFromStore converts a storage-layer activity to an API activity.
// This handles the mapping between internal activity representation and the public API,
// including proper type and level conversions.
// Returns nil if the activity references deleted content (to allow graceful skipping).
func (s *APIV1Service) convertActivityFromStore(ctx context.Context, activity *store.Activity) (*v1pb.Activity, error) {
	payload, err := s.convertActivityPayloadFromStore(ctx, activity.Payload)
	if err != nil {
		return nil, err
	}
	// Skip activities that reference deleted memos
	if payload == nil {
		return nil, nil
	}

	// Convert store activity type to proto enum
	var activityType v1pb.Activity_Type
	switch activity.Type {
	case store.ActivityTypeMemoComment:
		activityType = v1pb.Activity_MEMO_COMMENT
	default:
		activityType = v1pb.Activity_TYPE_UNSPECIFIED
	}

	// Convert store activity level to proto enum
	var activityLevel v1pb.Activity_Level
	switch activity.Level {
	case store.ActivityLevelInfo:
		activityLevel = v1pb.Activity_INFO
	default:
		activityLevel = v1pb.Activity_LEVEL_UNSPECIFIED
	}

	return &v1pb.Activity{
		Name:       fmt.Sprintf("%s%d", ActivityNamePrefix, activity.ID),
		Creator:    fmt.Sprintf("%s%d", UserNamePrefix, activity.CreatorID),
		Type:       activityType,
		Level:      activityLevel,
		CreateTime: timestamppb.New(time.Unix(activity.CreatedTs, 0)),
		Payload:    payload,
	}, nil
}

// convertActivityPayloadFromStore converts a storage-layer activity payload to an API payload.
// This resolves references (e.g., memo IDs) to resource names for the API.
// Returns nil if the activity references deleted content (to allow graceful skipping).
func (s *APIV1Service) convertActivityPayloadFromStore(ctx context.Context, payload *storepb.ActivityPayload) (*v1pb.ActivityPayload, error) {
	v2Payload := &v1pb.ActivityPayload{}
	if payload.MemoComment != nil {
		// Fetch the comment memo
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID:             &payload.MemoComment.MemoId,
			ExcludeContent: true,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
		}
		// If the comment memo was deleted, skip this activity gracefully
		if memo == nil {
			return nil, nil
		}

		// Fetch the related memo (the one being commented on)
		relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID:             &payload.MemoComment.RelatedMemoId,
			ExcludeContent: true,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get related memo: %v", err)
		}
		// If the related memo was deleted, skip this activity gracefully
		if relatedMemo == nil {
			return nil, nil
		}

		v2Payload.Payload = &v1pb.ActivityPayload_MemoComment{
			MemoComment: &v1pb.ActivityMemoCommentPayload{
				Memo:        fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID),
				RelatedMemo: fmt.Sprintf("%s%s", MemoNamePrefix, relatedMemo.UID),
			},
		}
	}
	return v2Payload, nil
}

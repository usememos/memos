package v2

import (
	"context"
	"fmt"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) UpsertTag(ctx context.Context, request *apiv2pb.UpsertTagRequest) (*apiv2pb.UpsertTagResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	tag, err := s.Store.UpsertTag(ctx, &store.Tag{
		Name:      request.Name,
		CreatorID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert tag: %v", err)
	}

	t, err := s.convertTagFromStore(ctx, tag)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
	}
	return &apiv2pb.UpsertTagResponse{
		Tag: t,
	}, nil
}

func (s *APIV2Service) ListTags(ctx context.Context, request *apiv2pb.ListTagsRequest) (*apiv2pb.ListTagsResponse, error) {
	username, err := ExtractUsernameFromName(request.Creator)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	tags, err := s.Store.ListTags(ctx, &store.FindTag{
		CreatorID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list tags: %v", err)
	}

	response := &apiv2pb.ListTagsResponse{}
	for _, tag := range tags {
		t, err := s.convertTagFromStore(ctx, tag)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
		}
		response.Tags = append(response.Tags, t)
	}
	return response, nil
}

func (s *APIV2Service) DeleteTag(ctx context.Context, request *apiv2pb.DeleteTagRequest) (*apiv2pb.DeleteTagResponse, error) {
	username, err := ExtractUsernameFromName(request.Tag.Creator)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if err := s.Store.DeleteTag(ctx, &store.DeleteTag{
		Name:      request.Tag.Name,
		CreatorID: user.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete tag: %v", err)
	}

	return &apiv2pb.DeleteTagResponse{}, nil
}

func (s *APIV2Service) convertTagFromStore(ctx context.Context, tag *store.Tag) (*apiv2pb.Tag, error) {
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &tag.CreatorID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	return &apiv2pb.Tag{
		Name:    tag.Name,
		Creator: fmt.Sprintf("%s%s", UserNamePrefix, user.Username),
	}, nil
}

package v1

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// ListPinnedTags lists all pinned tags for the current user.
func (s *APIV1Service) ListPinnedTags(ctx context.Context, _ *v1pb.ListPinnedTagsRequest) (*v1pb.ListPinnedTagsResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	tags, err := s.Store.ListPinnedTags(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list pinned tags: %v", err)
	}

	response := &v1pb.ListPinnedTagsResponse{
		Tags: []*v1pb.Tag{},
	}
	for _, tag := range tags {
		tagMessage, err := s.convertTagFromStore(ctx, tag)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
		}
		response.Tags = append(response.Tags, tagMessage)
	}

	return response, nil
}

// ListTagsWithEmoji lists all tags with emoji for the current user.
func (s *APIV1Service) ListTagsWithEmoji(ctx context.Context, _ *v1pb.ListTagsWithEmojiRequest) (*v1pb.ListTagsWithEmojiResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	tags, err := s.Store.ListTagsWithEmoji(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list emoji tags: %v", err)
	}

	response := &v1pb.ListTagsWithEmojiResponse{
		Tags: []*v1pb.Tag{},
	}
	for _, tag := range tags {
		tagMessage, err := s.convertTagFromStore(ctx, tag)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
		}
		response.Tags = append(response.Tags, tagMessage)
	}

	return response, nil
}

// UpdateTag updates tag metadata (emoji, pinned status, etc.).
func (s *APIV1Service) UpdateTag(ctx context.Context, request *v1pb.UpdateTagRequest) (*v1pb.Tag, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	// Validate tag name
	if request.TagName == "" {
		return nil, status.Errorf(codes.InvalidArgument, "tag name is required")
	}

	// Calculate tag hash
	tagHash := calculateTagHash(request.TagName)

	// Prepare update request
	update := &store.UpdateTag{
		TagHash:   tagHash,
		CreatorID: user.ID,
		TagName:   &request.TagName,
	}

	// Handle emoji update
	if request.Emoji != nil {
		update.Emoji = request.Emoji
	}

	// Handle pinned status update
	if request.Pinned != nil {
		update.UpdatePinned = true
		if *request.Pinned {
			// Pin the tag with current timestamp
			now := time.Now().Unix()
			update.PinnedTs = &now
		} else {
			// Unpin the tag (set to nil)
			update.PinnedTs = nil
		}
	}

	// Update tag in store
	tag, err := s.Store.UpdateTag(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update tag: %v", err)
	}

	// Convert and return
	tagMessage, err := s.convertTagFromStore(ctx, tag)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
	}

	return tagMessage, nil
}

// convertTagFromStore converts a store.Tag to v1pb.Tag
func (s *APIV1Service) convertTagFromStore(ctx context.Context, tag *store.Tag) (*v1pb.Tag, error) {
	creator, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &tag.CreatorID,
	})
	if err != nil {
		return nil, err
	}

	result := &v1pb.Tag{
		Id:         tag.ID,
		CreateTime: timestamppb.New(time.Unix(tag.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(tag.UpdatedTs, 0)),
		Creator:    fmt.Sprintf("%s%d", UserNamePrefix, creator.ID),
		TagHash:    tag.TagHash,
		TagName:    tag.TagName,
		Emoji:      tag.Emoji,
	}

	if tag.PinnedTs != nil {
		result.PinnedTime = timestamppb.New(time.Unix(*tag.PinnedTs, 0))
	}

	return result, nil
}

// calculateTagHash calculates a hash for a tag name for use as unique identifier.
func calculateTagHash(tagName string) string {
	hash := sha256.Sum256([]byte(tagName))
	return fmt.Sprintf("%x", hash)
}

package v2

import (
	"context"
	"fmt"
	"regexp"
	"sort"

	"github.com/pkg/errors"
	"golang.org/x/exp/slices"
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
	username, err := ExtractUsernameFromName(request.User)
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

func (s *APIV2Service) GetTagSuggestions(ctx context.Context, request *apiv2pb.GetTagSuggestionsRequest) (*apiv2pb.GetTagSuggestionsResponse, error) {
	username, err := ExtractUsernameFromName(request.User)
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
	normalRowStatus := store.Normal
	memoFind := &store.FindMemo{
		CreatorID:     &user.ID,
		ContentSearch: []string{"#"},
		RowStatus:     &normalRowStatus,
	}
	memoList, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	tagList, err := s.Store.ListTags(ctx, &store.FindTag{
		CreatorID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list tags: %v", err)
	}

	tagNameList := []string{}
	for _, tag := range tagList {
		tagNameList = append(tagNameList, tag.Name)
	}
	tagMapSet := make(map[string]bool)
	for _, memo := range memoList {
		for _, tag := range findTagListFromMemoContent(memo.Content) {
			if !slices.Contains(tagNameList, tag) {
				tagMapSet[tag] = true
			}
		}
	}
	suggestions := []string{}
	for tag := range tagMapSet {
		suggestions = append(suggestions, tag)
	}
	sort.Strings(suggestions)

	return &apiv2pb.GetTagSuggestionsResponse{
		Tags: suggestions,
	}, nil
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

var tagRegexp = regexp.MustCompile(`#([^\s#,]+)`)

func findTagListFromMemoContent(memoContent string) []string {
	tagMapSet := make(map[string]bool)
	matches := tagRegexp.FindAllStringSubmatch(memoContent, -1)
	for _, v := range matches {
		tagName := v[1]
		tagMapSet[tagName] = true
	}

	tagList := []string{}
	for tag := range tagMapSet {
		tagList = append(tagList, tag)
	}
	sort.Strings(tagList)
	return tagList
}

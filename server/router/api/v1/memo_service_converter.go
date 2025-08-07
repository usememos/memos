package v1

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/gomark/parser"
	"github.com/usememos/gomark/parser/tokenizer"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) convertMemoFromStore(ctx context.Context, memo *store.Memo, reactions []*store.Reaction) (*v1pb.Memo, error) {
	displayTs := memo.CreatedTs
	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace memo related setting")
	}
	if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
		displayTs = memo.UpdatedTs
	}

	name := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
	memoMessage := &v1pb.Memo{
		Name:        name,
		State:       convertStateFromStore(memo.RowStatus),
		Creator:     fmt.Sprintf("%s%d", UserNamePrefix, memo.CreatorID),
		CreateTime:  timestamppb.New(time.Unix(memo.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(memo.UpdatedTs, 0)),
		DisplayTime: timestamppb.New(time.Unix(displayTs, 0)),
		Content:     memo.Content,
		Visibility:  convertVisibilityFromStore(memo.Visibility),
		Pinned:      memo.Pinned,
	}
	if memo.Payload != nil {
		memoMessage.Tags = memo.Payload.Tags
		memoMessage.Property = convertMemoPropertyFromStore(memo.Payload.Property)
		memoMessage.Location = convertLocationFromStore(memo.Payload.Location)
	}

	if memo.ParentUID != nil {
		parentName := fmt.Sprintf("%s%s", MemoNamePrefix, *memo.ParentUID)
		memoMessage.Parent = &parentName
	}

	listMemoRelationsResponse, err := s.ListMemoRelations(ctx, &v1pb.ListMemoRelationsRequest{Name: name})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo relations")
	}
	memoMessage.Relations = listMemoRelationsResponse.Relations

	listMemoAttachmentsResponse, err := s.ListMemoAttachments(ctx, &v1pb.ListMemoAttachmentsRequest{Name: name})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo attachments")
	}
	memoMessage.Attachments = listMemoAttachmentsResponse.Attachments

	if len(reactions) > 0 {
		for _, reaction := range reactions {
			reactionMessage, err := s.convertReactionFromStore(ctx, reaction)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to convert reaction")
			}
			memoMessage.Reactions = append(memoMessage.Reactions, reactionMessage)
		}
	} else {
		// done for backwards compatibility
		// can remove once convertMemoFromStore is only responsible for mapping
		// and all related DB entities are passed in as arguments purely for converting to request entities
		listMemoReactionsResponse, err := s.ListMemoReactions(ctx, &v1pb.ListMemoReactionsRequest{Name: name})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list memo reactions")
		}
		memoMessage.Reactions = listMemoReactionsResponse.Reactions
	}

	nodes, err := parser.Parse(tokenizer.Tokenize(memo.Content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse content")
	}
	memoMessage.Nodes = convertFromASTNodes(nodes)

	snippet, err := getMemoContentSnippet(memo.Content)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo content snippet")
	}
	memoMessage.Snippet = snippet

	return memoMessage, nil
}

func convertMemoPropertyFromStore(property *storepb.MemoPayload_Property) *v1pb.Memo_Property {
	if property == nil {
		return nil
	}
	return &v1pb.Memo_Property{
		HasLink:            property.HasLink,
		HasTaskList:        property.HasTaskList,
		HasCode:            property.HasCode,
		HasIncompleteTasks: property.HasIncompleteTasks,
	}
}

func convertLocationFromStore(location *storepb.MemoPayload_Location) *v1pb.Location {
	if location == nil {
		return nil
	}
	return &v1pb.Location{
		Placeholder: location.Placeholder,
		Latitude:    location.Latitude,
		Longitude:   location.Longitude,
	}
}

func convertLocationToStore(location *v1pb.Location) *storepb.MemoPayload_Location {
	if location == nil {
		return nil
	}
	return &storepb.MemoPayload_Location{
		Placeholder: location.Placeholder,
		Latitude:    location.Latitude,
		Longitude:   location.Longitude,
	}
}

func convertVisibilityFromStore(visibility store.Visibility) v1pb.Visibility {
	switch visibility {
	case store.Private:
		return v1pb.Visibility_PRIVATE
	case store.Protected:
		return v1pb.Visibility_PROTECTED
	case store.Public:
		return v1pb.Visibility_PUBLIC
	default:
		return v1pb.Visibility_VISIBILITY_UNSPECIFIED
	}
}

func convertVisibilityToStore(visibility v1pb.Visibility) store.Visibility {
	switch visibility {
	case v1pb.Visibility_PRIVATE:
		return store.Private
	case v1pb.Visibility_PROTECTED:
		return store.Protected
	case v1pb.Visibility_PUBLIC:
		return store.Public
	default:
		return store.Private
	}
}

package v1

import (
	"context"
	stderrors "errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

var (
	errMemoCreatorNotFound     = stderrors.New("memo creator not found")
	errReactionCreatorNotFound = stderrors.New("reaction creator not found")
)

func (s *APIV1Service) convertMemoFromStore(ctx context.Context, memo *store.Memo, reactions []*store.Reaction, attachments []*store.Attachment, relations []*v1pb.MemoRelation) (*v1pb.Memo, error) {
	creatorMap, err := s.listUsersByID(ctx, []int32{memo.CreatorID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo creators")
	}
	return s.convertMemoFromStoreWithCreators(ctx, memo, reactions, attachments, relations, creatorMap)
}

func (s *APIV1Service) convertMemoFromStoreWithCreators(ctx context.Context, memo *store.Memo, reactions []*store.Reaction, attachments []*store.Attachment, relations []*v1pb.MemoRelation, creatorMap map[int32]*store.User) (*v1pb.Memo, error) {
	name := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
	creator := creatorMap[memo.CreatorID]
	if creator == nil {
		return nil, errMemoCreatorNotFound
	}
	memoMessage := &v1pb.Memo{
		Name:       name,
		State:      convertStateFromStore(memo.RowStatus),
		Creator:    BuildUserName(creator.Username),
		CreateTime: timestamppb.New(time.Unix(memo.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(memo.UpdatedTs, 0)),
		Content:    memo.Content,
		Visibility: convertVisibilityFromStore(memo.Visibility),
		Pinned:     memo.Pinned,
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

	reactionMessages, err := s.convertReactionsFromStoreWithCreators(ctx, reactions, creatorMap)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert reactions")
	}
	memoMessage.Reactions = reactionMessages

	if relations != nil {
		memoMessage.Relations = relations
	} else {
		memoMessage.Relations = []*v1pb.MemoRelation{}
	}

	memoMessage.Attachments = []*v1pb.Attachment{}
	for _, attachment := range attachments {
		attachmentResponse := convertAttachmentFromStore(attachment)
		memoMessage.Attachments = append(memoMessage.Attachments, attachmentResponse)
	}

	snippet, err := s.getMemoContentSnippet(memo.Content)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo content snippet")
	}
	memoMessage.Snippet = snippet

	return memoMessage, nil
}

func (s *APIV1Service) listUsersByIDWithExisting(ctx context.Context, userIDs []int32, existing map[int32]*store.User) (map[int32]*store.User, error) {
	usersByID := make(map[int32]*store.User, len(existing)+len(userIDs))
	for userID, user := range existing {
		if user != nil {
			usersByID[userID] = user
		}
	}

	missingUserIDs := make([]int32, 0, len(userIDs))
	seenMissingUserIDs := make(map[int32]struct{}, len(userIDs))
	for _, userID := range userIDs {
		if _, ok := usersByID[userID]; ok {
			continue
		}
		if _, ok := seenMissingUserIDs[userID]; ok {
			continue
		}
		seenMissingUserIDs[userID] = struct{}{}
		missingUserIDs = append(missingUserIDs, userID)
	}

	if len(missingUserIDs) == 0 {
		return usersByID, nil
	}

	missingUsersByID, err := s.listUsersByID(ctx, missingUserIDs)
	if err != nil {
		return nil, err
	}
	for userID, user := range missingUsersByID {
		if user != nil {
			usersByID[userID] = user
		}
	}
	return usersByID, nil
}

func (s *APIV1Service) convertReactionsFromStoreWithCreators(ctx context.Context, reactions []*store.Reaction, creatorMap map[int32]*store.User) ([]*v1pb.Reaction, error) {
	if len(reactions) == 0 {
		return []*v1pb.Reaction{}, nil
	}

	creatorIDs := make([]int32, 0, len(reactions))
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	creatorsByID, err := s.listUsersByIDWithExisting(ctx, creatorIDs, creatorMap)
	if err != nil {
		return nil, err
	}

	reactionMessages := make([]*v1pb.Reaction, 0, len(reactions))
	for _, reaction := range reactions {
		reactionMessage, err := convertReactionFromStoreWithCreators(reaction, creatorsByID)
		if err != nil {
			if stderrors.Is(err, errReactionCreatorNotFound) {
				slog.Warn("Skipping reaction with missing creator",
					slog.Int64("reaction_id", int64(reaction.ID)),
					slog.Int64("creator_id", int64(reaction.CreatorID)),
					slog.String("content_id", reaction.ContentID),
				)
				continue
			}
			return nil, err
		}
		reactionMessages = append(reactionMessages, reactionMessage)
	}
	return reactionMessages, nil
}

func convertReactionFromStoreWithCreators(reaction *store.Reaction, creatorsByID map[int32]*store.User) (*v1pb.Reaction, error) {
	creator := creatorsByID[reaction.CreatorID]
	if creator == nil {
		return nil, errReactionCreatorNotFound
	}

	reactionUID := fmt.Sprintf("%d", reaction.ID)
	return &v1pb.Reaction{
		Name:         fmt.Sprintf("%s/%s%s", reaction.ContentID, ReactionNamePrefix, reactionUID),
		Creator:      BuildUserName(creator.Username),
		ContentId:    reaction.ContentID,
		ReactionType: reaction.ReactionType,
		CreateTime:   timestamppb.New(time.Unix(reaction.CreatedTs, 0)),
	}, nil
}

// batchConvertMemoRelations batch-loads relations for a list of memos and returns
// a map from memo ID to its converted relations. This avoids N+1 queries when listing memos.
func (s *APIV1Service) batchConvertMemoRelations(ctx context.Context, memos []*store.Memo, includeSnippets bool) (map[int32][]*v1pb.MemoRelation, error) {
	if len(memos) == 0 {
		return map[int32][]*v1pb.MemoRelation{}, nil
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	var memoFilter string
	if currentUser == nil {
		memoFilter = `visibility == "PUBLIC"`
	} else {
		memoFilter = fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, currentUser.ID)
	}

	memoIDs := make([]int32, len(memos))
	memoIDSet := make(map[int32]bool, len(memos))
	for i, m := range memos {
		memoIDs[i] = m.ID
		memoIDSet[m.ID] = true
	}

	outgoingRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		SourceMemoIDList: memoIDs,
		MemoFilter:       &memoFilter,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to batch list outgoing memo relations")
	}
	incomingRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoIDList: memoIDs,
		MemoFilter:        &memoFilter,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to batch list incoming memo relations")
	}
	allRelations := mergeMemoRelations(outgoingRelations, incomingRelations)

	// Collect all memo IDs referenced in relations that we need to resolve.
	neededIDs := make(map[int32]bool)
	for _, r := range allRelations {
		neededIDs[r.MemoID] = true
		neededIDs[r.RelatedMemoID] = true
	}

	// Build ID→UID map from the memos we already have.
	memoIDToUID := make(map[int32]string, len(memos))
	memoIDToSnippet := make(map[int32]string, len(memos))
	for _, m := range memos {
		memoIDToUID[m.ID] = m.UID
		if includeSnippets {
			snippet, err := s.getMemoContentSnippet(m.Content)
			if err != nil {
				return nil, errors.Wrap(err, "failed to get memo content snippet")
			}
			memoIDToSnippet[m.ID] = snippet
		}
		delete(neededIDs, m.ID)
	}

	// Batch fetch any additional memos referenced by relations that we don't already have.
	if len(neededIDs) > 0 {
		extraIDs := make([]int32, 0, len(neededIDs))
		for id := range neededIDs {
			extraIDs = append(extraIDs, id)
		}
		extraFind := &store.FindMemo{IDList: extraIDs, ExcludeContent: !includeSnippets}
		extraMemos, err := s.Store.ListMemos(ctx, extraFind)
		if err != nil {
			return nil, errors.Wrap(err, "failed to batch fetch related memos")
		}
		for _, m := range extraMemos {
			memoIDToUID[m.ID] = m.UID
			if includeSnippets {
				snippet, err := s.getMemoContentSnippet(m.Content)
				if err != nil {
					return nil, errors.Wrap(err, "failed to get related memo content snippet")
				}
				memoIDToSnippet[m.ID] = snippet
			}
		}
	}

	// Build the result map: memo ID → its relations (both directions).
	result := make(map[int32][]*v1pb.MemoRelation, len(memos))
	for _, r := range allRelations {
		memoUID, ok1 := memoIDToUID[r.MemoID]
		relatedUID, ok2 := memoIDToUID[r.RelatedMemoID]
		if !ok1 || !ok2 {
			continue
		}

		relation := &v1pb.MemoRelation{
			Memo: &v1pb.MemoRelation_Memo{
				Name:    fmt.Sprintf("%s%s", MemoNamePrefix, memoUID),
				Snippet: memoIDToSnippet[r.MemoID],
			},
			RelatedMemo: &v1pb.MemoRelation_Memo{
				Name:    fmt.Sprintf("%s%s", MemoNamePrefix, relatedUID),
				Snippet: memoIDToSnippet[r.RelatedMemoID],
			},
			Type: convertMemoRelationTypeFromStore(r.Type),
		}

		// Add to the memo that owns this relation (both directions).
		if memoIDSet[r.MemoID] {
			result[r.MemoID] = append(result[r.MemoID], relation)
		}
		if memoIDSet[r.RelatedMemoID] {
			result[r.RelatedMemoID] = append(result[r.RelatedMemoID], relation)
		}
	}

	return result, nil
}

// loadMemoRelations loads relations for a single memo and converts them to API format.
func (s *APIV1Service) loadMemoRelations(ctx context.Context, memo *store.Memo) ([]*v1pb.MemoRelation, error) {
	relationMap, err := s.batchConvertMemoRelations(ctx, []*store.Memo{memo}, true)
	if err != nil {
		return nil, err
	}
	return relationMap[memo.ID], nil
}

func mergeMemoRelations(groups ...[]*store.MemoRelation) []*store.MemoRelation {
	seen := make(map[string]struct{})
	merged := make([]*store.MemoRelation, 0)
	for _, relations := range groups {
		for _, relation := range relations {
			key := fmt.Sprintf("%d:%d:%s", relation.MemoID, relation.RelatedMemoID, relation.Type)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, relation)
		}
	}
	return merged
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
		Title:              property.Title,
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
	case v1pb.Visibility_PROTECTED:
		return store.Protected
	case v1pb.Visibility_PUBLIC:
		return store.Public
	default:
		return store.Private
	}
}

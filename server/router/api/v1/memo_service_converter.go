package v1

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) convertMemoFromStore(ctx context.Context, memo *store.Memo, reactions []*store.Reaction, attachments []*store.Attachment, relations []*v1pb.MemoRelation) (*v1pb.Memo, error) {
	creatorMap, err := s.listUsersByID(ctx, []int32{memo.CreatorID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo creators")
	}
	return s.convertMemoFromStoreWithCreators(ctx, memo, reactions, attachments, relations, creatorMap)
}

func (s *APIV1Service) convertMemoFromStoreWithCreators(ctx context.Context, memo *store.Memo, reactions []*store.Reaction, attachments []*store.Attachment, relations []*v1pb.MemoRelation, creatorMap map[int32]*store.User) (*v1pb.Memo, error) {
	displayTs := memo.CreatedTs
	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance memo related setting")
	}
	if instanceMemoRelatedSetting.DisplayWithUpdateTime {
		displayTs = memo.UpdatedTs
	}

	name := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
	creator := creatorMap[memo.CreatorID]
	if creator == nil {
		return nil, errors.New("memo creator not found")
	}
	memoMessage := &v1pb.Memo{
		Name:        name,
		State:       convertStateFromStore(memo.RowStatus),
		Creator:     BuildUserName(creator.Username),
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

	memoMessage.Reactions = []*v1pb.Reaction{}
	for _, reaction := range reactions {
		reactionResponse, err := s.convertReactionFromStore(ctx, reaction)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert reaction")
		}
		memoMessage.Reactions = append(memoMessage.Reactions, reactionResponse)
	}

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

// batchConvertMemoRelations batch-loads relations for a list of memos and returns
// a map from memo ID to its converted relations. This avoids N+1 queries when listing memos.
func (s *APIV1Service) batchConvertMemoRelations(ctx context.Context, memos []*store.Memo) (map[int32][]*v1pb.MemoRelation, error) {
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

	// Single batch query to get all relations involving any of these memos.
	allRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: memoIDs,
		MemoFilter: &memoFilter,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to batch list memo relations")
	}

	// Collect all memo IDs referenced in relations that we need to resolve.
	neededIDs := make(map[int32]bool)
	for _, r := range allRelations {
		neededIDs[r.MemoID] = true
		neededIDs[r.RelatedMemoID] = true
	}

	// Build ID→UID map from the memos we already have.
	memoIDToUID := make(map[int32]string, len(memos))
	memoIDToContent := make(map[int32]string, len(memos))
	for _, m := range memos {
		memoIDToUID[m.ID] = m.UID
		memoIDToContent[m.ID] = m.Content
		delete(neededIDs, m.ID)
	}

	// Batch fetch any additional memos referenced by relations that we don't already have.
	if len(neededIDs) > 0 {
		extraIDs := make([]int32, 0, len(neededIDs))
		for id := range neededIDs {
			extraIDs = append(extraIDs, id)
		}
		extraMemos, err := s.Store.ListMemos(ctx, &store.FindMemo{IDList: extraIDs})
		if err != nil {
			return nil, errors.Wrap(err, "failed to batch fetch related memos")
		}
		for _, m := range extraMemos {
			memoIDToUID[m.ID] = m.UID
			memoIDToContent[m.ID] = m.Content
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

		memoSnippet, _ := s.getMemoContentSnippet(memoIDToContent[r.MemoID])
		relatedSnippet, _ := s.getMemoContentSnippet(memoIDToContent[r.RelatedMemoID])
		relation := &v1pb.MemoRelation{
			Memo: &v1pb.MemoRelation_Memo{
				Name:    fmt.Sprintf("%s%s", MemoNamePrefix, memoUID),
				Snippet: memoSnippet,
			},
			RelatedMemo: &v1pb.MemoRelation_Memo{
				Name:    fmt.Sprintf("%s%s", MemoNamePrefix, relatedUID),
				Snippet: relatedSnippet,
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
	relationMap, err := s.batchConvertMemoRelations(ctx, []*store.Memo{memo})
	if err != nil {
		return nil, err
	}
	return relationMap[memo.ID], nil
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

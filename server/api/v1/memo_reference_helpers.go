package v1

import (
	"context"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// resolveContentReferenceRelations derives a memo's REFERENCE relations from the links
// in its own content, which is now the only place they come from. An inline link to
// /memos/{uid} *is* the reference, so deleting the link drops the backlink with it and
// the two directions can never disagree.
//
// Links that cannot be resolved are skipped rather than rejected: a link may point at a
// memo that was since deleted, or at one the author cannot read, and neither should stop
// them from saving their text. memoID is zero while creating, where the row does not
// exist yet; the store fills it in from the memo it just inserted.
func (s *APIV1Service) resolveContentReferenceRelations(
	ctx context.Context,
	memoID int32,
	memoUID string,
	content string,
) ([]*store.MemoRelation, error) {
	relations := []*store.MemoRelation{}
	if content == "" {
		return relations, nil
	}
	data, err := s.MarkdownService.ExtractAll([]byte(content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to extract memo references")
	}

	referenceType := convertMemoRelationTypeToStore(v1pb.MemoRelation_REFERENCE)
	seen := make(map[int32]struct{}, len(data.MemoReferences))
	for _, uid := range data.MemoReferences {
		// A memo referencing itself carries no information in either direction.
		if uid == memoUID {
			continue
		}
		referenced, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &uid})
		if err != nil {
			return nil, errors.Wrap(err, "failed to get referenced memo")
		}
		if referenced == nil || (memoID != 0 && referenced.ID == memoID) {
			continue
		}
		if err := s.checkMemoReadAccess(ctx, referenced); err != nil {
			continue
		}
		if _, ok := seen[referenced.ID]; ok {
			continue
		}
		seen[referenced.ID] = struct{}{}
		relations = append(relations, &store.MemoRelation{
			MemoID:        memoID,
			RelatedMemoID: referenced.ID,
			Type:          referenceType,
		})
	}
	return relations, nil
}

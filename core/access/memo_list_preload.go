package access

import (
	"context"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// MemoListStore is the store subset needed to preload memo-list read context.
// *store.Store satisfies it. It is separate from MemoReadStore because list
// conversion batches with the List methods while single-memo paths keep the
// single-row Get methods.
type MemoListStore interface {
	ListSpaces(ctx context.Context, find *store.FindSpace) ([]*store.Space, error)
	ListSpaceMembers(ctx context.Context, find *store.FindSpaceMember) ([]*store.SpaceMember, error)
}

// MemoListPreload holds the in-memory read context for one list call. It is
// built by exactly one ListSpaces plus at most one ListSpaceMembers, no matter
// how many memos share a space. The name is disjoint from MemoReadFacts,
// whose resolution rules this reuses without modifying.
type MemoListPreload struct {
	// SpaceByID holds every assigned space referenced by the listed memos.
	SpaceByID map[int32]*store.Space
	// ViewerMemberBySpace marks spaces where the viewer holds an active
	// membership. It is only populated when a member lookup ran.
	ViewerMemberBySpace map[int32]bool
	// Viewer is the list caller. Nil means anonymous.
	Viewer *store.User
}

// PreloadMemoList batches the space context for one list call: one deduped
// ListSpaces(IDList) plus at most one ListSpaceMembers(UserID). Memos with a
// nil SpaceID need no lookup and get zero-value treatment, matching the
// per-memo path, which skips buildMemoReadContext for them entirely.
func PreloadMemoList(ctx context.Context, s MemoListStore, memos []*store.Memo, viewer *store.User) (*MemoListPreload, error) {
	preload := &MemoListPreload{
		SpaceByID:           map[int32]*store.Space{},
		ViewerMemberBySpace: map[int32]bool{},
		Viewer:              viewer,
	}
	spaceIDs := make([]int32, 0, len(memos))
	seenSpaceIDs := make(map[int32]struct{}, len(memos))
	for _, memo := range memos {
		if memo == nil || memo.SpaceID == nil {
			continue
		}
		if _, seen := seenSpaceIDs[*memo.SpaceID]; seen {
			continue
		}
		seenSpaceIDs[*memo.SpaceID] = struct{}{}
		spaceIDs = append(spaceIDs, *memo.SpaceID)
	}
	if len(spaceIDs) == 0 {
		return preload, nil
	}
	spaces, err := s.ListSpaces(ctx, &store.FindSpace{IDList: spaceIDs})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo spaces")
	}
	for _, space := range spaces {
		if space != nil {
			preload.SpaceByID[space.ID] = space
		}
	}
	// Membership never changes the outcome for an inactive viewer or for an
	// instance administrator, so skip the lookup for both, mirroring
	// MemoReadFacts.WithViewer.
	if !IsActiveUser(viewer) || IsInstanceAdmin(viewer) {
		return preload, nil
	}
	members, err := s.ListSpaceMembers(ctx, &store.FindSpaceMember{UserID: &viewer.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list viewer space memberships")
	}
	for _, member := range members {
		if member == nil {
			continue
		}
		if _, wanted := seenSpaceIDs[member.SpaceID]; !wanted {
			continue
		}
		if member.Role.IsActiveMember() {
			preload.ViewerMemberBySpace[member.SpaceID] = true
		}
	}
	return preload, nil
}

// ReadContextFor builds the same read context ResolveMemoReadContext would
// produce for one memo and the preloaded viewer, from in-memory rows only. It
// performs no store calls. Creator validity reuses the ResolveMemoReadFacts
// rule against the already-batched creatorMap; space validity is presence in
// the preloaded SpaceByID; membership applies the same active/admin skip as
// MemoReadFacts.WithViewer.
func (p *MemoListPreload) ReadContextFor(memo *store.Memo, creatorMap map[int32]*store.User, allowAnonymous bool, sharedMemoID *int32) MemoReadContext {
	readContext := MemoReadContext{
		Viewer:         p.Viewer,
		AllowAnonymous: allowAnonymous,
		SharedMemoID:   sharedMemoID,
	}
	if memo == nil {
		return readContext
	}
	readContext.Memo = memo
	creator := creatorMap[memo.CreatorID]
	readContext.CreatorValid = creator != nil && creator.ID == memo.CreatorID &&
		(creator.RowStatus == store.Normal || creator.RowStatus == store.Archived)
	if memo.SpaceID == nil {
		readContext.SpaceValid = true
		return readContext
	}
	space := p.SpaceByID[*memo.SpaceID]
	readContext.SpaceValid = space != nil
	if !readContext.SpaceValid {
		return readContext
	}
	if !IsActiveUser(p.Viewer) || IsInstanceAdmin(p.Viewer) {
		return readContext
	}
	readContext.ViewerSpaceMember = p.ViewerMemberBySpace[*memo.SpaceID]
	return readContext
}

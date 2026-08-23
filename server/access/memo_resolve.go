package access

import (
	"context"

	"github.com/usememos/memos/store"
)

// MemoReadStore is the store subset needed to resolve a memo read context.
// *store.Store satisfies it.
type MemoReadStore interface {
	GetUser(ctx context.Context, find *store.FindUser) (*store.User, error)
	GetSpace(ctx context.Context, find *store.FindSpace) (*store.Space, error)
	GetSpaceMember(ctx context.Context, find *store.FindSpaceMember) (*store.SpaceMember, error)
}

// MemoReadFacts holds the viewer-independent authorization inputs for one memo.
// They are resolved once and reused across every viewer evaluated against the
// same memo.
type MemoReadFacts struct {
	Memo         *store.Memo
	CreatorValid bool
	SpaceValid   bool
}

// ResolveMemoReadFacts resolves the memo-local authorization inputs that do not
// depend on who is reading: whether the memo has a valid creator and, when it is
// assigned, whether its placement still exists. SpaceValid is authorization
// input only for SPACE reads and placement-dependent projection and
// writes; other audiences remain readable through their own memo-local rules.
func ResolveMemoReadFacts(ctx context.Context, s MemoReadStore, memo *store.Memo) (MemoReadFacts, error) {
	facts := MemoReadFacts{Memo: memo}
	if memo == nil {
		return facts, nil
	}
	creatorID := memo.CreatorID
	creator, err := s.GetUser(ctx, &store.FindUser{ID: &creatorID})
	if err != nil {
		return MemoReadFacts{}, err
	}
	facts.CreatorValid = creator != nil && creator.ID == creatorID &&
		(creator.RowStatus == store.Normal || creator.RowStatus == store.Archived)

	facts.SpaceValid = memo.SpaceID == nil
	if memo.SpaceID != nil {
		space, err := s.GetSpace(ctx, &store.FindSpace{ID: memo.SpaceID})
		if err != nil {
			return MemoReadFacts{}, err
		}
		facts.SpaceValid = space != nil
	}
	return facts, nil
}

// WithViewer completes the read context for one viewer. Only the membership
// lookup is viewer-dependent, so evaluating additional viewers against the same
// memo costs at most one query each.
func (f MemoReadFacts) WithViewer(ctx context.Context, s MemoReadStore, viewer *store.User, allowAnonymous bool, sharedMemoID *int32) (MemoReadContext, error) {
	readContext := MemoReadContext{
		Memo:           f.Memo,
		Viewer:         viewer,
		AllowAnonymous: allowAnonymous,
		SharedMemoID:   sharedMemoID,
		CreatorValid:   f.CreatorValid,
		SpaceValid:     f.SpaceValid,
	}
	if f.Memo == nil || f.Memo.SpaceID == nil || !f.SpaceValid {
		return readContext, nil
	}
	if viewer == nil || viewer.RowStatus != store.Normal {
		return readContext, nil
	}
	membership, err := s.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: f.Memo.SpaceID, UserID: &viewer.ID})
	if err != nil {
		return MemoReadContext{}, err
	}
	readContext.ViewerSpaceMember = membership != nil && membership.Role.IsActiveMember()
	return readContext, nil
}

// ResolveMemoReadContext resolves a complete read context for one memo and one
// viewer.
func ResolveMemoReadContext(ctx context.Context, s MemoReadStore, memo *store.Memo, viewer *store.User, allowAnonymous bool, sharedMemoID *int32) (MemoReadContext, error) {
	facts, err := ResolveMemoReadFacts(ctx, s, memo)
	if err != nil {
		return MemoReadContext{}, err
	}
	return facts.WithViewer(ctx, s, viewer, allowAnonymous, sharedMemoID)
}

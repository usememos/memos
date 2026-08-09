// Package access defines transport-independent resource authorization policies
// shared by the server's API and HTTP adapters.
package access

import "github.com/usememos/memos/store"

// MemoReadDenial describes why a memo read was rejected.
type MemoReadDenial int

const (
	// MemoReadDenialNone means the read is allowed.
	MemoReadDenialNone MemoReadDenial = iota
	// MemoReadDenialNotFound hides missing, archived, and invalid memo state.
	MemoReadDenialNotFound
	// MemoReadDenialUnauthenticated means the resource requires a signed-in user.
	MemoReadDenialUnauthenticated
	// MemoReadDenialPermission means the signed-in user cannot read the resource.
	MemoReadDenialPermission
)

// MemoReadClass describes whether the resource is anonymously readable.
type MemoReadClass int

const (
	// MemoReadClassPrivate is for owner, authenticated, or share-token reads.
	MemoReadClassPrivate MemoReadClass = iota
	// MemoReadClassPublic is for resources currently readable without credentials.
	MemoReadClassPublic
)

// MemoReadDecision is the outcome of evaluating memo read access.
type MemoReadDecision struct {
	Denial MemoReadDenial
	Class  MemoReadClass
}

// Allowed reports whether the read is permitted.
func (d MemoReadDecision) Allowed() bool {
	return d.Denial == MemoReadDenialNone
}

// CheckMemoRead evaluates access to memo. If parent is non-nil, both the comment
// memo and its parent must be readable. A share grants access only to the exact,
// non-comment memo identified by sharedMemoID.
func CheckMemoRead(memo, parent *store.Memo, viewer *store.User, allowAnonymous bool, sharedMemoID *int32) MemoReadDecision {
	if memo == nil {
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}

	if parent == nil {
		shareApplies := sharedMemoID != nil && memo.ParentUID == nil && memo.ID == *sharedMemoID
		return checkMemo(memo, viewer, allowAnonymous, shareApplies)
	}

	// A token for a parent never grants access to its comments, and legacy
	// comment shares never bypass the parent policy. A comment's visibility is
	// derived from its parent so stale denormalized visibility values cannot
	// leak or hide comments after the parent visibility changes.
	commentState := checkCommentState(memo, viewer)
	if !commentState.Allowed() {
		return commentState
	}
	parentDecision := checkMemo(parent, viewer, allowAnonymous, false)
	if !parentDecision.Allowed() {
		return parentDecision
	}
	if commentState.Class == MemoReadClassPrivate {
		return MemoReadDecision{Class: MemoReadClassPrivate}
	}
	return parentDecision
}

func checkCommentState(memo *store.Memo, viewer *store.User) MemoReadDecision {
	if memo == nil {
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
	if memo.RowStatus == store.Archived {
		if viewer != nil && viewer.ID == memo.CreatorID {
			return MemoReadDecision{Class: MemoReadClassPrivate}
		}
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
	if memo.RowStatus != store.Normal {
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
	return MemoReadDecision{Class: MemoReadClassPublic}
}

func checkMemo(memo *store.Memo, viewer *store.User, allowAnonymous, shareApplies bool) MemoReadDecision {
	if memo == nil {
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
	if memo.RowStatus == store.Archived {
		if viewer != nil && viewer.ID == memo.CreatorID {
			return MemoReadDecision{Class: MemoReadClassPrivate}
		}
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
	if memo.RowStatus != store.Normal {
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
	if shareApplies {
		return MemoReadDecision{Class: MemoReadClassPrivate}
	}

	switch memo.Visibility {
	case store.Public:
		if allowAnonymous {
			return MemoReadDecision{Class: MemoReadClassPublic}
		}
		if viewer != nil {
			return MemoReadDecision{Class: MemoReadClassPrivate}
		}
		return MemoReadDecision{Denial: MemoReadDenialUnauthenticated}
	case store.Protected:
		if viewer != nil {
			return MemoReadDecision{Class: MemoReadClassPrivate}
		}
		return MemoReadDecision{Denial: MemoReadDenialUnauthenticated}
	case store.Private:
		if viewer == nil {
			return MemoReadDecision{Denial: MemoReadDenialUnauthenticated}
		}
		if viewer.ID != memo.CreatorID {
			return MemoReadDecision{Denial: MemoReadDenialPermission}
		}
		return MemoReadDecision{Class: MemoReadClassPrivate}
	default:
		return MemoReadDecision{Denial: MemoReadDenialNotFound}
	}
}

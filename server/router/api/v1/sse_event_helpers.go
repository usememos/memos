package v1

import "github.com/usememos/memos/store"

func buildMemoName(uid string) string {
	return MemoNamePrefix + uid
}

// resolveSSECreatorID returns the CreatorID used for SSE delivery filtering.
// For a comment memo, it returns the parent memo's CreatorID so that private
// parent-memo events are scoped to the parent owner.
func resolveSSECreatorID(memo *store.Memo, parentMemo *store.Memo) int32 {
	if memo == nil {
		return 0
	}
	if parentMemo != nil {
		return parentMemo.CreatorID
	}
	return memo.CreatorID
}

// buildMemoReactionSSEEvent constructs an SSEEvent for a reaction on a memo.
// Pass parentMemo when the memo is a comment (memo.ParentUID != nil).
func buildMemoReactionSSEEvent(eventType SSEEventType, contentID string, memo *store.Memo, parentMemo *store.Memo) *SSEEvent {
	parent := ""
	if memo != nil && memo.ParentUID != nil {
		parent = buildMemoName(*memo.ParentUID)
	}
	visibility := store.Visibility("")
	if memo != nil {
		visibility = memo.Visibility
	}
	return &SSEEvent{
		Type:       eventType,
		Name:       contentID,
		Parent:     parent,
		Visibility: visibility,
		CreatorID:  resolveSSECreatorID(memo, parentMemo),
	}
}

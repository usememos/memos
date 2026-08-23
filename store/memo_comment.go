package store

// MemoCommentAuthorizationSnapshot is the memo-local database state read by a
// driver before it creates an immutable COMMENT relation.
type MemoCommentAuthorizationSnapshot struct {
	ActorUserID int32
	ActorActive bool

	ContextID         int32
	ContextCreatorID  int32
	ContextRowStatus  RowStatus
	ContextVisibility Visibility
	ContextSpaceID    *int32

	ContextSpaceExists  bool
	ContextMemberActive bool
}

// ValidateMemoCommentAuthorization validates participation in the context
// memo. The replying memo is authorized independently by the normal memo-create
// policy; no placement or audience is inherited from this snapshot.
func ValidateMemoCommentAuthorization(snapshot *MemoCommentAuthorizationSnapshot) error {
	if snapshot == nil || snapshot.ActorUserID <= 0 || !snapshot.ActorActive {
		return ErrMemoPermissionDenied
	}
	if snapshot.ContextID <= 0 || snapshot.ContextRowStatus != Normal || !isValidVisibility(snapshot.ContextVisibility) {
		return ErrMemoSpaceNotWritable
	}
	if snapshot.ContextSpaceID == nil {
		if snapshot.ContextVisibility == SpaceAudience {
			return ErrMemoSpaceNotWritable
		}
	} else {
		if !snapshot.ContextSpaceExists {
			return ErrMemoSpaceNotWritable
		}
		// Participation in an assigned memo is narrower than reading it: active
		// membership is required even for PUBLIC and PROTECTED audiences.
		if !snapshot.ContextMemberActive {
			return ErrMemoSpaceMembershipRequired
		}
	}

	switch snapshot.ContextVisibility {
	case Private:
		if snapshot.ContextCreatorID != snapshot.ActorUserID {
			return ErrMemoPermissionDenied
		}
	case Protected, Public, SpaceAudience:
		// Any audience-specific placement and membership requirements were
		// validated above.
	default:
		return ErrMemoSpaceNotWritable
	}
	return nil
}

package store

import "github.com/pkg/errors"

// ReactionWritePolicy identifies the actor for a transport-facing reaction
// mutation. Drivers authorize that actor against the memo's current state.
type ReactionWritePolicy struct {
	ActorUserID int32
}

func validateReactionWritePolicy(reaction *Reaction) error {
	if reaction == nil || reaction.Policy == nil {
		return nil
	}
	policy := reaction.Policy
	if reaction.CreatorID <= 0 || reaction.MemoID <= 0 || policy.ActorUserID <= 0 {
		return errors.New("reaction write policy requires reaction, actor, and memo")
	}
	if reaction.CreatorID != policy.ActorUserID {
		return ErrReactionPermissionDenied
	}
	return nil
}

// ValidateReactionWriteParticipation applies the reaction actor identity and
// memo-local participation rules to state loaded by the write transaction.
func ValidateReactionWriteParticipation(reaction *Reaction, snapshot *MemoCommentAuthorizationSnapshot) error {
	if err := ValidateReactionWithdrawal(reaction, snapshot); err != nil {
		return err
	}
	return ValidateMemoCommentAuthorization(snapshot)
}

// ValidateReactionWithdrawal allows an active actor to withdraw their own reaction
// without requiring continued access to or participation in the memo. The driver
// also verifies ownership of the stored reaction in the same transaction.
func ValidateReactionWithdrawal(reaction *Reaction, snapshot *MemoCommentAuthorizationSnapshot) error {
	if err := validateReactionWritePolicy(reaction); err != nil {
		return err
	}
	if reaction == nil || reaction.Policy == nil || snapshot == nil {
		return errors.New("reaction write participation state is required")
	}
	if snapshot.ActorUserID != reaction.Policy.ActorUserID {
		return ErrReactionPermissionDenied
	}
	if !snapshot.ActorActive {
		return ErrReactionPermissionDenied
	}
	if snapshot.ContextID != reaction.MemoID {
		return ErrMemoMutationConflict
	}
	return nil
}

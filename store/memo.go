package store

import (
	"context"
	"database/sql"
	"errors"

	"github.com/usememos/memos/internal/base"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ErrMemoSpaceNotWritable indicates that a memo targets a missing or otherwise
// invalid Space.
var ErrMemoSpaceNotWritable = errors.New("memo space is not writable")

// ErrMemoSpaceMembershipRequired indicates that the memo creator is not an
// active member of its assigned space.
var ErrMemoSpaceMembershipRequired = errors.New("active space membership required")

// ErrMemoPermissionDenied indicates that the actor no longer owns the memo
// being mutated.
var ErrMemoPermissionDenied = errors.New("memo mutation permission denied")

// ErrMemoShareConflict indicates that an active share conflicts with a
// SPACE audience transition.
var ErrMemoShareConflict = errors.New("active memo share conflicts with audience")

// Visibility is the type of a visibility.
type Visibility string

const (
	// Public is the PUBLIC visibility.
	Public Visibility = "PUBLIC"
	// Protected is the PROTECTED visibility.
	Protected Visibility = "PROTECTED"
	// Private is the PRIVATE visibility.
	Private Visibility = "PRIVATE"
	// SpaceAudience is visible only to active members of its space.
	SpaceAudience Visibility = "SPACE"
)

func (v Visibility) String() string {
	return string(v)
}

type Memo struct {
	// ID is the system generated unique identifier for the memo.
	ID int32
	// UID is the user defined unique identifier for the memo.
	UID string

	// Standard fields
	RowStatus RowStatus
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility Visibility
	Pinned     bool
	Payload    *storepb.MemoPayload
	SpaceID    *int32

	// Composed fields
	ParentUID *string
}

type FindMemo struct {
	ID  *int32
	UID *string

	IDList  []int32
	UIDList []string

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int32

	// Domain specific fields
	VisibilityList       []Visibility
	CommentContextMemoID *int32
	Access               *MemoAccessScope
	ExcludeContent       bool
	ExcludeComments      bool
	Filters              []string

	// Pagination
	Limit  *int
	Offset *int

	// Ordering
	OrderByPinned    bool
	OrderByUpdatedTs bool
	OrderByTimeAsc   bool
}

type FindMemoPayload struct {
	Raw                *string
	TagSearch          []string
	HasLink            bool
	HasTaskList        bool
	HasCode            bool
	HasIncompleteTasks bool
}

type UpdateMemo struct {
	ID         int32
	UID        *string
	CreatedTs  *int64
	UpdatedTs  *int64
	RowStatus  *RowStatus
	Content    *string
	Visibility *Visibility
	Pinned     *bool
	Payload    *storepb.MemoPayload
	SpaceID    *int32
	ClearSpace bool
	// Policy is set by transport-facing author mutations. Drivers revalidate it
	// in the same transaction as the update; nil preserves trusted internal and
	// migration callers.
	Policy *MemoWritePolicy
}

// MemoWritePolicy identifies the actor and the intended kind of
// transport-facing mutation. Drivers discover and authorize the current memo,
// Space, membership, and share state in the write transaction.
type MemoWritePolicy struct {
	ActorUserID int32
	// LifecycleOnly permits an author who is no longer a member of the source
	// Space to move or withdraw the memo. It never permits content, metadata,
	// attachment, relation, or share mutations.
	LifecycleOnly bool
	// CreatingShare rejects a share if the memo's current audience is
	// SPACE. Share revocation deliberately leaves this false.
	CreatingShare bool
}

// MemoWriteSnapshot is the current database state used to validate a
// MemoWritePolicy. Driver packages populate it in the mutation transaction.
type MemoWriteSnapshot struct {
	CreatorID          int32
	RowStatus          RowStatus
	SpaceID            *int32
	Visibility         Visibility
	SourceSpaceExists  bool
	SourceMemberActive bool
	TargetSpaceExists  bool
	TargetMemberActive bool
	HasActiveShare     bool
}

// MemoAccessScope is a typed, fail-closed read authorization predicate. When
// present on FindMemo, drivers apply it in SQL before pagination.
type MemoAccessScope struct {
	UserID         *int32
	AllowPublic    bool
	AllowProtected bool
}

type DeleteMemo struct {
	ID int32
}

func (s *Store) CreateMemo(ctx context.Context, create *Memo) (*Memo, error) {
	if err := validateMemoCreate(create); err != nil {
		return nil, err
	}
	return s.driver.CreateMemo(ctx, create)
}

// CreateMemoComment atomically creates one independent memo and its immutable
// COMMENT relation to a context memo.
func (s *Store) CreateMemoComment(ctx context.Context, create *Memo, contextMemoID, actorUserID int32) (*Memo, error) {
	if create == nil || contextMemoID <= 0 || actorUserID <= 0 || create.CreatorID != actorUserID {
		return nil, errors.New("comment creation requires memo, context, and matching actor")
	}
	if create.Visibility == "" {
		create.Visibility = Private
	}
	if err := s.ApplyMemoMutation(ctx, &MemoMutation{
		MemoCreate:           create,
		CommentContextMemoID: &contextMemoID,
		MemoCreatorID:        actorUserID,
		ExpectedMemoContent:  create.Content,
	}); err != nil {
		return nil, err
	}
	return create, nil
}

func validateMemoCreate(create *Memo) error {
	if create == nil {
		return errors.New("memo is required")
	}
	if !base.UIDMatcher.MatchString(create.UID) {
		return errors.New("invalid uid")
	}
	if !isValidVisibility(create.Visibility) {
		return errors.New("invalid visibility")
	}
	if create.Visibility == SpaceAudience && create.SpaceID == nil {
		return errors.New("SPACE visibility requires a space")
	}
	return nil
}

func (s *Store) ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error) {
	return s.driver.ListMemos(ctx, find)
}

func (s *Store) GetMemo(ctx context.Context, find *FindMemo) (*Memo, error) {
	list, err := s.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (s *Store) UpdateMemo(ctx context.Context, update *UpdateMemo) error {
	if update.UID != nil && !base.UIDMatcher.MatchString(*update.UID) {
		return errors.New("invalid uid")
	}
	if update.Visibility != nil && !isValidVisibility(*update.Visibility) {
		return errors.New("invalid visibility")
	}
	if update.ClearSpace && update.Visibility != nil && *update.Visibility == SpaceAudience {
		return errors.New("SPACE visibility requires a space")
	}
	if err := validateMemoWritePolicy(update.Policy); err != nil {
		return err
	}
	if update.Policy == nil {
		return s.driver.UpdateMemo(ctx, update)
	}
	return s.driver.UpdateMemo(ctx, update)
}

func validateMemoWritePolicy(policy *MemoWritePolicy) error {
	if policy == nil {
		return nil
	}
	if policy.ActorUserID <= 0 {
		return errors.New("memo write policy requires actor")
	}
	if policy.LifecycleOnly && policy.CreatingShare {
		return errors.New("memo write policy has conflicting actions")
	}
	return nil
}

// ValidateMemoWriteSnapshot applies the transport-independent write
// invariants to current database state.
func ValidateMemoWriteSnapshot(policy *MemoWritePolicy, update *UpdateMemo, snapshot *MemoWriteSnapshot) error {
	if err := validateMemoWritePolicy(policy); err != nil {
		return err
	}
	if policy == nil || snapshot == nil {
		return errors.New("memo write policy snapshot is required")
	}
	if snapshot.CreatorID != policy.ActorUserID {
		return ErrMemoPermissionDenied
	}
	if snapshot.RowStatus != Normal && snapshot.RowStatus != Archived {
		return ErrMemoMutationConflict
	}
	if policy.CreatingShare && snapshot.RowStatus != Normal {
		return ErrMemoMutationConflict
	}
	if !isValidVisibility(snapshot.Visibility) {
		return ErrMemoMutationConflict
	}
	if policy.LifecycleOnly && !isLifecycleOnlyMemoUpdate(update) {
		// The source-writability exception exists only for an author's explicit
		// move or withdrawal after membership removal. It must never authorize a
		// content or metadata mutation in the same transaction.
		return ErrMemoSpaceMembershipRequired
	}
	if snapshot.SpaceID != nil {
		if !snapshot.SourceSpaceExists {
			return ErrMemoSpaceNotWritable
		}
		if !policy.LifecycleOnly && !snapshot.SourceMemberActive {
			return ErrMemoSpaceMembershipRequired
		}
	}

	resultSpaceID := snapshot.SpaceID
	resultVisibility := snapshot.Visibility
	if update != nil {
		if update.SpaceID != nil {
			if !snapshot.TargetSpaceExists {
				return ErrMemoSpaceNotWritable
			}
			if !snapshot.TargetMemberActive {
				return ErrMemoSpaceMembershipRequired
			}
			resultSpaceID = update.SpaceID
		} else if update.ClearSpace {
			resultSpaceID = nil
		}
		if update.Visibility != nil {
			resultVisibility = *update.Visibility
		}
	}
	if !isValidVisibility(resultVisibility) {
		return ErrMemoMutationConflict
	}
	placementChanged := !sameMemoSpace(resultSpaceID, snapshot.SpaceID)
	if placementChanged && snapshot.Visibility == SpaceAudience && (update == nil || update.Visibility == nil) {
		// Moving a current SPACE memo changes which membership grants
		// access. Require the audience to be explicitly confirmed in the same
		// mutation, even if a caller read an older audience before the transaction.
		return ErrMemoMutationConflict
	}
	if policy.LifecycleOnly && !placementChanged {
		return ErrMemoSpaceMembershipRequired
	}
	if resultVisibility == SpaceAudience && resultSpaceID == nil {
		return ErrMemoSpaceNotWritable
	}
	if policy.CreatingShare && resultVisibility == SpaceAudience {
		return ErrMemoShareConflict
	}
	if update != nil && update.Visibility != nil && *update.Visibility == SpaceAudience && snapshot.HasActiveShare {
		return ErrMemoShareConflict
	}
	return nil
}

func isLifecycleOnlyMemoUpdate(update *UpdateMemo) bool {
	if update == nil || (!update.ClearSpace && update.SpaceID == nil) || (update.ClearSpace && update.SpaceID != nil) {
		return false
	}
	return update.UID == nil &&
		update.CreatedTs == nil &&
		update.UpdatedTs == nil &&
		update.RowStatus == nil &&
		update.Content == nil &&
		update.Pinned == nil &&
		update.Payload == nil
}

// NullInt32Pointer converts a nullable SQL integer to an optional int32.
func NullInt32Pointer(value sql.NullInt64) *int32 {
	if !value.Valid {
		return nil
	}
	result := int32(value.Int64)
	return &result
}

func sameMemoSpace(left, right *int32) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func isValidVisibility(visibility Visibility) bool {
	return visibility == Public || visibility == Protected || visibility == Private || visibility == SpaceAudience
}

func (s *Store) DeleteMemo(ctx context.Context, delete *DeleteMemo) error {
	if delete == nil || delete.ID <= 0 {
		return errors.New("memo deletion requires a memo")
	}
	memo, err := s.GetMemo(ctx, &FindMemo{ID: &delete.ID})
	if err != nil {
		return err
	}
	if memo == nil {
		return nil
	}
	result, err := s.DeleteMemoWithPolicy(ctx, &DeleteMemoWithPolicy{MemoID: memo.ID, ActorUserID: memo.CreatorID})
	if err != nil {
		return err
	}
	return s.deleteAttachmentStorageSnapshots(ctx, result.Attachments)
}

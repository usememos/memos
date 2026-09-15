package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// memoRef addresses the mutated memo inside batch statements. A memo created
// by the same batch has no id yet, so it is found through its unique uid.
type memoRef struct {
	expr string
	arg  any
}

func memoRefByID(id int32) memoRef {
	return memoRef{expr: "?", arg: id}
}

func memoRefByUID(uid string) memoRef {
	return memoRef{expr: "(SELECT id FROM memo WHERE uid = ?)", arg: uid}
}

// memoMutationPlan is the state read by validation that the batch re-asserts
// with guards before applying the writes.
type memoMutationPlan struct {
	mutation  *store.MemoMutation
	ref       memoRef
	policy    *store.MemoWritePolicy
	endpoints []*memoState
	// context is the comment context memo, set only with MemoCreate.
	context *memoState
	// memo is the existing memo, nil with MemoCreate.
	memo    *memoState
	removed []*store.Attachment
}

// ApplyMemoMutation atomically updates a memo, attachment bindings, and
// reference relations. Every check the SQLite driver makes inside its
// transaction is made here as a read first and then re-asserted by a guard in
// the batch, so a concurrent change aborts the commit as a conflict.
func (d *DB) ApplyMemoMutation(ctx context.Context, mutation *store.MemoMutation) error {
	plan, err := d.planMemoMutation(ctx, mutation)
	if err != nil {
		return err
	}
	b := newBatch()
	if err := plan.addTo(b); err != nil {
		return err
	}
	if _, err := b.commit(ctx, d); err != nil {
		return guardError(err, errors.Wrap(store.ErrMemoMutationConflict, "memo state changed while applying mutation"))
	}
	return plan.finish(ctx, d.db)
}

// planMemoMutation performs the validation reads in the same order as the
// SQLite driver and collects the state the batch guards depend on.
func (d *DB) planMemoMutation(ctx context.Context, mutation *store.MemoMutation) (*memoMutationPlan, error) {
	plan := &memoMutationPlan{mutation: mutation}
	endpoints, err := memoValidateRelationEndpoints(ctx, d.db, mutation)
	if err != nil {
		return nil, err
	}
	plan.endpoints = endpoints

	if create := mutation.MemoCreate; create != nil {
		if err := plan.planCreate(ctx, d.db, create); err != nil {
			return nil, err
		}
	} else {
		plan.ref = memoRefByID(mutation.MemoID)
	}

	plan.policy = mutation.Policy
	if plan.policy == nil && mutation.MemoUpdate != nil {
		plan.policy = mutation.MemoUpdate.Policy
	}
	if plan.policy != nil {
		if err := validateMemoWritePolicy(ctx, d.db, mutation.MemoID, plan.policy, mutation.MemoUpdate); err != nil {
			return nil, err
		}
	}
	if mutation.MemoCreate == nil {
		if err := plan.planExistingMemo(ctx, d.db); err != nil {
			return nil, err
		}
	}
	if err := plan.planRemovedAttachments(ctx, d.db); err != nil {
		return nil, err
	}
	if err := plan.planBindings(ctx, d.db); err != nil {
		return nil, err
	}
	if err := plan.planRequiredAttachments(ctx, d.db); err != nil {
		return nil, err
	}
	if mutation.MemoUpdate != nil && mutation.MemoUpdate.ID != mutation.MemoID {
		return nil, errors.New("memo update target does not match attachment mutation")
	}
	if err := plan.planRelations(); err != nil {
		return nil, err
	}
	return plan, nil
}

// planCreate validates the memo creation and, for a comment, the context memo.
func (p *memoMutationPlan) planCreate(ctx context.Context, q querier, create *store.Memo) error {
	if err := memoValidateCreate(ctx, q, create); err != nil {
		return err
	}
	if contextID := p.mutation.CommentContextMemoID; contextID != nil {
		if *contextID <= 0 {
			return errors.New("invalid COMMENT relation")
		}
		if err := authorizeMemoComment(ctx, q, *contextID, create.CreatorID); err != nil {
			return err
		}
		state, err := loadMemoState(ctx, q, *contextID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoSpaceNotWritable
			}
			return errors.Wrap(err, "failed to read comment context memo")
		}
		p.context = state
	}
	p.mutation.MemoCreatorID = create.CreatorID
	p.mutation.ExpectedMemoContent = create.Content
	p.ref = memoRefByUID(create.UID)
	return nil
}

// planExistingMemo checks the memo still matches what the caller computed
// the mutation from.
func (p *memoMutationPlan) planExistingMemo(ctx context.Context, q querier) error {
	state, err := loadMemoState(ctx, q, p.mutation.MemoID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.Wrap(store.ErrMemoMutationConflict, "memo no longer exists")
		}
		return errors.Wrap(err, "failed to read memo")
	}
	if state.creatorID != p.mutation.MemoCreatorID || state.content != p.mutation.ExpectedMemoContent {
		return errors.Wrap(store.ErrMemoMutationConflict, "memo changed while applying mutation")
	}
	p.memo = state
	return nil
}

// planRemovedAttachments checks that every removed attachment is still bound
// to the memo and owned by its creator.
func (p *memoMutationPlan) planRemovedAttachments(ctx context.Context, q querier) error {
	mutation := p.mutation
	removed, err := listAttachmentSnapshots(ctx, q, mutation.RemovedAttachmentIDs)
	if err != nil {
		return errors.Wrap(err, "failed to read removed attachments")
	}
	if len(removed) != len(mutation.RemovedAttachmentIDs) {
		return errors.Wrap(store.ErrMemoMutationConflict, "removed attachment no longer exists")
	}
	for _, attachment := range removed {
		if attachment.CreatorID != mutation.MemoCreatorID || attachment.MemoID == nil || *attachment.MemoID != mutation.MemoID {
			return errors.Wrap(store.ErrMemoMutationConflict, "attachment is no longer removable from the memo")
		}
	}
	p.removed = removed
	return nil
}

// planBindings checks each attachment is in the state the binding expects:
// still bound to this memo, or unbound and owned by the memo creator.
func (p *memoMutationPlan) planBindings(ctx context.Context, q querier) error {
	mutation := p.mutation
	for _, binding := range mutation.Bindings {
		var creatorID int32
		var memoID sql.NullInt32
		if err := q.QueryRowContext(ctx, "SELECT creator_id, memo_id FROM attachment WHERE id = ?", binding.ID).Scan(&creatorID, &memoID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return errors.Wrapf(store.ErrMemoMutationConflict, "attachment %s no longer exists", binding.UID)
			}
			return errors.Wrap(err, "failed to read attachment")
		}
		if binding.WasBoundToMemo {
			// A memo created by this mutation cannot have prior bindings.
			if mutation.MemoCreate != nil || !memoID.Valid || memoID.Int32 != mutation.MemoID {
				return errors.Wrapf(store.ErrMemoMutationConflict, "attachment %s is no longer bound to the memo", binding.UID)
			}
		} else if creatorID != mutation.MemoCreatorID || memoID.Valid {
			return errors.Wrapf(store.ErrMemoMutationConflict, "attachment %s is no longer available", binding.UID)
		}
	}
	return nil
}

// planRequiredAttachments checks each required attachment will be bound once
// the batch has applied the bindings. The batch guards this again after the
// binding updates, where the effect of the bindings is visible.
func (p *memoMutationPlan) planRequiredAttachments(ctx context.Context, q querier) error {
	mutation := p.mutation
	bound := make(map[int32]struct{}, len(mutation.Bindings))
	for _, binding := range mutation.Bindings {
		if binding != nil {
			bound[binding.ID] = struct{}{}
		}
	}
	for _, attachmentID := range mutation.RequiredAttachmentIDs {
		if _, ok := bound[attachmentID]; ok {
			continue
		}
		if mutation.MemoCreate != nil {
			return errors.Wrap(store.ErrMemoMutationConflict, "a referenced attachment is no longer bound to the memo")
		}
		var exists int
		err := q.QueryRowContext(ctx, "SELECT 1 FROM attachment WHERE id = ? AND memo_id = ?", attachmentID, mutation.MemoID).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return errors.Wrap(store.ErrMemoMutationConflict, "a referenced attachment is no longer bound to the memo")
		}
		if err != nil {
			return errors.Wrap(err, "failed to verify referenced attachment")
		}
	}
	return nil
}

// planRelations validates the reference relations. Relations of a memo
// created by this mutation receive their memo id after the commit.
func (p *memoMutationPlan) planRelations() error {
	mutation := p.mutation
	if !mutation.ReplaceReferenceRelations {
		return nil
	}
	for _, relation := range mutation.ReferenceRelations {
		if relation == nil || relation.Type != store.MemoRelationReference {
			return errors.New("invalid memo reference relation mutation")
		}
		if mutation.MemoCreate == nil && relation.MemoID != mutation.MemoID {
			return errors.New("invalid memo reference relation mutation")
		}
	}
	return nil
}

// addTo appends the guards and writes of the mutation to b.
func (p *memoMutationPlan) addTo(b *batch) error {
	mutation := p.mutation
	b.guard(activeUserCondition, mutation.MemoCreatorID)
	memoGuardRelationEndpoints(b, mutation.MemoCreatorID, p.endpoints)

	if create := mutation.MemoCreate; create != nil {
		memoGuardCreate(b, create)
		p.guardCommentContext(b, create.CreatorID)
		if err := memoAddInsert(b, create); err != nil {
			return err
		}
	} else {
		condition, args := p.memo.contentUnchangedCondition()
		b.guard(condition, args...)
		if p.policy != nil {
			memoGuardPolicyPlacement(b, p.memo, p.policy, mutation.MemoUpdate)
		}
	}

	p.addBindings(b)
	p.addRemovedAttachments(b)
	for _, attachmentID := range mutation.RequiredAttachmentIDs {
		b.guard("EXISTS (SELECT 1 FROM attachment WHERE id = ? AND memo_id = "+p.ref.expr+")", attachmentID, p.ref.arg)
	}
	if mutation.MemoUpdate != nil {
		if err := memoAddUpdate(b, mutation.MemoUpdate); err != nil {
			return err
		}
	}
	if mutation.ReplaceReferenceRelations {
		p.addReferenceRelations(b)
	}
	if mutation.MemoCreate != nil && mutation.CommentContextMemoID != nil {
		b.add("INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES ("+p.ref.expr+", ?, ?)",
			p.ref.arg, *mutation.CommentContextMemoID, store.MemoRelationComment)
	}
	return nil
}

// guardCommentContext re-asserts what authorizeMemoComment accepted: the
// context memo is unchanged and, when it sits in a Space, the actor is still
// an active member.
func (p *memoMutationPlan) guardCommentContext(b *batch, actorUserID int32) {
	if p.context == nil {
		return
	}
	condition, args := p.context.unchangedCondition()
	b.guard(condition, args...)
	if p.context.spaceID != nil {
		b.guard("EXISTS (SELECT 1 FROM space WHERE id = ?)", *p.context.spaceID)
		b.guard(activeSpaceMemberCondition, *p.context.spaceID, actorUserID)
	}
}

// addBindings guards each attachment's expected state and binds it.
func (p *memoMutationPlan) addBindings(b *batch) {
	mutation := p.mutation
	for _, binding := range mutation.Bindings {
		if binding.WasBoundToMemo {
			b.guard("EXISTS (SELECT 1 FROM attachment WHERE id = ? AND memo_id = "+p.ref.expr+")", binding.ID, p.ref.arg)
		} else {
			b.guard("EXISTS (SELECT 1 FROM attachment WHERE id = ? AND creator_id = ? AND memo_id IS NULL)", binding.ID, mutation.MemoCreatorID)
		}
		b.add("UPDATE attachment SET memo_id = "+p.ref.expr+", updated_ts = ? WHERE id = ?", p.ref.arg, binding.UpdatedTs, binding.ID)
	}
}

// addRemovedAttachments guards each removed attachment is still bound to the
// memo and deletes it.
func (p *memoMutationPlan) addRemovedAttachments(b *batch) {
	mutation := p.mutation
	for _, attachment := range p.removed {
		b.guard("EXISTS (SELECT 1 FROM attachment WHERE id = ? AND memo_id = ? AND creator_id = ?)", attachment.ID, mutation.MemoID, mutation.MemoCreatorID)
		b.add("DELETE FROM attachment WHERE id = ? AND memo_id = ?", attachment.ID, mutation.MemoID)
	}
}

// addReferenceRelations replaces the memo's REFERENCE relations.
func (p *memoMutationPlan) addReferenceRelations(b *batch) {
	b.add("DELETE FROM memo_relation WHERE memo_id = "+p.ref.expr+" AND type = ?", p.ref.arg, store.MemoRelationReference)
	for _, relation := range p.mutation.ReferenceRelations {
		b.add(`INSERT INTO memo_relation (memo_id, related_memo_id, type)
			VALUES (`+p.ref.expr+`, ?, ?)
			ON CONFLICT(memo_id, related_memo_id, type) DO UPDATE SET type = excluded.type`,
			p.ref.arg, relation.RelatedMemoID, relation.Type)
	}
}

// finish loads the generated columns of a created memo and propagates its id
// to the mutation, as the SQLite driver does before its writes.
func (p *memoMutationPlan) finish(ctx context.Context, q querier) error {
	create := p.mutation.MemoCreate
	if create == nil {
		return nil
	}
	if err := memoLoadCreated(ctx, q, create); err != nil {
		return err
	}
	p.mutation.MemoID = create.ID
	for _, relation := range p.mutation.ReferenceRelations {
		if relation != nil {
			relation.MemoID = create.ID
		}
	}
	return nil
}

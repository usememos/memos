package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type memoMutationFixture struct {
	t                    *testing.T
	ctx                  context.Context
	store                *store.Store
	owner, peer          *store.User
	memo, target, next   *store.Memo
	added, removed, kept *store.Attachment
}

func newMemoMutationFixture(t *testing.T) *memoMutationFixture {
	t.Helper()
	f := &memoMutationFixture{t: t, ctx: context.Background()}
	f.store = NewTestingStore(f.ctx, t)
	t.Cleanup(func() { require.NoError(t, f.store.Close()) })
	var err error
	f.owner, err = f.store.CreateUser(f.ctx, &store.User{Username: "mutation-owner", Role: store.RoleUser})
	require.NoError(t, err)
	f.peer, err = f.store.CreateUser(f.ctx, &store.User{Username: "mutation-peer", Role: store.RoleUser})
	require.NoError(t, err)
	for i, dest := range []**store.Memo{&f.memo, &f.target, &f.next} {
		uid := []string{"mutation-source", "mutation-target", "mutation-next"}[i]
		*dest, err = f.store.CreateMemo(f.ctx, &store.Memo{
			UID: uid, CreatorID: f.owner.ID, Content: uid, Visibility: store.Private,
		})
		require.NoError(t, err)
	}
	for i, dest := range []**store.Attachment{&f.added, &f.removed, &f.kept} {
		uid := []string{"mutation-added", "mutation-removed", "mutation-kept"}[i]
		attachment := &store.Attachment{UID: uid, CreatorID: f.owner.ID, Filename: uid + ".txt", Type: "text/plain", Blob: []byte(uid)}
		if i > 0 {
			attachment.MemoID = &f.memo.ID
		}
		*dest, err = f.store.CreateAttachment(f.ctx, attachment)
		require.NoError(t, err)
	}
	_, err = f.store.UpsertMemoRelation(f.ctx, &store.MemoRelation{
		MemoID: f.memo.ID, RelatedMemoID: f.target.ID, Type: store.MemoRelationReference,
	})
	require.NoError(t, err)
	return f
}

func (f *memoMutationFixture) mutation() *store.MemoMutation {
	return &store.MemoMutation{
		MemoID: f.memo.ID, MemoCreatorID: f.owner.ID, ExpectedMemoContent: f.memo.Content,
		MemoUpdate: &store.UpdateMemo{ID: f.memo.ID, Content: new("updated content")},
		Bindings: []*store.MemoAttachmentBinding{
			{ID: f.added.ID, UID: f.added.UID, UpdatedTs: 1600000000},
		},
		RemovedAttachmentIDs:      []int32{f.removed.ID},
		RequiredAttachmentIDs:     []int32{f.kept.ID, f.added.ID},
		ReplaceReferenceRelations: true,
		ReferenceRelations: []*store.MemoRelation{
			{MemoID: f.memo.ID, RelatedMemoID: f.next.ID, Type: store.MemoRelationReference},
		},
	}
}

type memoMutationState struct {
	memos       []*store.Memo
	attachments []*store.Attachment
	relations   []*store.MemoRelation
}

func (f *memoMutationFixture) state() memoMutationState {
	f.t.Helper()
	memos, err := f.store.ListMemos(f.ctx, &store.FindMemo{})
	require.NoError(f.t, err)
	attachments, err := f.store.ListAttachments(f.ctx, &store.FindAttachment{GetBlob: true, SkipDefaultLimit: true})
	require.NoError(f.t, err)
	relations, err := f.store.ListMemoRelations(f.ctx, &store.FindMemoRelation{})
	require.NoError(f.t, err)
	return memoMutationState{memos: memos, attachments: attachments, relations: relations}
}

func TestMemoMutationRevalidatesPreparedState(t *testing.T) {
	tests := []struct {
		name    string
		change  func(*memoMutationFixture, *store.MemoMutation)
		message string
	}{
		{"memo content changed", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.UpdateMemo(f.ctx, &store.UpdateMemo{ID: f.memo.ID, Content: new("concurrent edit")}))
		}, "memo changed"},
		{"memo creator mismatch", func(f *memoMutationFixture, m *store.MemoMutation) {
			m.MemoCreatorID = f.peer.ID
			m.ReplaceReferenceRelations = false
		}, "memo changed"},
		{"memo deleted", func(f *memoMutationFixture, m *store.MemoMutation) {
			m.ReplaceReferenceRelations = false
			require.NoError(f.t, f.store.DeleteMemo(f.ctx, &store.DeleteMemo{ID: f.memo.ID}))
		}, "memo no longer exists"},
		{"removed attachment deleted", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.GetDriver().DeleteAttachment(f.ctx, &store.DeleteAttachment{ID: f.removed.ID}))
		}, "removed attachment no longer exists"},
		{"removed attachment moved", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.UpdateAttachment(f.ctx, &store.UpdateAttachment{ID: f.removed.ID, MemoID: &f.target.ID}))
		}, "no longer removable"},
		{"new binding deleted", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.GetDriver().DeleteAttachment(f.ctx, &store.DeleteAttachment{ID: f.added.ID}))
		}, "no longer exists"},
		{"new binding taken by another memo", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.UpdateAttachment(f.ctx, &store.UpdateAttachment{ID: f.added.ID, MemoID: &f.target.ID}))
		}, "no longer available"},
		{"existing binding moved after preparation", func(f *memoMutationFixture, m *store.MemoMutation) {
			m.Bindings = append(m.Bindings, &store.MemoAttachmentBinding{ID: f.kept.ID, UID: f.kept.UID, WasBoundToMemo: true})
			require.NoError(f.t, f.store.UpdateAttachment(f.ctx, &store.UpdateAttachment{ID: f.kept.ID, MemoID: &f.target.ID}))
		}, "no longer bound"},
		{"claimed existing binding is unbound", func(_ *memoMutationFixture, m *store.MemoMutation) {
			m.Bindings[0].WasBoundToMemo = true
		}, "no longer bound"},
		{"required attachment moved after preparation", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.UpdateAttachment(f.ctx, &store.UpdateAttachment{ID: f.kept.ID, MemoID: &f.target.ID}))
		}, "referenced attachment is no longer bound"},
		{"reference target deleted", func(f *memoMutationFixture, _ *store.MemoMutation) {
			require.NoError(f.t, f.store.DeleteMemo(f.ctx, &store.DeleteMemo{ID: f.next.ID}))
		}, "memo state changed"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			mutation := f.mutation()
			tc.change(f, mutation)
			before := f.state()
			err := f.store.ApplyMemoMutation(f.ctx, mutation)
			require.ErrorIs(t, err, store.ErrMemoMutationConflict)
			require.ErrorContains(t, err, tc.message)
			require.Equal(t, before, f.state(), "rejected mutation must preserve the current database state")
		})
	}
}

func TestMemoMutationRollsBackAfterAttachmentWrites(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*memoMutationFixture, *store.MemoMutation)
	}{
		{"update target mismatch", func(f *memoMutationFixture, m *store.MemoMutation) { m.MemoUpdate.ID = f.target.ID }},
		{"memo UID uniqueness failure", func(f *memoMutationFixture, m *store.MemoMutation) { m.MemoUpdate.UID = &f.target.UID }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			mutation := f.mutation()
			tc.change(f, mutation)
			before := f.state()
			// Both failures occur after binding the added attachment and deleting
			// the removed attachment, so this checks a real transaction rollback.
			require.Error(t, f.store.ApplyMemoMutation(f.ctx, mutation))
			require.Equal(t, before, f.state())
			// A fresh valid write also proves the failed transaction released its locks.
			require.NoError(t, f.store.ApplyMemoMutation(f.ctx, f.mutation()))
		})
	}
}

func TestMemoMutationRollsBackAfterReferenceInsertFailure(t *testing.T) {
	f := newMemoMutationFixture(t)
	first, err := f.store.CreateMemo(f.ctx, &store.Memo{
		UID: "first-replacement", CreatorID: f.owner.ID, Content: "replacement", Visibility: store.Private,
	})
	require.NoError(t, err)
	// Inject a database error after memo fields, attachment bindings/removals,
	// and the first replacement reference have already been written.
	var statements []string
	drop := "DROP TRIGGER reject_mutation_reference"
	switch getDriverFromEnv() {
	case "sqlite":
		statements = []string{fmt.Sprintf(`CREATE TRIGGER reject_mutation_reference
			BEFORE INSERT ON memo_relation WHEN NEW.related_memo_id = %d
			BEGIN SELECT RAISE(ABORT, 'mutation test reference failure'); END`, f.next.ID)}
	case "mysql":
		statements = []string{fmt.Sprintf(`CREATE TRIGGER reject_mutation_reference
			BEFORE INSERT ON memo_relation FOR EACH ROW BEGIN
			IF NEW.related_memo_id = %d THEN
				SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'mutation test reference failure';
			END IF; END`, f.next.ID)}
	case "postgres":
		statements = []string{
			fmt.Sprintf(`CREATE FUNCTION reject_mutation_reference() RETURNS trigger AS $$
			BEGIN IF NEW.related_memo_id = %d THEN
				RAISE EXCEPTION 'mutation test reference failure';
			END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`, f.next.ID),
			`CREATE TRIGGER reject_mutation_reference BEFORE INSERT ON memo_relation
			FOR EACH ROW EXECUTE FUNCTION reject_mutation_reference()`,
		}
		drop += " ON memo_relation"
	default:
		t.Fatalf("unsupported driver: %s", getDriverFromEnv())
	}
	for _, statement := range statements {
		_, err := f.store.GetDriver().GetDB().ExecContext(f.ctx, statement)
		require.NoError(t, err)
	}
	before := f.state()
	mutation := f.mutation()
	mutation.ReferenceRelations = append([]*store.MemoRelation{
		{MemoID: f.memo.ID, RelatedMemoID: first.ID, Type: store.MemoRelationReference},
	}, mutation.ReferenceRelations...)
	require.ErrorContains(t, f.store.ApplyMemoMutation(f.ctx, mutation), "mutation test reference failure")
	require.Equal(t, before, f.state(), "all three tables must roll back, including the deleted original reference")
	_, err = f.store.GetDriver().GetDB().ExecContext(f.ctx, drop)
	require.NoError(t, err)
	require.NoError(t, f.store.ApplyMemoMutation(f.ctx, f.mutation()))
}

func TestMemoCreationMutationRollsBackCommentAndAttachmentBindings(t *testing.T) {
	for _, comment := range []bool{false, true} {
		name := "top level"
		if comment {
			name = "comment"
		}
		t.Run(name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			foreign, err := f.store.CreateAttachment(f.ctx, &store.Attachment{
				UID: "foreign-attachment", CreatorID: f.peer.ID, Filename: "foreign.txt", Type: "text/plain",
			})
			require.NoError(t, err)
			before := f.state()
			created := &store.Memo{UID: "rejected-creation", CreatorID: f.owner.ID, Content: "new", Visibility: store.Private}
			mutation := &store.MemoMutation{
				MemoCreate: created,
				Bindings: []*store.MemoAttachmentBinding{
					{ID: f.added.ID, UID: f.added.UID, UpdatedTs: 1600000000},
					{ID: foreign.ID, UID: foreign.UID, UpdatedTs: 1600000000},
				},
				ReplaceReferenceRelations: true,
				ReferenceRelations:        []*store.MemoRelation{{RelatedMemoID: f.target.ID, Type: store.MemoRelationReference}},
			}
			if comment {
				mutation.CommentContextMemoID = &f.memo.ID
			}
			require.ErrorIs(t, f.store.ApplyMemoMutation(f.ctx, mutation), store.ErrMemoMutationConflict)
			require.Equal(t, before, f.state())
			got, err := f.store.GetMemo(f.ctx, &store.FindMemo{UID: &created.UID})
			require.NoError(t, err)
			require.Nil(t, got, "failed creation must not leave a memo or orphan COMMENT relation")
		})
	}
}

func TestMemoMutationCanceledContextDoesNotWrite(t *testing.T) {
	f := newMemoMutationFixture(t)
	before := f.state()
	ctx, cancel := context.WithCancel(f.ctx)
	cancel()
	require.ErrorIs(t, f.store.ApplyMemoMutation(ctx, f.mutation()), context.Canceled)
	require.Equal(t, before, f.state())
	require.NoError(t, f.store.ApplyMemoMutation(f.ctx, f.mutation()))
}

func TestMemoMutationRejectsNilBindingWithoutPanic(t *testing.T) {
	f := newMemoMutationFixture(t)
	before := f.state()
	mutation := f.mutation()
	mutation.Bindings = append(mutation.Bindings, nil)
	var err error
	require.NotPanics(t, func() { err = f.store.ApplyMemoMutation(f.ctx, mutation) })
	require.ErrorContains(t, err, "attachment binding is required")
	require.Equal(t, before, f.state())
	require.NoError(t, f.store.ApplyMemoMutation(f.ctx, f.mutation()))
}

func TestMemoMutationConcurrentWritersCommitOnlyOneCompleteChange(t *testing.T) {
	f := newMemoMutationFixture(t)
	second, err := f.store.CreateAttachment(f.ctx, &store.Attachment{
		UID: "second-writer-attachment", CreatorID: f.owner.ID, Filename: "second.txt", Type: "text/plain",
	})
	require.NoError(t, err)
	attachments := []*store.Attachment{f.added, second}
	targets := []*store.Memo{f.next, f.target}
	mutations := []*store.MemoMutation{f.mutation(), f.mutation()}
	for i, m := range mutations {
		m.MemoUpdate.Content = new(fmt.Sprintf("writer-%d", i))
		m.Bindings = []*store.MemoAttachmentBinding{{ID: attachments[i].ID, UID: attachments[i].UID, UpdatedTs: 1600000000}}
		m.RequiredAttachmentIDs = []int32{attachments[i].ID, f.kept.ID}
		m.ReferenceRelations[0].RelatedMemoID = targets[i].ID
	}
	start := make(chan struct{})
	errs := make([]error, len(mutations))
	var wg sync.WaitGroup
	for i, mutation := range mutations {
		wg.Go(func() {
			<-start
			errs[i] = f.store.ApplyMemoMutation(f.ctx, mutation)
		})
	}
	close(start)
	wg.Wait()
	winner := -1
	for i, err := range errs {
		if err == nil {
			require.Equal(t, -1, winner, "two writes based on the same content snapshot must not both commit")
			winner = i
		}
	}
	require.NotEqual(t, -1, winner, "one complete mutation should succeed: %v", errs)
	got, err := f.store.GetMemo(f.ctx, &store.FindMemo{ID: &f.memo.ID})
	require.NoError(t, err)
	require.Equal(t, *mutations[winner].MemoUpdate.Content, got.Content)
	for i, attachment := range attachments {
		got, err := f.store.GetAttachment(f.ctx, &store.FindAttachment{ID: &attachment.ID})
		require.NoError(t, err)
		if i == winner {
			require.Equal(t, &f.memo.ID, got.MemoID)
		} else {
			require.Nil(t, got.MemoID, "losing writer must not leave its attachment bound")
		}
	}
	removed, err := f.store.GetAttachment(f.ctx, &store.FindAttachment{ID: &f.removed.ID})
	require.NoError(t, err)
	require.Nil(t, removed)
	relations, err := f.store.ListMemoRelations(f.ctx, &store.FindMemoRelation{MemoID: &f.memo.ID})
	require.NoError(t, err)
	require.Equal(t, mutations[winner].ReferenceRelations, relations)
}

func TestMemoMutationRechecksSpaceMembership(t *testing.T) {
	for _, policyOnUpdate := range []bool{false, true} {
		name := "mutation policy"
		if policyOnUpdate {
			name = "update policy fallback"
		}
		t.Run(name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			space, err := f.store.CreateSpace(f.ctx, &store.Space{UID: "mutation-space", Title: "Space"}, f.owner.ID)
			require.NoError(t, err)
			_, err = createSpaceMemberForTest(f.ctx, f.store, &store.SpaceMember{
				SpaceID: space.ID, UserID: f.peer.ID, Role: store.SpaceMemberRoleAdmin,
			}, f.owner.ID)
			require.NoError(t, err)
			require.NoError(t, f.store.UpdateMemo(f.ctx, &store.UpdateMemo{ID: f.memo.ID, SpaceID: &space.ID}))
			mutation := f.mutation()
			policy := memoWritePolicy(f.owner.ID, false)
			if policyOnUpdate {
				mutation.MemoUpdate.Policy = policy
			} else {
				mutation.Policy = policy
			}
			require.NoError(t, f.store.DeleteSpaceMember(f.ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: f.owner.ID}, f.peer.ID))
			before := f.state()
			require.ErrorIs(t, f.store.ApplyMemoMutation(f.ctx, mutation), store.ErrMemoSpaceMembershipRequired)
			require.Equal(t, before, f.state())
		})
	}
}

func TestMemoMutationLifecyclePolicyFallbackRejectsDependentWrites(t *testing.T) {
	f := newMemoMutationFixture(t)
	space, err := f.store.CreateSpace(f.ctx, &store.Space{UID: "withdrawal-space", Title: "Space"}, f.owner.ID)
	require.NoError(t, err)
	require.NoError(t, f.store.UpdateMemo(f.ctx, &store.UpdateMemo{ID: f.memo.ID, SpaceID: &space.ID}))
	mutation := f.mutation()
	mutation.MemoUpdate = &store.UpdateMemo{ID: f.memo.ID, ClearSpace: true, Policy: memoWritePolicy(f.owner.ID, true)}
	before := f.state()
	require.ErrorIs(t, f.store.ApplyMemoMutation(f.ctx, mutation), store.ErrMemoSpaceMembershipRequired)
	require.Equal(t, before, f.state())
}

func TestMemoMutationCommitsAllDependentChanges(t *testing.T) {
	f := newMemoMutationFixture(t)
	mutation := f.mutation()
	mutation.Policy = memoWritePolicy(f.owner.ID, false)
	mutation.MemoUpdate.UID = new("mutation-renamed")
	mutation.MemoUpdate.CreatedTs = new(int64(1500000000))
	mutation.MemoUpdate.UpdatedTs = new(int64(1600000000))
	mutation.MemoUpdate.Pinned = new(true)
	mutation.MemoUpdate.Payload = &storepb.MemoPayload{Tags: []string{"updated"}}
	mutation.Bindings = append(mutation.Bindings, &store.MemoAttachmentBinding{
		ID: f.kept.ID, UID: f.kept.UID, WasBoundToMemo: true, UpdatedTs: 1600000000,
	})
	require.NoError(t, f.store.ApplyMemoMutation(f.ctx, mutation))
	got, err := f.store.GetMemo(f.ctx, &store.FindMemo{ID: &f.memo.ID})
	require.NoError(t, err)
	require.Equal(t, "updated content", got.Content)
	require.Equal(t, "mutation-renamed", got.UID)
	require.Equal(t, int64(1500000000), got.CreatedTs)
	require.Equal(t, int64(1600000000), got.UpdatedTs)
	require.True(t, got.Pinned)
	require.Equal(t, []string{"updated"}, got.Payload.Tags)
	for _, attachment := range []*store.Attachment{f.added, f.kept} {
		got, err := f.store.GetAttachment(f.ctx, &store.FindAttachment{ID: &attachment.ID, GetBlob: true})
		require.NoError(t, err)
		require.Equal(t, &f.memo.ID, got.MemoID)
		require.Equal(t, int64(1600000000), got.UpdatedTs)
		require.Equal(t, f.owner.ID, got.CreatorID)
		require.Equal(t, []byte(attachment.UID), got.Blob)
	}
	removed, err := f.store.GetAttachment(f.ctx, &store.FindAttachment{ID: &f.removed.ID})
	require.NoError(t, err)
	require.Nil(t, removed)
	relations, err := f.store.ListMemoRelations(f.ctx, &store.FindMemoRelation{MemoID: &f.memo.ID})
	require.NoError(t, err)
	require.Equal(t, mutation.ReferenceRelations, relations)
}

func TestMemoMutationAttachmentOwnership(t *testing.T) {
	for _, tc := range []struct {
		name      string
		admin     bool
		thirdUser bool
		action    string
		allowed   bool
	}{
		{"author cannot bind another users upload", false, false, "bind", false},
		{"author cannot delete another users attachment", false, false, "remove", false},
		{"author can retain legacy foreign binding", false, false, "keep", true},
		{"admin can bind own upload to another users memo", true, false, "bind", true},
		{"admin cannot bind unrelated users upload", true, true, "bind", false},
		{"admin can remove another users bound attachment", true, true, "remove", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			actorID := f.owner.ID
			if tc.admin {
				_, err := f.store.UpdateUser(f.ctx, &store.UpdateUser{ID: f.peer.ID, Role: new(store.RoleAdmin)})
				require.NoError(t, err)
				actorID = f.peer.ID
			}
			creatorID := f.peer.ID
			if tc.thirdUser {
				third, err := f.store.CreateUser(f.ctx, &store.User{Username: "third-user", Role: store.RoleUser})
				require.NoError(t, err)
				creatorID = third.ID
			}
			create := &store.Attachment{UID: "foreign-attachment", CreatorID: creatorID, Filename: "foreign.txt", Type: "text/plain"}
			if tc.action != "bind" {
				create.MemoID = &f.memo.ID
			}
			foreign, err := f.store.CreateAttachment(f.ctx, create)
			require.NoError(t, err)
			mutation := f.mutation()
			mutation.Policy = memoWritePolicy(actorID, false)
			if tc.action == "remove" {
				mutation.RemovedAttachmentIDs = append(mutation.RemovedAttachmentIDs, foreign.ID)
			} else {
				mutation.Bindings = append(mutation.Bindings, &store.MemoAttachmentBinding{
					ID: foreign.ID, UID: foreign.UID, WasBoundToMemo: tc.action == "keep", UpdatedTs: 1600000000,
				})
				mutation.RequiredAttachmentIDs = append(mutation.RequiredAttachmentIDs, foreign.ID)
			}
			before := f.state()
			err = f.store.ApplyMemoMutation(f.ctx, mutation)
			if !tc.allowed {
				require.ErrorIs(t, err, store.ErrMemoMutationConflict)
				require.Equal(t, before, f.state())
				return
			}
			require.NoError(t, err)
			got, err := f.store.GetAttachment(f.ctx, &store.FindAttachment{ID: &foreign.ID})
			require.NoError(t, err)
			if tc.action == "remove" {
				require.Nil(t, got)
			} else {
				require.Equal(t, creatorID, got.CreatorID, "binding must not transfer ownership")
				require.Equal(t, &f.memo.ID, got.MemoID)
			}
		})
	}
}

func TestMemoMutationRechecksActorAndReferenceAudience(t *testing.T) {
	for _, name := range []string{"actor archived", "administrator demoted", "reference made private"} {
		t.Run(name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			mutation := f.mutation()
			mutation.Policy = memoWritePolicy(f.owner.ID, false)
			switch name {
			case "actor archived":
				_, err := f.store.UpdateUser(f.ctx, &store.UpdateUser{ID: f.owner.ID, RowStatus: new(store.Archived)})
				require.NoError(t, err)
			case "administrator demoted":
				_, err := f.store.UpdateUser(f.ctx, &store.UpdateUser{ID: f.peer.ID, Role: new(store.RoleAdmin)})
				require.NoError(t, err)
				mutation.Policy = memoWritePolicy(f.peer.ID, false)
				_, err = f.store.UpdateUser(f.ctx, &store.UpdateUser{ID: f.peer.ID, Role: new(store.RoleUser)})
				require.NoError(t, err)
			case "reference made private":
				target, err := f.store.CreateMemo(f.ctx, &store.Memo{
					UID: "foreign-reference", CreatorID: f.peer.ID, Content: "shared", Visibility: store.Public,
				})
				require.NoError(t, err)
				mutation.ReferenceRelations[0].RelatedMemoID = target.ID
				require.NoError(t, f.store.UpdateMemo(f.ctx, &store.UpdateMemo{ID: target.ID, Visibility: new(store.Private)}))
			default:
				t.Fatalf("unknown permission change: %s", name)
			}
			before := f.state()
			require.ErrorIs(t, f.store.ApplyMemoMutation(f.ctx, mutation), store.ErrMemoPermissionDenied)
			require.Equal(t, before, f.state())
		})
	}
}

func TestMemoMutationReferenceReplacementPreservesCommentAndIncomingRelations(t *testing.T) {
	for _, replace := range []bool{false, true} {
		name := "replace references"
		if !replace {
			name = "clear references"
		}
		t.Run(name, func(t *testing.T) {
			f := newMemoMutationFixture(t)
			comment, err := f.store.CreateMemoComment(f.ctx, &store.Memo{
				UID: "mutation-comment", CreatorID: f.owner.ID, Content: "comment", Visibility: store.Private,
			}, f.memo.ID, f.owner.ID)
			require.NoError(t, err)
			for _, relation := range []*store.MemoRelation{
				{MemoID: comment.ID, RelatedMemoID: f.target.ID, Type: store.MemoRelationReference},
				{MemoID: f.target.ID, RelatedMemoID: comment.ID, Type: store.MemoRelationReference},
			} {
				_, err := f.store.UpsertMemoRelation(f.ctx, relation)
				require.NoError(t, err)
			}
			mutation := &store.MemoMutation{
				MemoID: comment.ID, MemoCreatorID: f.owner.ID, ExpectedMemoContent: comment.Content,
				MemoUpdate: &store.UpdateMemo{ID: comment.ID}, ReplaceReferenceRelations: true,
			}
			want := []*store.MemoRelation{{MemoID: comment.ID, RelatedMemoID: f.memo.ID, Type: store.MemoRelationComment}}
			if replace {
				mutation.ReferenceRelations = []*store.MemoRelation{{MemoID: comment.ID, RelatedMemoID: f.next.ID, Type: store.MemoRelationReference}}
				want = append(want, mutation.ReferenceRelations...)
			}
			require.NoError(t, f.store.ApplyMemoMutation(f.ctx, mutation))
			outgoing, err := f.store.ListMemoRelations(f.ctx, &store.FindMemoRelation{MemoID: &comment.ID})
			require.NoError(t, err)
			require.ElementsMatch(t, want, outgoing)
			incoming, err := f.store.ListMemoRelations(f.ctx, &store.FindMemoRelation{RelatedMemoID: &comment.ID})
			require.NoError(t, err)
			require.Equal(t, []*store.MemoRelation{{MemoID: f.target.ID, RelatedMemoID: comment.ID, Type: store.MemoRelationReference}}, incoming)
		})
	}
}

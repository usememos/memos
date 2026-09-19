package store_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoMutationRejectsInvalidInputBeforeWriting(t *testing.T) {
	creation := func() *store.MemoMutation {
		return &store.MemoMutation{MemoCreate: &store.Memo{UID: "new-memo", CreatorID: 1, Visibility: store.Private}}
	}
	references := func(relations ...*store.MemoRelation) *store.MemoMutation {
		return &store.MemoMutation{MemoID: 1, MemoCreatorID: 1, ReplaceReferenceRelations: true, ReferenceRelations: relations}
	}
	tests := []struct {
		name     string
		mutation func() *store.MemoMutation
		message  string
	}{
		{"nil mutation", func() *store.MemoMutation { return nil }, "memo mutation is required"},
		{"create and update", func() *store.MemoMutation {
			m := creation()
			m.MemoUpdate = &store.UpdateMemo{ID: 1}
			return m
		}, "cannot update or remove existing state"},
		{"create with update policy", func() *store.MemoMutation {
			m := creation()
			m.Policy = &store.MemoWritePolicy{ActorUserID: 1}
			return m
		}, "cannot update or remove existing state"},
		{"create and delete attachment", func() *store.MemoMutation {
			m := creation()
			m.RemovedAttachmentIDs = []int32{1}
			return m
		}, "cannot update or remove existing state"},
		{"missing creator", func() *store.MemoMutation {
			m := creation()
			m.MemoCreate.CreatorID = 0
			return m
		}, "requires creator"},
		{"invalid creation UID", func() *store.MemoMutation {
			m := creation()
			m.MemoCreate.UID = "invalid uid"
			return m
		}, "invalid uid"},
		{"invalid creation visibility", func() *store.MemoMutation {
			m := creation()
			m.MemoCreate.Visibility = "INVALID"
			return m
		}, "invalid visibility"},
		{"space audience without placement", func() *store.MemoMutation {
			m := creation()
			m.MemoCreate.Visibility = store.SpaceAudience
			return m
		}, "SPACE visibility requires a space"},
		{"invalid comment context", func() *store.MemoMutation {
			m := creation()
			m.CommentContextMemoID = new(int32(0))
			return m
		}, "valid context memo"},
		{"missing policy actor", func() *store.MemoMutation {
			return &store.MemoMutation{Policy: &store.MemoWritePolicy{}}
		}, "write policy requires actor"},
		{"missing fallback policy actor", func() *store.MemoMutation {
			return &store.MemoMutation{MemoUpdate: &store.UpdateMemo{ID: 1, Policy: &store.MemoWritePolicy{}}}
		}, "write policy requires actor"},
		{"conflicting policy actions", func() *store.MemoMutation {
			return &store.MemoMutation{Policy: &store.MemoWritePolicy{ActorUserID: 1, LifecycleOnly: true, CreatingShare: true}}
		}, "conflicting actions"},
		{"conflicting fallback policy actions", func() *store.MemoMutation {
			return &store.MemoMutation{MemoUpdate: &store.UpdateMemo{ID: 1, Policy: &store.MemoWritePolicy{
				ActorUserID: 1, LifecycleOnly: true, CreatingShare: true,
			}}}
		}, "conflicting actions"},
		{"zero removed ID", func() *store.MemoMutation {
			return &store.MemoMutation{RemovedAttachmentIDs: []int32{0}}
		}, "IDs must be positive"},
		{"nil attachment binding", func() *store.MemoMutation {
			return &store.MemoMutation{Bindings: []*store.MemoAttachmentBinding{nil}}
		}, "attachment binding is required"},
		{"negative removed ID", func() *store.MemoMutation {
			return &store.MemoMutation{RemovedAttachmentIDs: []int32{-1}}
		}, "IDs must be positive"},
		{"nonadjacent duplicate removed IDs", func() *store.MemoMutation {
			return &store.MemoMutation{RemovedAttachmentIDs: []int32{2, 1, 2}}
		}, "duplicate removed attachment ID"},
		{"bind and remove same attachment", func() *store.MemoMutation {
			return &store.MemoMutation{RemovedAttachmentIDs: []int32{1}, Bindings: []*store.MemoAttachmentBinding{{ID: 1}}}
		}, "both bound and removed"},
		{"require and remove same attachment", func() *store.MemoMutation {
			return &store.MemoMutation{RemovedAttachmentIDs: []int32{1}, RequiredAttachmentIDs: []int32{1}}
		}, "both required and removed"},
		{"reference without actor", func() *store.MemoMutation {
			m := references()
			m.MemoCreatorID = 0
			return m
		}, "requires an actor"},
		{"nil reference", func() *store.MemoMutation { return references(nil) }, "only REFERENCE"},
		{"invalid reference target", func() *store.MemoMutation {
			return references(&store.MemoRelation{MemoID: 1, Type: store.MemoRelationReference})
		}, "only REFERENCE"},
		{"comment relation replacement", func() *store.MemoMutation {
			return references(&store.MemoRelation{MemoID: 1, RelatedMemoID: 2, Type: store.MemoRelationComment})
		}, "only REFERENCE"},
		{"wrong reference source", func() *store.MemoMutation {
			return references(&store.MemoRelation{MemoID: 3, RelatedMemoID: 2, Type: store.MemoRelationReference})
		}, "source does not match"},
		{"self reference", func() *store.MemoMutation {
			return references(&store.MemoRelation{MemoID: 1, RelatedMemoID: 1, Type: store.MemoRelationReference})
		}, "reflexive memo relations"},
		{"duplicate references", func() *store.MemoMutation {
			return references(
				&store.MemoRelation{MemoID: 1, RelatedMemoID: 2, Type: store.MemoRelationReference},
				&store.MemoRelation{MemoID: 1, RelatedMemoID: 2, Type: store.MemoRelationReference},
			)
		}, "duplicate memo reference"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// No driver is installed: invalid input must fail before database access.
			s := &store.Store{}
			require.ErrorContains(t, s.ApplyMemoMutation(context.Background(), tc.mutation()), tc.message)
		})
	}
}

func TestMemoLifecycleMutationRejectsDependentWrites(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*store.MemoMutation)
	}{
		{"bindings", func(m *store.MemoMutation) { m.Bindings = []*store.MemoAttachmentBinding{{ID: 1}} }},
		{"removals", func(m *store.MemoMutation) { m.RemovedAttachmentIDs = []int32{1} }},
		{"required attachments", func(m *store.MemoMutation) { m.RequiredAttachmentIDs = []int32{1} }},
		{"reference replacement", func(m *store.MemoMutation) { m.ReplaceReferenceRelations = true }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, source := range []string{"mutation policy", "update policy fallback"} {
				t.Run(source, func(t *testing.T) {
					mutation := &store.MemoMutation{
						MemoID: 1, MemoCreatorID: 1,
						MemoUpdate: &store.UpdateMemo{ID: 1, ClearSpace: true},
					}
					policy := &store.MemoWritePolicy{ActorUserID: 1, LifecycleOnly: true}
					if source == "mutation policy" {
						mutation.Policy = policy
					} else {
						mutation.MemoUpdate.Policy = policy
					}
					tc.change(mutation)
					require.ErrorIs(t, (&store.Store{}).ApplyMemoMutation(context.Background(), mutation), store.ErrMemoSpaceMembershipRequired)
				})
			}
		})
	}
}

package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func TestListMemosAttachmentFilters(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	owner, err := ts.CreateRegularUser(ctx, "attachment-filters")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	for i, mime := range []string{"", "application/pdf", "image/png"} {
		memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
			UID: fmt.Sprintf("filter-%d", i), CreatorID: owner.ID,
			Content: "no inline image", Visibility: store.Private,
		})
		require.NoError(t, err)
		if mime != "" {
			_, err = ts.Store.CreateAttachment(ctx, &store.Attachment{
				UID: fmt.Sprintf("filter-att-%d", i), CreatorID: owner.ID,
				MemoID: &memo.ID, Type: mime,
			})
			require.NoError(t, err)
		}
	}
	for _, tc := range []struct {
		filter string
		names  []string
	}{
		{"has_attachments", []string{"memos/filter-1", "memos/filter-2"}},
		{"has_image", []string{"memos/filter-2"}},
		{"has_attachments && !has_image", []string{"memos/filter-1"}},
	} {
		t.Run(tc.filter, func(t *testing.T) {
			resp, err := ts.Service.ListMemos(ownerCtx, &apipb.ListMemosRequest{Filter: tc.filter, PageSize: 50})
			require.NoError(t, err)
			names := make([]string, 0, len(resp.Memos))
			for _, memo := range resp.Memos {
				names = append(names, memo.Name)
			}
			require.ElementsMatch(t, tc.names, names)
		})
	}
}

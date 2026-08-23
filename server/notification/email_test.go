package notification

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestEmailMemoReadCreatorLifecycle(t *testing.T) {
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	defer st.Close()
	dispatcher := NewEmailDispatcher(nil, st, nil)

	creator, err := st.CreateUser(ctx, &store.User{Username: "email-memo-creator", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	viewer, err := st.CreateUser(ctx, &store.User{Username: "email-memo-viewer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := st.CreateMemo(ctx, &store.Memo{
		UID: "email-memo-creator-lifecycle", CreatorID: creator.ID, Content: "memo", Visibility: store.Protected,
	})
	require.NoError(t, err)
	archived := store.Archived
	_, err = st.UpdateUser(ctx, &store.UpdateUser{ID: creator.ID, RowStatus: &archived})
	require.NoError(t, err)

	readable, err := dispatcher.listMemosByID(ctx, []int32{memo.ID}, viewer.ID)
	require.NoError(t, err)
	require.Contains(t, readable, memo.ID, "archiving the creator must not narrow an active PROTECTED memo")

	_, err = st.GetDriver().GetDB().ExecContext(ctx,
		fmt.Sprintf("UPDATE memo SET creator_id = 2147483000 WHERE id = %d", memo.ID))
	require.NoError(t, err)
	danglingMemo, err := st.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.NotNil(t, danglingMemo)
	readable, err = dispatcher.listMemosByID(ctx, []int32{danglingMemo.ID}, viewer.ID)
	require.NoError(t, err)
	require.NotContains(t, readable, danglingMemo.ID, "email rendering must fail closed for a missing memo creator")
}

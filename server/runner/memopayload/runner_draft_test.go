package memopayload

import (
	"context"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/markdown"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// Added-guard surface: the payload runner (runner.go:35) lists memos with no
// RowStatus filter, so it rebuilds and rewrites DRAFT memo payloads alongside
// normal ones. The contract requires the runner to skip / exclude DRAFT memos.
//
// The runner must leave a DRAFT memo's payload untouched (no Tags rebuilt from
// its #tag content). A NORMAL memo is included as a positive control proving
// the runner still does its work.
func TestPayloadRunner_SkipsDraftMemos(t *testing.T) {
	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	defer stores.Close()

	user, err := stores.CreateUser(ctx, &store.User{
		Username: "payload-runner-user",
		Role:     store.RoleUser,
		Email:    "payload-runner-user@example.com",
	})
	require.NoError(t, err)

	// NORMAL memo with a tag, empty payload -> positive control.
	normal, err := stores.CreateMemo(ctx, &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  user.ID,
		RowStatus:  store.Normal,
		Visibility: store.Public,
		Content:    "normal memo #control",
	})
	require.NoError(t, err)

	// DRAFT memo with a tag, empty payload -> must NOT be processed.
	draft, err := stores.CreateMemo(ctx, &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  user.ID,
		RowStatus:  store.Draft,
		Visibility: store.Public,
		Content:    "draft memo #secret",
	})
	require.NoError(t, err)

	runner := NewRunner(stores, markdown.NewService(markdown.WithTagExtension()))
	runner.RunOnce(ctx)

	// Positive control: the runner rebuilt the NORMAL memo's payload.
	gotNormal, err := stores.GetMemo(ctx, &store.FindMemo{ID: &normal.ID})
	require.NoError(t, err)
	require.NotNil(t, gotNormal.Payload)
	require.Contains(t, gotNormal.Payload.Tags, "control",
		"sanity: the runner must rebuild NORMAL memo payloads")

	// The draft's payload must remain untouched (no tags extracted/persisted).
	gotDraft, err := stores.GetMemo(ctx, &store.FindMemo{ID: &draft.ID})
	require.NoError(t, err)
	require.NotContains(t, gotDraft.Payload.GetTags(), "secret",
		"the payload runner must skip DRAFT memos and leave their payload untouched")
}

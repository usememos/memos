package memopayload_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/core/memopayload"
	"github.com/usememos/memos/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestBackfillRebuildsOncePerVersion(t *testing.T) {
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	user, err := st.CreateUser(ctx, &store.User{Username: "payload-backfill", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	// Payloads written before has_inline_image existed: the flag is missing.
	location := &storepb.MemoPayload_Location{Placeholder: "Pier"}
	external, err := st.CreateMemo(ctx, &store.Memo{
		UID: "backfill-external-image", CreatorID: user.ID, Visibility: store.Private,
		Content: "![view](https://example.com/view.jpg) #travel",
		Payload: &storepb.MemoPayload{Tags: []string{"travel"}, Location: location},
	})
	require.NoError(t, err)
	plain, err := st.CreateMemo(ctx, &store.Memo{
		UID: "backfill-plain", CreatorID: user.ID, Visibility: store.Private,
		Content: "no picture",
		Payload: &storepb.MemoPayload{Property: &storepb.MemoPayload_Property{HasLink: true}},
	})
	require.NoError(t, err)

	runner := memopayload.NewRunner(st, newMarkdownService())
	require.NoError(t, runner.Backfill(ctx))

	got, err := st.GetMemo(ctx, &store.FindMemo{ID: &external.ID})
	require.NoError(t, err)
	require.True(t, got.Payload.GetProperty().GetHasInlineImage())
	require.Equal(t, []string{"travel"}, got.Payload.Tags)
	require.Equal(t, "Pier", got.Payload.GetLocation().GetPlaceholder(), "the rebuild keeps the location")
	got, err = st.GetMemo(ctx, &store.FindMemo{ID: &plain.ID})
	require.NoError(t, err)
	require.False(t, got.Payload.GetProperty().GetHasLink(), "stale flags are recomputed from content")

	basic, err := st.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, int32(memopayload.Version), basic.PayloadVersion)
	require.NotEmpty(t, basic.SchemaVersion, "recording the version keeps the other basic setting fields")

	// A recorded version skips the pass: a payload changed after it stays.
	stale := &storepb.MemoPayload{}
	require.NoError(t, st.UpdateMemo(ctx, &store.UpdateMemo{ID: external.ID, Payload: stale}))
	require.NoError(t, runner.Backfill(ctx))
	got, err = st.GetMemo(ctx, &store.FindMemo{ID: &external.ID})
	require.NoError(t, err)
	require.False(t, got.Payload.GetProperty().GetHasInlineImage())

	// An older recorded version runs the pass again.
	older, ok := proto.Clone(basic).(*storepb.InstanceBasicSetting)
	require.True(t, ok)
	older.PayloadVersion = memopayload.Version - 1
	_, err = st.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: older},
	})
	require.NoError(t, err)
	require.NoError(t, runner.Backfill(ctx))
	got, err = st.GetMemo(ctx, &store.FindMemo{ID: &external.ID})
	require.NoError(t, err)
	require.True(t, got.Payload.GetProperty().GetHasInlineImage())
}

func TestBackfillStopsOnCancel(t *testing.T) {
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	user, err := st.CreateUser(ctx, &store.User{Username: "payload-cancel", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	_, err = st.CreateMemo(ctx, &store.Memo{UID: "backfill-cancel", CreatorID: user.ID, Visibility: store.Private, Content: "x"})
	require.NoError(t, err)

	canceled, cancel := context.WithCancel(ctx)
	cancel()
	require.Error(t, memopayload.NewRunner(st, newMarkdownService()).Backfill(canceled))

	basic, err := st.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Zero(t, basic.PayloadVersion, "an interrupted pass must not record the version")
}

// newMarkdownService matches the extensions the server uses.
func newMarkdownService() markdown.Service {
	return markdown.NewService(markdown.WithTagExtension(), markdown.WithMentionExtension())
}

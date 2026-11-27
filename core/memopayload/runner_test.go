package memopayload_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/core/memopayload"
	"github.com/usememos/memos/internal/profile"
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

func TestRunOnceRebuildsEveryMemoWhenOneIsDeletedDuringThePass(t *testing.T) {
	ctx := context.Background()
	base := teststore.NewTestingStore(ctx, t)
	driver := &deleteAfterListingDriver{Driver: base.GetDriver()}
	st := store.New(driver, &profile.Profile{})
	user, err := st.CreateUser(ctx, &store.User{Username: "payload-delete-during-pass", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	// Enough memos for more than one rebuild batch, each with a stale payload.
	const count = 150
	for i := range count {
		_, err := st.CreateMemo(ctx, &store.Memo{
			UID: fmt.Sprintf("delete-during-pass-%03d", i), CreatorID: user.ID, Visibility: store.Private,
			Content: fmt.Sprintf("memo %d #batch", i),
			Payload: &storepb.MemoPayload{},
		})
		require.NoError(t, err)
	}

	require.NoError(t, memopayload.NewRunner(st, newMarkdownService()).RunOnce(ctx))

	memos, err := st.ListMemos(ctx, &store.FindMemo{})
	require.NoError(t, err)
	require.Len(t, memos, count-1, "one memo was deleted during the pass")
	for _, memo := range memos {
		require.Equal(t, []string{"batch"}, memo.Payload.GetTags(), "memo %s is rebuilt", memo.UID)
	}
}

// deleteAfterListingDriver deletes the first memo right after the memo IDs
// are read, as a request could while the rebuild runs.
type deleteAfterListingDriver struct {
	store.Driver
}

func (d *deleteAfterListingDriver) ListMemoIDs(ctx context.Context) ([]int32, error) {
	ids, err := d.Driver.ListMemoIDs(ctx)
	if err != nil || len(ids) == 0 {
		return ids, err
	}
	if err := d.DeleteMemo(ctx, &store.DeleteMemo{ID: ids[0]}); err != nil {
		return nil, err
	}
	return ids, nil
}

// newMarkdownService matches the extensions the server uses.
func newMarkdownService() markdown.Service {
	return markdown.NewService(markdown.WithTagExtension(), markdown.WithMentionExtension())
}

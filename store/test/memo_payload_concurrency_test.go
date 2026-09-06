package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
)

func TestMemoPayloadUpdateRejectsStaleSnapshot(t *testing.T) {
	for _, change := range []string{"content", "content case", "content accent", "content trailing space", "payload", "none"} {
		t.Run(change, func(t *testing.T) {
			// Given an enrichment snapshot followed by an author edit.
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			t.Cleanup(func() { require.NoError(t, ts.Close()) })
			user, err := createTestingHostUser(ctx, ts)
			require.NoError(t, err)
			memo, err := ts.CreateMemo(ctx, &store.Memo{
				UID: "concurrent-enrichment", CreatorID: user.ID, Content: "https://example.com", Visibility: store.Private,
				Payload: &storepb.MemoPayload{Tags: []string{"original"}},
			})
			require.NoError(t, err)
			snapshot, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
			require.NoError(t, err)
			content := "https://example.com/new"
			payload := &storepb.MemoPayload{Tags: []string{"author"}, Property: &storepb.MemoPayload_Property{HasTaskList: true}}
			switch change {
			case "content":
				require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &content}))
			case "content case":
				content = "https://EXAMPLE.com"
				require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &content}))
			case "content accent":
				content = "https://examplé.com"
				require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &content}))
			case "content trailing space":
				content = "https://example.com "
				require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &content}))
			case "payload":
				require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Payload: payload}))
			}
			before, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
			require.NoError(t, err)
			enriched := proto.Clone(snapshot.Payload).(*storepb.MemoPayload)
			enriched.Tags = []string{"enriched"}

			// When enrichment attempts to persist its original snapshot.
			err = ts.UpdateMemo(ctx, &store.UpdateMemo{
				ID: memo.ID, Payload: enriched, ExpectedContent: &snapshot.Content, ExpectedPayload: &snapshot.PayloadRaw,
			})

			// Then only an unchanged snapshot is eligible for enrichment.
			if change == "none" {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, store.ErrMemoConcurrentUpdate)
			}
			after, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
			require.NoError(t, err)
			require.Equal(t, before.Content, after.Content)
			if change == "none" {
				require.True(t, proto.Equal(enriched, after.Payload))
			} else {
				require.True(t, proto.Equal(before.Payload, after.Payload))
			}
		})
	}
}

func TestMemoPayloadConcurrentWritersPublishOneSnapshot(t *testing.T) {
	// Given two maintenance writers holding the same persisted snapshot.
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "competing-enrichment", CreatorID: user.ID, Content: "https://example.com", Visibility: store.Private,
	})
	require.NoError(t, err)
	snapshot, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	type result struct {
		tag string
		err error
	}
	start := make(chan struct{})
	results := make(chan result, 2)
	for _, tag := range []string{"first", "second"} {
		go func() {
			<-start
			err := ts.UpdateMemo(ctx, &store.UpdateMemo{
				ID: memo.ID, ExpectedContent: &snapshot.Content, ExpectedPayload: &snapshot.PayloadRaw,
				Payload: &storepb.MemoPayload{Tags: []string{tag}},
			})
			results <- result{tag: tag, err: err}
		}()
	}

	// When both writers attempt to publish distinct payloads.
	close(start)
	first, second := <-results, <-results

	// Then exactly one payload wins, and the other reports a stale snapshot.
	winner, loser := first, second
	if winner.err != nil {
		winner, loser = second, first
	}
	require.NoError(t, winner.err)
	require.ErrorIs(t, loser.err, store.ErrMemoConcurrentUpdate)
	stored, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, []string{winner.tag}, stored.Payload.Tags)
	require.Equal(t, snapshot.Content, stored.Content)
}

func TestMemoPayloadRunnerPreservesEditsDuringEnrichment(t *testing.T) {
	// Given a memo whose author saves changes while enrichment is in flight.
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "runner-concurrent-edit", CreatorID: user.ID, Content: "https://example.com", Visibility: store.Private,
	})
	require.NoError(t, err)
	content := "New author content #updated"
	payload := &storepb.MemoPayload{Tags: []string{"updated"}, Property: &storepb.MemoPayload_Property{HasTaskList: true}}
	runner := memopayload.NewRunner(ts, markdown.NewService())
	enrichments := 0
	runner.EnrichMemoLinks = func(ctx context.Context, _ *store.Memo) {
		enrichments++
		require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &content, Payload: payload}))
	}

	// When the runner completes its stale enrichment pass.
	runner.RunOnce(ctx)

	// Then both the author's content and derived properties remain intact.
	require.Equal(t, 1, enrichments)
	after, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, content, after.Content)
	require.True(t, proto.Equal(payload, after.Payload))
}

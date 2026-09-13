package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestPollVoteStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "poll-voter-2", store.RoleUser)
	require.NoError(t, err)
	memo := createReactionTestMemo(ctx, t, ts, user1.ID, "poll-store-memo")

	pollUID := "11111111-1111-1111-1111-111111111111"

	// No votes yet.
	votes, err := ts.ListPollVotes(ctx, pollUID)
	require.NoError(t, err)
	require.Empty(t, votes)

	// user1 casts a single-choice vote for option 0.
	votes, err = ts.SetPollVotes(ctx, pollUID, memo.ID, user1.ID, []int32{0})
	require.NoError(t, err)
	require.Len(t, votes, 1)
	require.Equal(t, int32(0), votes[0].OptionIndex)
	require.Equal(t, user1.ID, votes[0].VoterID)
	require.Equal(t, memo.ID, votes[0].MemoID)

	// user2 casts a multi-choice vote for options 1 and 2.
	votes, err = ts.SetPollVotes(ctx, pollUID, memo.ID, user2.ID, []int32{1, 2})
	require.NoError(t, err)
	require.Len(t, votes, 3)

	// user1 changes their single-choice vote to option 1 - replaces, not appends.
	votes, err = ts.SetPollVotes(ctx, pollUID, memo.ID, user1.ID, []int32{1})
	require.NoError(t, err)
	require.Len(t, votes, 3)
	optionCounts := map[int32]int{}
	for _, vote := range votes {
		optionCounts[vote.OptionIndex]++
	}
	require.Equal(t, 0, optionCounts[0])
	require.Equal(t, 2, optionCounts[1])
	require.Equal(t, 1, optionCounts[2])

	// Clearing a ballot removes only that voter's rows.
	votes, err = ts.SetPollVotes(ctx, pollUID, memo.ID, user2.ID, []int32{})
	require.NoError(t, err)
	require.Len(t, votes, 1)
	require.Equal(t, user1.ID, votes[0].VoterID)

	// A different poll UID is entirely independent.
	otherVotes, err := ts.ListPollVotes(ctx, "22222222-2222-2222-2222-222222222222")
	require.NoError(t, err)
	require.Empty(t, otherVotes)
}

func TestPollVoteStoreDeduplicatesOptionIndexes(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo := createReactionTestMemo(ctx, t, ts, user.ID, "poll-store-dedup-memo")

	votes, err := ts.SetPollVotes(ctx, "33333333-3333-3333-3333-333333333333", memo.ID, user.ID, []int32{0, 0, 1})
	require.NoError(t, err)
	require.Len(t, votes, 2)
}

func TestEnsurePollBinding(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memoA := createReactionTestMemo(ctx, t, ts, user.ID, "poll-binding-memo-a")
	memoB := createReactionTestMemo(ctx, t, ts, user.ID, "poll-binding-memo-b")

	pollUID := "44444444-4444-4444-4444-444444444444"

	// First access establishes the binding.
	poll, err := ts.EnsurePollBinding(ctx, pollUID, memoA.ID, "hash-v1")
	require.NoError(t, err)
	require.Equal(t, memoA.ID, poll.MemoID)
	require.Equal(t, "hash-v1", poll.DefinitionHash)

	// Same memo, same definition: no-op, same binding returned.
	poll, err = ts.EnsurePollBinding(ctx, pollUID, memoA.ID, "hash-v1")
	require.NoError(t, err)
	require.Equal(t, memoA.ID, poll.MemoID)
	require.Equal(t, "hash-v1", poll.DefinitionHash)

	// A different memo trying to claim the same poll UID is rejected - this
	// is what stops a copy/pasted ```poll block from hijacking or sharing
	// another memo's votes.
	_, err = ts.EnsurePollBinding(ctx, pollUID, memoB.ID, "hash-v1")
	require.ErrorIs(t, err, store.ErrPollMemoMismatch)

	// Cast a vote under the original definition.
	votes, err := ts.SetPollVotes(ctx, pollUID, memoA.ID, user.ID, []int32{0})
	require.NoError(t, err)
	require.Len(t, votes, 1)

	// The same memo editing the poll's options changes the definition hash.
	// EnsurePollBinding must clear the now-stale vote rather than leave it
	// silently pointing at a different option under the new definition.
	poll, err = ts.EnsurePollBinding(ctx, pollUID, memoA.ID, "hash-v2")
	require.NoError(t, err)
	require.Equal(t, "hash-v2", poll.DefinitionHash)

	votes, err = ts.ListPollVotes(ctx, pollUID)
	require.NoError(t, err)
	require.Empty(t, votes, "editing a poll's options must invalidate its existing votes")

	// Voting again under the new definition works normally.
	votes, err = ts.SetPollVotes(ctx, pollUID, memoA.ID, user.ID, []int32{1})
	require.NoError(t, err)
	require.Len(t, votes, 1)
	require.Equal(t, int32(1), votes[0].OptionIndex)
}

func TestPollDataDeletedWithMemo(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo := createReactionTestMemo(ctx, t, ts, user.ID, "poll-delete-with-memo")

	pollUID := "55555555-5555-5555-5555-555555555555"
	_, err = ts.EnsurePollBinding(ctx, pollUID, memo.ID, "hash-v1")
	require.NoError(t, err)
	_, err = ts.SetPollVotes(ctx, pollUID, memo.ID, user.ID, []int32{0})
	require.NoError(t, err)

	require.NoError(t, ts.DeleteMemo(ctx, &store.DeleteMemo{ID: memo.ID}))

	votes, err := ts.ListPollVotes(ctx, pollUID)
	require.NoError(t, err)
	require.Empty(t, votes, "poll votes must not survive their memo's deletion")

	// The poll binding itself is gone too, so a second memo could legitimately
	// reuse the UID (vanishingly unlikely in practice, but nothing should be
	// left behind to falsely reject it).
	poll, err := ts.EnsurePollBinding(ctx, pollUID, memo.ID+1000, "hash-v1")
	require.NoError(t, err)
	require.Equal(t, memo.ID+1000, poll.MemoID)
}
